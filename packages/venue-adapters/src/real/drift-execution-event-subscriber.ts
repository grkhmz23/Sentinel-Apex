/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import {
  BASE_PRECISION,
  EventSubscriber,
  QUOTE_PRECISION,
  isVariant,
  type DriftClient,
  type EventType,
  type WrappedEvent,
} from '@drift-labs/sdk';
import { PublicKey, type Commitment, type Connection } from '@solana/web3.js';
import Decimal from 'decimal.js';

import type {
  VenueExecutionEventEvidence,
  VenueExecutionEventEvidenceRequest,
  VenueExecutionEventFillRole,
  VenueExecutionRawEvent,
} from '../interfaces/venue-adapter.js';

type DriftProgram = DriftClient['program'];
type DriftOrderActionRecordEvent = WrappedEvent<'OrderActionRecord'>;
type DriftOrderRecordEvent = WrappedEvent<'OrderRecord'>;
type DriftWrappedEvent = WrappedEvent<EventType>;

interface DriftEventSubscriberClient {
  readonly currentProviderType: 'websocket' | 'polling' | 'events-server';
  subscribe(): Promise<boolean>;
  unsubscribe(): Promise<boolean>;
  fetchPreviousTx(fetchMax?: boolean): Promise<void>;
  awaitTx(txSig: string): Promise<void>;
  getEventsByTx(txSig: string): DriftWrappedEvent[] | undefined;
}

export type DriftEventSubscriberFactory = (input: {
  connection: Connection;
  program: DriftProgram;
  accountAddress: PublicKey;
  commitment: Commitment;
}) => DriftEventSubscriberClient;

export interface DriftExecutionEventSubscriberDependencies {
  createEventSubscriber?: DriftEventSubscriberFactory;
}

export interface DriftExecutionEventSubscriberConfig {
  connection: Connection;
  program: DriftProgram;
  accountAddress: string;
  subaccountId: number;
  marketIndex: number;
  commitment: Commitment;
}

interface CorrelatedDriftExecutionEvents {
  correlationStatus: VenueExecutionEventEvidence['correlationStatus'];
  blockedReason: string | null;
  duplicateEventCount: number;
  matchedOrderRecord: DriftOrderRecordEvent | null;
  primaryFillEvent: DriftOrderActionRecordEvent | null;
  rawEvents: VenueExecutionRawEvent[];
  fillBaseAssetAmount: string | null;
  fillQuoteAssetAmount: string | null;
  fillRole: VenueExecutionEventFillRole | null;
  orderId: string | null;
  userOrderId: number | null;
}

const BASE_PRECISION_DECIMAL = new Decimal(String(BASE_PRECISION));
const QUOTE_PRECISION_DECIMAL = new Decimal(String(QUOTE_PRECISION));
const DECIMAL_TOLERANCE = new Decimal('0.000000001');
const DEFAULT_AWAIT_TIMEOUT_MS = 1_000;

function asIsoStringFromUnixSeconds(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const seconds = Number(value.toString());
  if (!Number.isFinite(seconds)) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}

function normaliseDecimalString(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/\.?0+$/, '');
}

function formatBaseUnits(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normaliseDecimalString(
    new Decimal(value.toString()).div(BASE_PRECISION_DECIMAL).toFixed(9),
  );
}

function formatQuoteUnits(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normaliseDecimalString(
    new Decimal(value.toString()).div(QUOTE_PRECISION_DECIMAL).toFixed(6),
  );
}

function sumDecimalStrings(values: Array<string | null>, decimals: number): string | null {
  const present = values.filter((value): value is string => value !== null);
  if (present.length === 0) {
    return null;
  }

  return normaliseDecimalString(
    present.reduce((sum, value) => sum.plus(value), new Decimal(0)).toFixed(decimals),
  );
}

function isOrderRecordEvent(event: DriftWrappedEvent): event is DriftOrderRecordEvent {
  return event.eventType === 'OrderRecord';
}

function isOrderActionRecordEvent(event: DriftWrappedEvent): event is DriftOrderActionRecordEvent {
  return event.eventType === 'OrderActionRecord';
}

function matchesRequestSide(direction: unknown, side: 'buy' | 'sell'): boolean {
  return side === 'buy'
    ? isVariant(direction, 'long')
    : isVariant(direction, 'short');
}

function formatEventFillRole(
  event: DriftOrderActionRecordEvent,
  accountAddress: string,
): VenueExecutionEventFillRole {
  if (event.taker?.toBase58() === accountAddress) {
    return 'taker';
  }

  if (event.maker?.toBase58() === accountAddress) {
    return 'maker';
  }

  return 'unknown';
}

function formatOrderSide(direction: unknown): 'buy' | 'sell' | 'unknown' {
  if (isVariant(direction, 'long')) {
    return 'buy';
  }
  if (isVariant(direction, 'short')) {
    return 'sell';
  }
  return 'unknown';
}

function eventObservedAt(events: VenueExecutionRawEvent[]): string | null {
  const timestamps = events
    .map((event) => event.timestamp)
    .filter((value): value is string => value !== null)
    .sort((left, right) => left.localeCompare(right));

  return timestamps.at(-1) ?? null;
}

function buildEventId(event: DriftWrappedEvent): string {
  return [
    'drift',
    event.txSig,
    event.eventType,
    String(event.txSigIndex),
  ].join(':');
}

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function eventDeduplicationKey(event: DriftOrderActionRecordEvent): string {
  return toOptionalString(event.fillRecordId) ?? `${event.txSig}:${event.txSigIndex}`;
}

function variantName(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const keys = Object.keys(value);
  return keys.length === 1 ? keys[0] ?? null : null;
}

function toNullableNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

function toNullableOrderId(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

function summariseEvidence(input: {
  status: VenueExecutionEventEvidence['correlationStatus'];
  txSignature: string;
  fillBaseAssetAmount: string | null;
  rawEventCount: number;
}): string {
  switch (input.status) {
    case 'event_matched_strong':
      return input.fillBaseAssetAmount === null
        ? `Drift venue events for ${input.txSignature} strongly matched this execution.`
        : `Drift fill events for ${input.txSignature} strongly matched this execution and reported ${input.fillBaseAssetAmount} base filled.`;
    case 'event_matched_probable':
      return `Drift lifecycle events were observed for ${input.txSignature}, but no fill action has been attributed safely yet.`;
    case 'conflicting_event':
      return `Drift venue events for ${input.txSignature} conflict with the expected execution semantics.`;
    case 'event_unmatched':
    default:
      return input.rawEventCount === 0
        ? `No Drift venue events have been ingested for ${input.txSignature} yet.`
        : `Drift venue events were ingested for ${input.txSignature}, but none could be attributed safely to this execution.`;
  }
}

export class DriftExecutionEventSubscriber {
  private subscriber: DriftEventSubscriberClient | null = null;
  private bootPromise: Promise<void> | null = null;

  constructor(
    private readonly config: DriftExecutionEventSubscriberConfig,
    private readonly dependencies: DriftExecutionEventSubscriberDependencies = {},
  ) {}

  async close(): Promise<void> {
    if (this.subscriber !== null) {
      await this.subscriber.unsubscribe();
      this.subscriber = null;
    }
  }

  async getExecutionEventEvidence(
    requests: VenueExecutionEventEvidenceRequest[],
  ): Promise<VenueExecutionEventEvidence[]> {
    if (requests.length === 0) {
      return [];
    }

    try {
      await this.ensureBooted();
      await Promise.all(
        requests.map(async (request) => {
          await this.awaitTx(request.executionReference);
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return requests.map((request) => this.buildUnavailableEvidence(request, message));
    }

    return requests.map((request) => this.correlateRequest(request));
  }

  private async ensureBooted(): Promise<void> {
    if (this.subscriber !== null) {
      return;
    }

    if (this.bootPromise !== null) {
      await this.bootPromise;
      return;
    }

    this.bootPromise = (async () => {
      const createEventSubscriber = this.dependencies.createEventSubscriber
        ?? ((input) => new EventSubscriber(input.connection as unknown as ConstructorParameters<typeof EventSubscriber>[0], input.program, {
          address: input.accountAddress,
          eventTypes: ['OrderRecord', 'OrderActionRecord'],
          commitment: input.commitment,
          maxEventsPerType: 256,
          maxTx: 256,
          orderBy: 'blockchain',
          orderDir: 'asc',
          logProviderConfig: {
            type: 'websocket',
            maxReconnectAttempts: 5,
            fallbackFrequency: 2_000,
            fallbackBatchSize: 25,
            resubTimeoutMs: 15_000,
          },
        }));
      const subscriber = createEventSubscriber({
        connection: this.config.connection,
        program: this.config.program,
        accountAddress: new PublicKey(this.config.accountAddress),
        commitment: this.config.commitment,
      });

      try {
        const subscribed = await subscriber.subscribe();
        if (!subscribed) {
          throw new Error('Drift event subscriber did not confirm subscription.');
        }

        await subscriber.fetchPreviousTx(true);
        this.subscriber = subscriber;
      } catch (error) {
        await subscriber.unsubscribe().catch(() => false);
        throw error;
      }
    })();

    try {
      await this.bootPromise;
    } finally {
      this.bootPromise = null;
    }
  }

  private async awaitTx(txSignature: string): Promise<void> {
    if (this.subscriber === null) {
      return;
    }

    await Promise.race([
      this.subscriber.awaitTx(txSignature),
      new Promise<void>((resolve) => {
        setTimeout(resolve, DEFAULT_AWAIT_TIMEOUT_MS);
      }),
    ]);
  }

  private correlateRequest(
    request: VenueExecutionEventEvidenceRequest,
  ): VenueExecutionEventEvidence {
    const events = this.subscriber?.getEventsByTx(request.executionReference) ?? [];
    const correlated = this.correlateEventsForRequest(request, events);
    const primaryEventType = correlated.primaryFillEvent?.eventType ?? correlated.matchedOrderRecord?.eventType ?? null;
    const primaryActionType = correlated.primaryFillEvent === null
      ? null
      : variantName(correlated.primaryFillEvent.action) ?? 'fill';

    return {
      executionReference: request.executionReference,
      clientOrderId: request.clientOrderId,
      correlationStatus: correlated.correlationStatus,
      deduplicationStatus: correlated.duplicateEventCount > 0 ? 'duplicate_event' : 'unique',
      correlationConfidence: correlated.correlationStatus === 'event_matched_strong'
        ? 'strong'
        : correlated.correlationStatus === 'event_matched_probable'
          ? 'probable'
          : correlated.correlationStatus === 'conflicting_event'
            ? 'conflicting'
            : 'none',
      evidenceOrigin: correlated.rawEvents.length > 0 ? 'raw_and_derived' : 'derived_correlation',
      summary: summariseEvidence({
        status: correlated.correlationStatus,
        txSignature: request.executionReference,
        fillBaseAssetAmount: correlated.fillBaseAssetAmount,
        rawEventCount: correlated.rawEvents.length,
      }),
      blockedReason: correlated.blockedReason,
      observedAt: eventObservedAt(correlated.rawEvents),
      eventType: primaryEventType,
      actionType: primaryActionType,
      txSignature: request.executionReference,
      accountAddress: this.config.accountAddress,
      subaccountId: this.config.subaccountId,
      marketIndex: this.config.marketIndex,
      orderId: correlated.orderId,
      userOrderId: correlated.userOrderId,
      fillBaseAssetAmount: correlated.fillBaseAssetAmount,
      fillQuoteAssetAmount: correlated.fillQuoteAssetAmount,
      fillRole: correlated.fillRole,
      rawEventCount: correlated.rawEvents.length,
      duplicateEventCount: correlated.duplicateEventCount,
      rawEvents: correlated.rawEvents,
    };
  }

  private correlateEventsForRequest(
    request: VenueExecutionEventEvidenceRequest,
    events: DriftWrappedEvent[],
  ): CorrelatedDriftExecutionEvents {
    const accountAddress = this.config.accountAddress;
    const matchingOrderRecords = events
      .filter(isOrderRecordEvent)
      .filter((event) => (
        event.user.toBase58() === accountAddress
        && isVariant(event.order.marketType, 'perp')
        && event.order.marketIndex === this.config.marketIndex
        && event.order.reduceOnly === request.reduceOnly
        && matchesRequestSide(event.order.direction, request.side)
        && new Decimal(formatBaseUnits(event.order.baseAssetAmount) ?? '0')
          .minus(request.requestedSize)
          .abs()
          .lte(DECIMAL_TOLERANCE)
      ));
    const matchedOrderRecord = matchingOrderRecords.length === 1
      ? matchingOrderRecords[0] ?? null
      : null;

    const fillEvents = events
      .filter(isOrderActionRecordEvent)
      .filter((event) => (
        isVariant(event.action, 'fill')
        && isVariant(event.marketType, 'perp')
        && event.marketIndex === this.config.marketIndex
      ));
    const relevantFillEvents = fillEvents.filter((event) => (
      event.taker?.toBase58() === accountAddress || event.maker?.toBase58() === accountAddress
    ));
    const takerFillEvents = relevantFillEvents.filter((event) => (
      formatEventFillRole(event, accountAddress) === 'taker'
      && matchesRequestSide(event.takerOrderDirection, request.side)
    ));
    const makerFillEvents = relevantFillEvents.filter((event) => (
      formatEventFillRole(event, accountAddress) === 'maker'
    ));

    const strongFillEvents = matchedOrderRecord === null
      ? []
      : takerFillEvents.filter((event) => event.takerOrderId === matchedOrderRecord.order.orderId);
    const probableFillEvents = matchedOrderRecord === null
      ? takerFillEvents
      : takerFillEvents.filter((event) => event.takerOrderId !== matchedOrderRecord.order.orderId);
    const conflictingEvent = makerFillEvents.length > 0
      || matchingOrderRecords.length > 1
      || (matchedOrderRecord !== null && probableFillEvents.length > 0);

    const duplicateEventCount = strongFillEvents.length - new Set(
      strongFillEvents.map((event) => eventDeduplicationKey(event)),
    ).size;
    const uniqueStrongFillEvents = strongFillEvents.filter((event, index, source) => (
      source.findIndex((candidate) => (
        eventDeduplicationKey(candidate) === eventDeduplicationKey(event)
      )) === index
    ));

    const rawEvents = [
      ...(matchedOrderRecord === null ? [] : [this.toRawOrderRecordEvent(request, matchedOrderRecord)]),
      ...(
        conflictingEvent
          ? relevantFillEvents
          : uniqueStrongFillEvents.length > 0
            ? uniqueStrongFillEvents
            : probableFillEvents
      ).map((event) => this.toRawOrderActionEvent(request, event)),
    ];
    const fillBaseAssetAmount = conflictingEvent
      ? null
      : sumDecimalStrings(
        uniqueStrongFillEvents.map((event) => formatBaseUnits(event.baseAssetAmountFilled)),
        9,
      );
    const fillQuoteAssetAmount = conflictingEvent
      ? null
      : sumDecimalStrings(
        uniqueStrongFillEvents.map((event) => formatQuoteUnits(event.quoteAssetAmountFilled)),
        6,
      );
    const primaryFillEvent = uniqueStrongFillEvents[0] ?? probableFillEvents[0] ?? relevantFillEvents[0] ?? null;
    const correlationStatus = conflictingEvent
      ? 'conflicting_event'
      : matchedOrderRecord !== null && uniqueStrongFillEvents.length > 0
        ? 'event_matched_strong'
        : matchedOrderRecord !== null || probableFillEvents.length === 1
          ? 'event_matched_probable'
          : 'event_unmatched';
    const blockedReason = correlationStatus === 'event_matched_strong'
      ? null
      : correlationStatus === 'event_matched_probable'
        ? 'Only Drift order-lifecycle evidence is currently attributed; a venue-native fill action is still required.'
        : correlationStatus === 'conflicting_event'
          ? 'Drift venue events conflicted with the expected market, side, or reduce-only execution semantics.'
          : 'No venue-native Drift fill evidence has been attributed to this execution yet.';

    return {
      correlationStatus,
      blockedReason,
      duplicateEventCount: Math.max(duplicateEventCount, 0),
      matchedOrderRecord,
      primaryFillEvent,
      rawEvents,
      fillBaseAssetAmount,
      fillQuoteAssetAmount,
      fillRole: primaryFillEvent === null
        ? null
        : formatEventFillRole(primaryFillEvent, accountAddress),
      orderId: matchedOrderRecord === null
        ? toNullableOrderId(
          primaryFillEvent === null
            ? null
            : formatEventFillRole(primaryFillEvent, accountAddress) === 'maker'
              ? primaryFillEvent.makerOrderId
              : primaryFillEvent.takerOrderId,
        )
        : String(matchedOrderRecord.order.orderId),
      userOrderId: matchedOrderRecord === null
        ? null
        : toNullableNumber(matchedOrderRecord.order.userOrderId),
    };
  }

  private buildUnavailableEvidence(
    request: VenueExecutionEventEvidenceRequest,
    message: string,
  ): VenueExecutionEventEvidence {
    return {
      executionReference: request.executionReference,
      clientOrderId: request.clientOrderId,
      correlationStatus: 'event_unmatched',
      deduplicationStatus: 'unique',
      correlationConfidence: 'none',
      evidenceOrigin: 'derived_correlation',
      summary: `Drift event evidence could not be loaded for ${request.executionReference}.`,
      blockedReason: message,
      observedAt: null,
      eventType: null,
      actionType: null,
      txSignature: request.executionReference,
      accountAddress: this.config.accountAddress,
      subaccountId: this.config.subaccountId,
      marketIndex: this.config.marketIndex,
      orderId: null,
      userOrderId: null,
      fillBaseAssetAmount: null,
      fillQuoteAssetAmount: null,
      fillRole: null,
      rawEventCount: 0,
      duplicateEventCount: 0,
      rawEvents: [],
    };
  }

  private toRawOrderRecordEvent(
    request: VenueExecutionEventEvidenceRequest,
    event: DriftOrderRecordEvent,
  ): VenueExecutionRawEvent {
    return {
      eventId: buildEventId(event),
      venueEventType: event.eventType,
      actionType: 'place',
      txSignature: event.txSig,
      clientOrderId: request.clientOrderId,
      accountAddress: event.user.toBase58(),
      subaccountId: this.config.subaccountId,
      marketIndex: event.order.marketIndex,
      orderId: String(event.order.orderId),
      userOrderId: event.order.userOrderId,
      slot: String(event.slot),
      timestamp: asIsoStringFromUnixSeconds(event.ts),
      fillBaseAssetAmount: formatBaseUnits(event.order.baseAssetAmountFilled),
      fillQuoteAssetAmount: formatQuoteUnits(event.order.quoteAssetAmountFilled),
      fillRole: null,
      metadata: {
        providerType: this.subscriber?.currentProviderType ?? 'websocket',
        reduceOnly: event.order.reduceOnly,
        requestedBaseAssetAmount: formatBaseUnits(event.order.baseAssetAmount),
        side: formatOrderSide(event.order.direction),
      },
    };
  }

  private toRawOrderActionEvent(
    request: VenueExecutionEventEvidenceRequest,
    event: DriftOrderActionRecordEvent,
  ): VenueExecutionRawEvent {
    const fillRole = formatEventFillRole(event, this.config.accountAddress);

    return {
      eventId: buildEventId(event),
      venueEventType: event.eventType,
      actionType: variantName(event.action) ?? 'fill',
      txSignature: event.txSig,
      clientOrderId: request.clientOrderId,
      accountAddress: fillRole === 'maker'
        ? event.maker?.toBase58() ?? this.config.accountAddress
        : event.taker?.toBase58() ?? this.config.accountAddress,
      subaccountId: this.config.subaccountId,
      marketIndex: event.marketIndex,
      orderId: fillRole === 'maker'
        ? toNullableOrderId(event.makerOrderId)
        : toNullableOrderId(event.takerOrderId),
      userOrderId: null,
      slot: String(event.slot),
      timestamp: asIsoStringFromUnixSeconds(event.ts),
      fillBaseAssetAmount: formatBaseUnits(event.baseAssetAmountFilled),
      fillQuoteAssetAmount: formatQuoteUnits(event.quoteAssetAmountFilled),
      fillRole,
      metadata: {
        providerType: this.subscriber?.currentProviderType ?? 'websocket',
        actionExplanation: variantName(event.actionExplanation),
        fillRecordId: toOptionalString(event.fillRecordId),
        takerOrderId: event.takerOrderId ?? null,
        takerOrderDirection: event.takerOrderDirection == null
          ? null
          : formatOrderSide(event.takerOrderDirection),
        makerOrderId: event.makerOrderId ?? null,
        makerOrderDirection: event.makerOrderDirection == null
          ? null
          : formatOrderSide(event.makerOrderDirection),
      },
    };
  }
}
