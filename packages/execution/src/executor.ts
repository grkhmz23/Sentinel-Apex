// =============================================================================
// OrderExecutor — idempotent order lifecycle manager
// =============================================================================

import { createId } from '@sentinel-apex/domain';
import type { OrderIntent, OrderFill } from '@sentinel-apex/domain';
import type { Logger, AuditWriter } from '@sentinel-apex/observability';
import { ordersTotal, executionLatencyMs } from '@sentinel-apex/observability';
import type { VenueAdapter } from '@sentinel-apex/venue-adapters';

import type { OrderRecord, OrderStore } from './order-manager.js';

export interface ExecutorConfig {
  maxRetries: number;
  retryDelayMs: number;
  orderTimeoutMs: number;
}

export class OrderExecutor {
  constructor(
    private readonly adapter: VenueAdapter,
    private readonly store: OrderStore,
    private readonly config: ExecutorConfig,
    private readonly logger: Logger,
    private readonly auditWriter: AuditWriter,
  ) {}

  // ── submitIntent ──────────────────────────────────────────────────────────

  /**
   * Submit an OrderIntent to the venue.
   *
   * Idempotent: if a record already exists for intent.intentId and is not in a
   * terminal-failed state it is returned as-is without re-submitting.
   */
  async submitIntent(intent: OrderIntent): Promise<OrderRecord> {
    // Check for existing record (idempotency)
    const existing = await this.store.getByClientId(intent.intentId);
    if (existing !== null) {
      if (
        existing.status !== 'pending' &&
        existing.status !== 'failed'
      ) {
        this.logger.debug('submitIntent: returning existing non-pending record', {
          intentId: intent.intentId,
          status: existing.status,
        });
        return existing;
      }
      // Allow retry of failed records
    }

    const record: OrderRecord = existing ?? {
      intent,
      status: 'pending',
      venueOrderId: null,
      filledSize: '0',
      averageFillPrice: null,
      feesPaid: null,
      fills: [],
      submittedAt: null,
      completedAt: null,
      lastError: null,
      attemptCount: 0,
    };

    await this.store.save(record);

    const startMs = Date.now();
    let lastError: Error | null = null;

    for (
      let attempt = 1;
      attempt <= this.config.maxRetries + 1;
      attempt++
    ) {
      try {
        await this.store.updateStatus(intent.intentId, 'submitted', {
          submittedAt: new Date(),
          attemptCount: attempt,
        });

        const result = await this.adapter.placeOrder({
          clientOrderId: intent.intentId,
          asset: intent.asset,
          side: intent.side,
          type: intent.type,
          size: intent.size,
          ...(intent.limitPrice !== null ? { price: intent.limitPrice } : {}),
          reduceOnly: intent.reduceOnly,
          postOnly: intent.type === 'post_only',
        });

        const latencyMs = Date.now() - startMs;
        executionLatencyMs.observe(latencyMs, { venue: this.adapter.venueId });
        ordersTotal.increment({ venue: this.adapter.venueId, side: intent.side, status: result.status });

        let newStatus: OrderRecord['status'];
        switch (result.status) {
          case 'filled':
            newStatus = 'filled';
            break;
          case 'partially_filled':
            newStatus = 'partially_filled';
            break;
          case 'rejected':
            newStatus = 'failed';
            break;
          default:
            newStatus = 'submitted';
        }

        const updatedRecord: Partial<OrderRecord> = {
          venueOrderId: result.venueOrderId,
          filledSize: result.filledSize,
          averageFillPrice: result.averageFillPrice,
          feesPaid: result.fees,
          submittedAt: result.submittedAt,
          lastError: null,
        };

        if (newStatus === 'filled' || newStatus === 'failed') {
          updatedRecord.completedAt = new Date();
        }

        await this.store.updateStatus(intent.intentId, newStatus, updatedRecord);

        await this.auditWriter.write({
          eventId: createId(),
          eventType: 'order.submitted',
          occurredAt: new Date().toISOString(),
          actorType: 'system',
          actorId: 'order-executor',
          data: {
            intentId: intent.intentId,
            venueOrderId: result.venueOrderId,
            status: result.status,
            latencyMs,
          },
        });

        this.logger.info('submitIntent: order placed', {
          intentId: intent.intentId,
          venueOrderId: result.venueOrderId,
          status: result.status,
          latencyMs,
        });

        const finalRecord = await this.store.getByClientId(intent.intentId);
        return finalRecord ?? record;
      } catch (thrown: unknown) {
        lastError =
          thrown instanceof Error ? thrown : new Error(String(thrown));

        this.logger.warn('submitIntent: attempt failed', {
          intentId: intent.intentId,
          attempt,
          error: lastError.message,
        });

        await this.store.updateStatus(intent.intentId, 'failed', {
          lastError: lastError.message,
          completedAt: new Date(),
        });

        ordersTotal.increment({ venue: this.adapter.venueId, side: intent.side, status: 'failed' });

        if (attempt <= this.config.maxRetries) {
          await sleep(this.config.retryDelayMs);
        }
      }
    }

    // All retries exhausted
    this.logger.error('submitIntent: all retry attempts exhausted', {
      intentId: intent.intentId,
      error: lastError?.message,
    });

    const finalRecord = await this.store.getByClientId(intent.intentId);
    return finalRecord ?? record;
  }

  // ── pollOrderStatus ────────────────────────────────────────────────────────

  /**
   * Poll the venue for the latest status of an order and update the store.
   */
  async pollOrderStatus(clientOrderId: string): Promise<OrderRecord> {
    const record = await this.store.getByClientId(clientOrderId);
    if (record === null) {
      throw new Error(
        `pollOrderStatus: no order record found for clientOrderId="${clientOrderId}"`,
      );
    }

    if (record.venueOrderId === null) {
      this.logger.debug('pollOrderStatus: order has no venueOrderId yet', {
        clientOrderId,
      });
      return record;
    }

    const venueResult = await this.adapter.getOrder(record.venueOrderId);
    if (venueResult === null) {
      this.logger.warn('pollOrderStatus: order not found at venue', {
        clientOrderId,
        venueOrderId: record.venueOrderId,
      });
      return record;
    }

    let newStatus: OrderRecord['status'];
    switch (venueResult.status) {
      case 'filled':
        newStatus = 'filled';
        break;
      case 'partially_filled':
        newStatus = 'partially_filled';
        break;
      case 'rejected':
        newStatus = 'failed';
        break;
      default:
        newStatus = record.status;
    }

    const updates: Partial<OrderRecord> = {};
    if (newStatus === 'filled' || newStatus === 'failed') {
      updates.completedAt = new Date();
    }

    await this.store.updateStatus(clientOrderId, newStatus, updates);
    ordersTotal.increment({ venue: this.adapter.venueId, status: newStatus });

    const updated = await this.store.getByClientId(clientOrderId);
    return updated ?? record;
  }

  // ── cancelOrder ──────────────────────────────────────────────────────────

  /**
   * Cancel a pending order at the venue and update local state.
   */
  async cancelOrder(clientOrderId: string): Promise<OrderRecord> {
    const record = await this.store.getByClientId(clientOrderId);
    if (record === null) {
      throw new Error(
        `cancelOrder: no order record found for clientOrderId="${clientOrderId}"`,
      );
    }

    if (record.venueOrderId === null) {
      this.logger.warn('cancelOrder: order has no venueOrderId, marking as cancelled locally', {
        clientOrderId,
      });
      await this.store.updateStatus(clientOrderId, 'cancelled', {
        completedAt: new Date(),
      });
      const updated = await this.store.getByClientId(clientOrderId);
      return updated ?? record;
    }

    const cancelResult = await this.adapter.cancelOrder(record.venueOrderId);

    if (cancelResult.cancelled) {
      await this.store.updateStatus(clientOrderId, 'cancelled', {
        completedAt: new Date(),
      });
      ordersTotal.increment({ venue: this.adapter.venueId, status: 'cancelled' });

      await this.auditWriter.write({
        eventId: createId(),
        eventType: 'order.cancelled',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: 'order-executor',
        data: {
          clientOrderId,
          venueOrderId: record.venueOrderId,
        },
      });

      this.logger.info('cancelOrder: order cancelled', {
        clientOrderId,
        venueOrderId: record.venueOrderId,
      });
    } else {
      this.logger.warn('cancelOrder: venue refused cancellation', {
        clientOrderId,
        venueOrderId: record.venueOrderId,
        reason: cancelResult.reason,
      });
    }

    const updated = await this.store.getByClientId(clientOrderId);
    return updated ?? record;
  }

  // ── processFill ───────────────────────────────────────────────────────────

  /**
   * Append a fill event to the order record.  Transitions to 'filled' if
   * filledSize equals or exceeds the original order size.
   */
  async processFill(clientOrderId: string, fill: OrderFill): Promise<OrderRecord> {
    const record = await this.store.getByClientId(clientOrderId);
    if (record === null) {
      throw new Error(
        `processFill: no order record found for clientOrderId="${clientOrderId}"`,
      );
    }

    if (record.status === 'filled' || record.status === 'cancelled' || record.status === 'failed') {
      this.logger.warn('processFill: ignoring fill for terminal order state', {
        clientOrderId,
        fillId: fill.fillId,
        status: record.status,
      });
      return record;
    }

    const existingFill = record.fills.find((existing) => existing.fillId === fill.fillId);
    if (existingFill !== undefined) {
      this.logger.debug('processFill: duplicate fill ignored', {
        clientOrderId,
        fillId: fill.fillId,
      });
      return record;
    }

    const updatedFills = [...record.fills, fill];

    const totalFilled = updatedFills.reduce((acc, f) => {
      return acc + parseFloat(f.filledSize);
    }, 0);

    const requestedSize = parseFloat(record.intent.size);
    const isFullyFilled = totalFilled >= requestedSize - 1e-12;

    const newStatus: OrderRecord['status'] = isFullyFilled ? 'filled' : 'partially_filled';

    await this.store.updateStatus(clientOrderId, newStatus, {
      fills: updatedFills,
      ...(isFullyFilled ? { completedAt: new Date() } : {}),
    });

    ordersTotal.increment({ venue: this.adapter.venueId, status: newStatus });

    await this.auditWriter.write({
      eventId: createId(),
      eventType: 'order.fill_received',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId: 'order-executor',
      data: {
        clientOrderId,
        fillId: fill.fillId,
        filledSize: fill.filledSize,
        fillPrice: fill.fillPrice,
        totalFilled,
        status: newStatus,
      },
    });

    this.logger.info('processFill: fill appended', {
      clientOrderId,
      fillId: fill.fillId,
      totalFilled: String(totalFilled),
      status: newStatus,
    });

    const updated = await this.store.getByClientId(clientOrderId);
    return updated ?? record;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
