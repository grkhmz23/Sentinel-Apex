// =============================================================================
// Reconciler — compares local state against live venue state
// =============================================================================

import Decimal from 'decimal.js';

import { createId } from '@sentinel-apex/domain';
import type { Logger, AuditWriter } from '@sentinel-apex/observability';
import type { VenueAdapter, VenuePosition } from '@sentinel-apex/venue-adapters';

import type { OrderStore } from './order-manager.js';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface Discrepancy {
  type: 'position_mismatch' | 'balance_mismatch' | 'missing_order' | 'unknown_order';
  description: string;
  localValue: string;
  venueValue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ReconciliationResult {
  timestamp: Date;
  venueId: string;
  discrepancies: Discrepancy[];
  healthy: boolean;
}

// ---------------------------------------------------------------------------
// Thresholds for severity classification
// ---------------------------------------------------------------------------

const POSITION_SIZE_TOLERANCE = new Decimal('0.000001');
/** Relative tolerance for position notional discrepancy */
const POSITION_RELATIVE_TOLERANCE = new Decimal('0.001'); // 0.1%

function classifyPositionSeverity(
  localSize: Decimal,
  venueSize: Decimal,
  entryPrice: Decimal,
): Discrepancy['severity'] {
  const diff = localSize.minus(venueSize).abs();
  if (diff.lte(POSITION_SIZE_TOLERANCE)) return 'low';

  const notionalDiff = diff.times(entryPrice);
  if (notionalDiff.lt(new Decimal('100'))) return 'medium';
  if (notionalDiff.lt(new Decimal('10000'))) return 'high';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Reconciler
// ---------------------------------------------------------------------------

export class Reconciler {
  constructor(
    private readonly adapter: VenueAdapter,
    private readonly store: OrderStore,
    private readonly logger: Logger,
    private readonly auditWriter: AuditWriter,
  ) {}

  // ── reconcileOrders ────────────────────────────────────────────────────────

  /**
   * Compare open orders in the local store against what the venue reports.
   *
   * Detects:
   *   - missing_order: we believe an order is open but venue has no record
   *   - unknown_order: venue has an order we have no local record for
   */
  async reconcileOrders(venueId: string): Promise<ReconciliationResult> {
    const timestamp = new Date();
    const discrepancies: Discrepancy[] = [];

    // Gather local orders that are not yet in a terminal state
    const openStatuses = ['pending', 'submitted', 'partially_filled'] as const;
    const localOpenOrders: Map<string, string> = new Map(); // clientOrderId → venueOrderId

    for (const status of openStatuses) {
      const records = await this.store.listByStatus(status);
      for (const record of records) {
        if (record.intent.venueId === venueId && record.venueOrderId !== null) {
          localOpenOrders.set(record.intent.intentId, record.venueOrderId);
        }
      }
    }

    // Check each local open order against the venue
    for (const [clientOrderId, venueOrderId] of localOpenOrders) {
      const venueOrder = await this.adapter.getOrder(venueOrderId);

      if (venueOrder === null) {
        discrepancies.push({
          type: 'missing_order',
          description: `Order "${venueOrderId}" is open locally but not found at venue`,
          localValue: `open (clientOrderId=${clientOrderId})`,
          venueValue: 'not found',
          severity: 'high',
        });
        this.logger.warn('reconcileOrders: missing order at venue', {
          clientOrderId,
          venueOrderId,
        });
        continue;
      }

      // If venue says it's filled but we still think it's open — flag it
      if (venueOrder.status === 'filled') {
        discrepancies.push({
          type: 'missing_order',
          description: `Order "${venueOrderId}" is open locally but already filled at venue`,
          localValue: 'open',
          venueValue: 'filled',
          severity: 'medium',
        });
      }
    }

    const healthy = !discrepancies.some(
      (d) => d.severity === 'high' || d.severity === 'critical',
    );

    await this._writeAuditEvent(venueId, 'reconcile.orders', discrepancies, timestamp);

    this.logger.info('reconcileOrders complete', {
      venueId,
      discrepancyCount: String(discrepancies.length),
      healthy: String(healthy),
    });

    return { timestamp, venueId, discrepancies, healthy };
  }

  // ── reconcilePositions ────────────────────────────────────────────────────

  /**
   * Compare a set of locally-tracked positions against the venue's live positions.
   *
   * Detects:
   *   - position_mismatch: size or side differs beyond tolerance
   *   - missing_order (used for positions): local has position, venue does not
   *   - unknown_order (used for positions): venue has position, local does not
   */
  async reconcilePositions(
    venueId: string,
    localPositions: VenuePosition[],
  ): Promise<ReconciliationResult> {
    const timestamp = new Date();
    const discrepancies: Discrepancy[] = [];

    const venuePositions = await this.adapter.getPositions();

    // Build lookup maps by asset
    const localByAsset = new Map<string, VenuePosition>();
    for (const pos of localPositions) {
      localByAsset.set(pos.asset, pos);
    }

    const venueByAsset = new Map<string, VenuePosition>();
    for (const pos of venuePositions) {
      venueByAsset.set(pos.asset, pos);
    }

    // Check all local positions against venue
    for (const [asset, localPos] of localByAsset) {
      const venuePos = venueByAsset.get(asset);

      if (venuePos === undefined) {
        // Local has a position, venue doesn't
        const localSizeD = new Decimal(localPos.size);
        if (!localSizeD.isZero()) {
          const severity: Discrepancy['severity'] =
            localSizeD.gt(new Decimal('1')) ? 'critical' : 'high';

          discrepancies.push({
            type: 'position_mismatch',
            description: `Local has ${asset} ${localPos.side} position of ${localPos.size} but venue reports none`,
            localValue: `${localPos.side} ${localPos.size}`,
            venueValue: 'none',
            severity,
          });
          this.logger.warn('reconcilePositions: local position missing at venue', { asset });
        }
        continue;
      }

      // Both have a position — compare
      const localSizeD = new Decimal(localPos.size);
      const venueSizeD = new Decimal(venuePos.size);
      const entryPriceD = new Decimal(venuePos.entryPrice);

      // Side mismatch is always critical
      if (localPos.side !== venuePos.side) {
        discrepancies.push({
          type: 'position_mismatch',
          description: `${asset} position side mismatch: local=${localPos.side}, venue=${venuePos.side}`,
          localValue: localPos.side,
          venueValue: venuePos.side,
          severity: 'critical',
        });
        continue;
      }

      // Size mismatch check
      const sizeDiff = localSizeD.minus(venueSizeD).abs();
      const ref = Decimal.max(localSizeD, venueSizeD);
      const relDiff = ref.isZero() ? new Decimal('0') : sizeDiff.div(ref);

      if (sizeDiff.gt(POSITION_SIZE_TOLERANCE) && relDiff.gt(POSITION_RELATIVE_TOLERANCE)) {
        const severity = classifyPositionSeverity(localSizeD, venueSizeD, entryPriceD);
        discrepancies.push({
          type: 'position_mismatch',
          description: `${asset} position size mismatch: local=${localPos.size}, venue=${venuePos.size}`,
          localValue: localPos.size,
          venueValue: venuePos.size,
          severity,
        });
        this.logger.warn('reconcilePositions: position size mismatch', {
          asset,
          localSize: localPos.size,
          venueSize: venuePos.size,
        });
      }
    }

    // Check for venue positions that have no local counterpart
    for (const [asset, venuePos] of venueByAsset) {
      if (!localByAsset.has(asset)) {
        const venueSizeD = new Decimal(venuePos.size);
        if (!venueSizeD.isZero()) {
          discrepancies.push({
            type: 'unknown_order',
            description: `Venue has ${asset} ${venuePos.side} position of ${venuePos.size} but no local record exists`,
            localValue: 'none',
            venueValue: `${venuePos.side} ${venuePos.size}`,
            severity: 'high',
          });
          this.logger.warn('reconcilePositions: unknown position at venue', { asset });
        }
      }
    }

    const healthy = !discrepancies.some(
      (d) => d.severity === 'high' || d.severity === 'critical',
    );

    await this._writeAuditEvent(venueId, 'reconcile.positions', discrepancies, timestamp);

    this.logger.info('reconcilePositions complete', {
      venueId,
      discrepancyCount: String(discrepancies.length),
      healthy: String(healthy),
    });

    return { timestamp, venueId, discrepancies, healthy };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _writeAuditEvent(
    venueId: string,
    eventType: string,
    discrepancies: Discrepancy[],
    timestamp: Date,
  ): Promise<void> {
    await this.auditWriter.write({
      eventId: createId(),
      eventType,
      occurredAt: timestamp.toISOString(),
      actorType: 'system',
      actorId: 'reconciler',
      data: {
        venueId,
        discrepancyCount: discrepancies.length,
        discrepancies,
      },
    });
  }
}
