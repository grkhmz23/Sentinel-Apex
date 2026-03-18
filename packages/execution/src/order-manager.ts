// =============================================================================
// Order store — persists and retrieves OrderRecord instances
// =============================================================================

import type { OrderIntent, OrderStatus, OrderFill } from '@sentinel-apex/domain';

// ---------------------------------------------------------------------------
// Record type
// ---------------------------------------------------------------------------

export interface OrderRecord {
  intent: OrderIntent;
  status: OrderStatus;
  venueOrderId: string | null;
  filledSize: string;
  averageFillPrice: string | null;
  feesPaid: string | null;
  fills: OrderFill[];
  submittedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
  attemptCount: number;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface OrderStore {
  save(record: OrderRecord): Promise<void>;
  getByClientId(clientOrderId: string): Promise<OrderRecord | null>;
  updateStatus(
    clientOrderId: string,
    status: OrderStatus,
    updates?: Partial<OrderRecord>,
  ): Promise<void>;
  listByStatus(status: OrderStatus): Promise<OrderRecord[]>;
}

const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'filled',
  'cancelled',
  'expired',
]);

function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }

  if (TERMINAL_ORDER_STATUSES.has(from)) {
    return false;
  }

  switch (from) {
    case 'pending':
      return to === 'submitted' || to === 'failed' || to === 'cancelled' || to === 'expired';
    case 'submitted':
      return (
        to === 'partially_filled' ||
        to === 'filled' ||
        to === 'cancelled' ||
        to === 'failed' ||
        to === 'expired'
      );
    case 'partially_filled':
      return to === 'partially_filled' || to === 'filled' || to === 'cancelled' || to === 'failed';
    case 'failed':
      return to === 'submitted';
    case 'filled':
    case 'cancelled':
    case 'expired':
      return false;
  }
}

// ---------------------------------------------------------------------------
// In-memory implementation (dry-run / testing)
// ---------------------------------------------------------------------------

export class InMemoryOrderStore implements OrderStore {
  private readonly store = new Map<string, OrderRecord>();

  async save(record: OrderRecord): Promise<void> {
    // Deep-clone fills array to prevent external mutation
    this.store.set(record.intent.intentId, {
      ...record,
      fills: [...record.fills],
    });
  }

  async getByClientId(clientOrderId: string): Promise<OrderRecord | null> {
    const record = this.store.get(clientOrderId);
    if (record === undefined) {
      return null;
    }
    return { ...record, fills: [...record.fills] };
  }

  async updateStatus(
    clientOrderId: string,
    status: OrderStatus,
    updates: Partial<OrderRecord> = {},
  ): Promise<void> {
    const existing = this.store.get(clientOrderId);
    if (existing === undefined) {
      throw new Error(
        `InMemoryOrderStore.updateStatus: no record found for clientOrderId="${clientOrderId}"`,
      );
    }

    if (!isValidStatusTransition(existing.status, status)) {
      throw new Error(
        `InMemoryOrderStore.updateStatus: invalid order status transition ` +
          `"${existing.status}" -> "${status}" for clientOrderId="${clientOrderId}"`,
      );
    }

    const merged: OrderRecord = {
      ...existing,
      ...updates,
      status,
      // Merge fills rather than replace
      fills:
        updates.fills !== undefined
          ? [...updates.fills]
          : [...existing.fills],
    };

    this.store.set(clientOrderId, merged);
  }

  async listByStatus(status: OrderStatus): Promise<OrderRecord[]> {
    const result: OrderRecord[] = [];
    for (const record of this.store.values()) {
      if (record.status === status) {
        result.push({ ...record, fills: [...record.fills] });
      }
    }
    return result;
  }
}
