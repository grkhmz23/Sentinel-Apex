export type CanonicalMarketType = 'perp' | 'spot' | 'unknown';
export type CanonicalMarketIdentityProvenance =
  | 'venue_native'
  | 'derived'
  | 'unsupported';
export type CanonicalMarketIdentityConfidence =
  | 'exact'
  | 'partial'
  | 'unsupported';
export type CanonicalMarketIdentityKeyType =
  | 'market_index'
  | 'market_key'
  | 'market_symbol'
  | 'asset_market_type'
  | 'unsupported';
export type CanonicalMarketIdentityCaptureStage =
  | 'market_data'
  | 'opportunity_leg'
  | 'strategy_intent'
  | 'runtime_order'
  | 'carry_planned_order'
  | 'carry_execution_step'
  | 'execution_result'
  | 'fill'
  | 'internal_snapshot'
  | 'external_truth';

export interface CanonicalMarketIdentity {
  venueId: string | null;
  asset: string | null;
  marketType: CanonicalMarketType;
  marketIndex: number | null;
  marketKey: string | null;
  marketSymbol: string | null;
  marketName: string | null;
  aliases: string[];
  normalizedKey: string | null;
  normalizedKeyType: CanonicalMarketIdentityKeyType;
  provenance: CanonicalMarketIdentityProvenance;
  confidence: CanonicalMarketIdentityConfidence;
  capturedAtStage: CanonicalMarketIdentityCaptureStage;
  source: string;
  notes: string[];
}

export interface CanonicalMarketIdentityInput {
  venueId?: string | null;
  asset?: string | null;
  marketType?: unknown;
  marketIndex?: number | string | null;
  marketKey?: string | null;
  marketSymbol?: string | null;
  marketName?: string | null;
  aliases?: readonly string[];
  provenance?: CanonicalMarketIdentityProvenance;
  capturedAtStage: CanonicalMarketIdentityCaptureStage;
  source: string;
  notes?: readonly string[];
}

export interface CanonicalMarketIdentityMetadataDefaults {
  venueId?: string | null;
  asset?: string | null;
  marketType?: unknown;
  provenance?: CanonicalMarketIdentityProvenance;
  capturedAtStage: CanonicalMarketIdentityCaptureStage;
  source: string;
  notes?: readonly string[];
}

export const MARKET_IDENTITY_METADATA_KEY = 'marketIdentity';

const MARKET_INDEX_METADATA_KEYS = ['marketIndex', 'driftMarketIndex', 'venueMarketIndex'] as const;
const MARKET_KEY_METADATA_KEYS = ['marketKey', 'driftMarketKey', 'venueMarketKey'] as const;
const MARKET_SYMBOL_METADATA_KEYS = [
  'marketSymbol',
  'driftMarketSymbol',
  'venueMarketSymbol',
  'marketName',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function metadataString(
  metadata: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = stringValue(metadata[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function metadataInteger(
  metadata: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = integerValue(metadata[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function normalizeCanonicalMarketType(value: unknown): CanonicalMarketType {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  switch (value.trim().toLowerCase()) {
    case 'perp':
    case 'perpetual':
      return 'perp';
    case 'spot':
      return 'spot';
    default:
      return 'unknown';
  }
}

export function canonicalMarketIndexKey(
  marketType: CanonicalMarketType,
  marketIndex: number | null,
): string | null {
  if (marketType === 'unknown' || marketIndex === null) {
    return null;
  }

  return `${marketType}:${marketIndex}`;
}

export function canonicalMarketSymbolKey(
  marketType: CanonicalMarketType,
  marketSymbol: string | null,
): string | null {
  if (marketSymbol === null) {
    return null;
  }

  return marketType === 'unknown' ? marketSymbol : `${marketType}:${marketSymbol}`;
}

export function canonicalAssetTypeKey(
  marketType: CanonicalMarketType,
  asset: string | null,
): string | null {
  if (marketType === 'unknown' || asset === null) {
    return null;
  }

  return `${marketType}:${asset}`;
}

export function parseMarketIndexFromKey(marketKey: string | null): number | null {
  if (marketKey === null) {
    return null;
  }

  const match = /^(?:perp|spot):(\d+)$/.exec(marketKey);
  if (match === null) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function deriveMarketSymbol(
  asset: string | null,
  marketType: CanonicalMarketType,
): string | null {
  if (asset === null || marketType === 'unknown') {
    return null;
  }

  return marketType === 'perp' ? `${asset}-PERP` : asset;
}

function uniqueAliases(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    if (value === null || seen.has(value)) {
      continue;
    }
    seen.add(value);
    aliases.push(value);
  }
  return aliases;
}

function normalizeConfidence(input: {
  marketType: CanonicalMarketType;
  marketIndex: number | null;
  marketKey: string | null;
  marketSymbol: string | null;
  asset: string | null;
  provenance: CanonicalMarketIdentityProvenance;
}): {
  confidence: CanonicalMarketIdentityConfidence;
  normalizedKey: string | null;
  normalizedKeyType: CanonicalMarketIdentityKeyType;
} {
  if (input.provenance === 'unsupported') {
    return {
      confidence: 'unsupported',
      normalizedKey: null,
      normalizedKeyType: 'unsupported',
    };
  }

  if (input.marketIndex !== null && input.marketType !== 'unknown') {
    return {
      confidence: 'exact',
      normalizedKey: canonicalMarketIndexKey(input.marketType, input.marketIndex),
      normalizedKeyType: 'market_index',
    };
  }

  if (input.marketKey !== null) {
    return {
      confidence: 'exact',
      normalizedKey: input.marketKey,
      normalizedKeyType: 'market_key',
    };
  }

  if (input.marketSymbol !== null) {
    return {
      confidence: input.provenance === 'venue_native' ? 'exact' : 'partial',
      normalizedKey: canonicalMarketSymbolKey(input.marketType, input.marketSymbol),
      normalizedKeyType: 'market_symbol',
    };
  }

  if (input.marketType !== 'unknown' && input.asset !== null) {
    return {
      confidence: 'partial',
      normalizedKey: canonicalAssetTypeKey(input.marketType, input.asset),
      normalizedKeyType: 'asset_market_type',
    };
  }

  return {
    confidence: 'unsupported',
    normalizedKey: null,
    normalizedKeyType: 'unsupported',
  };
}

export function createCanonicalMarketIdentity(
  input: CanonicalMarketIdentityInput,
): CanonicalMarketIdentity {
  const asset = stringValue(input.asset) ?? null;
  const marketType = normalizeCanonicalMarketType(input.marketType);
  const rawMarketKey = stringValue(input.marketKey) ?? null;
  const marketIndex = integerValue(input.marketIndex) ?? parseMarketIndexFromKey(rawMarketKey);
  const marketKey = rawMarketKey ?? canonicalMarketIndexKey(marketType, marketIndex);
  const marketName = stringValue(input.marketName) ?? null;
  const marketSymbol = stringValue(input.marketSymbol) ?? marketName ?? deriveMarketSymbol(asset, marketType);
  const provenance = input.provenance ?? 'derived';
  const normalized = normalizeConfidence({
    marketType,
    marketIndex,
    marketKey,
    marketSymbol,
    asset,
    provenance,
  });

  return {
    venueId: stringValue(input.venueId) ?? null,
    asset,
    marketType,
    marketIndex,
    marketKey,
    marketSymbol,
    marketName,
    aliases: uniqueAliases([
      ...(input.aliases ?? []),
      marketSymbol,
      marketKey,
      canonicalAssetTypeKey(marketType, asset),
    ]),
    normalizedKey: normalized.normalizedKey,
    normalizedKeyType: normalized.normalizedKeyType,
    provenance,
    confidence: normalized.confidence,
    capturedAtStage: input.capturedAtStage,
    source: input.source,
    notes: [...(input.notes ?? [])],
  };
}

export function captureCanonicalMarketIdentity(
  identity: CanonicalMarketIdentity,
  input: {
    capturedAtStage: CanonicalMarketIdentityCaptureStage;
    source?: string;
    notes?: readonly string[];
  },
): CanonicalMarketIdentity {
  return {
    ...identity,
    capturedAtStage: input.capturedAtStage,
    source: input.source ?? identity.source,
    notes: input.notes === undefined ? identity.notes : [...input.notes],
  };
}

function marketIdentityRank(identity: CanonicalMarketIdentity | null): number {
  if (identity === null) {
    return -1;
  }

  switch (identity.normalizedKeyType) {
    case 'market_index':
      return 400;
    case 'market_key':
      return 300;
    case 'market_symbol':
      return identity.confidence === 'exact' ? 250 : 150;
    case 'asset_market_type':
      return 100;
    case 'unsupported':
      return 0;
  }
}

export function preferCanonicalMarketIdentity(
  left: CanonicalMarketIdentity | null,
  right: CanonicalMarketIdentity | null,
): CanonicalMarketIdentity | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }

  const leftRank = marketIdentityRank(left);
  const rightRank = marketIdentityRank(right);
  if (rightRank > leftRank) {
    return right;
  }
  if (leftRank > rightRank) {
    return left;
  }

  if (left.provenance !== 'venue_native' && right.provenance === 'venue_native') {
    return right;
  }
  if (left.provenance === 'venue_native' && right.provenance !== 'venue_native') {
    return left;
  }

  return right;
}

export function readCanonicalMarketIdentityFromMetadata(
  metadata: Record<string, unknown>,
  defaults: CanonicalMarketIdentityMetadataDefaults,
): CanonicalMarketIdentity | null {
  const structured = asRecord(metadata[MARKET_IDENTITY_METADATA_KEY]);
  if (structured !== null) {
    return createCanonicalMarketIdentity({
      venueId: stringValue(structured['venueId']) ?? defaults.venueId ?? null,
      asset: stringValue(structured['asset']) ?? defaults.asset ?? null,
      marketType: structured['marketType'] ?? defaults.marketType,
      marketIndex: integerValue(structured['marketIndex']),
      marketKey: stringValue(structured['marketKey']),
      marketSymbol: stringValue(structured['marketSymbol']),
      marketName: stringValue(structured['marketName']),
      aliases: Array.isArray(structured['aliases'])
        ? structured['aliases'].filter((value): value is string => typeof value === 'string')
        : [],
      capturedAtStage: (
        structured['capturedAtStage'] === 'market_data'
        || structured['capturedAtStage'] === 'opportunity_leg'
        || structured['capturedAtStage'] === 'strategy_intent'
        || structured['capturedAtStage'] === 'runtime_order'
        || structured['capturedAtStage'] === 'carry_planned_order'
        || structured['capturedAtStage'] === 'carry_execution_step'
        || structured['capturedAtStage'] === 'execution_result'
        || structured['capturedAtStage'] === 'fill'
        || structured['capturedAtStage'] === 'internal_snapshot'
        || structured['capturedAtStage'] === 'external_truth'
      )
        ? structured['capturedAtStage']
        : defaults.capturedAtStage,
      source: stringValue(structured['source']) ?? defaults.source,
      ...(Array.isArray(structured['notes'])
        ? {
          notes: structured['notes'].filter((value): value is string => typeof value === 'string'),
        }
        : defaults.notes === undefined
          ? {}
          : { notes: defaults.notes }),
      ...(((
        structured['provenance'] === 'venue_native'
        || structured['provenance'] === 'derived'
        || structured['provenance'] === 'unsupported'
      )
        ? structured['provenance']
        : defaults.provenance) === undefined
        ? {}
        : {
          provenance: (
            structured['provenance'] === 'venue_native'
            || structured['provenance'] === 'derived'
            || structured['provenance'] === 'unsupported'
          )
            ? structured['provenance']
            : defaults.provenance,
        }),
    });
  }

  const legacyMarketIndex = metadataInteger(metadata, MARKET_INDEX_METADATA_KEYS);
  const legacyMarketKey = metadataString(metadata, MARKET_KEY_METADATA_KEYS);
  const legacyMarketSymbol = metadataString(metadata, MARKET_SYMBOL_METADATA_KEYS);
  if (legacyMarketIndex === null && legacyMarketKey === null && legacyMarketSymbol === null) {
    return null;
  }

  return createCanonicalMarketIdentity({
    venueId: defaults.venueId ?? null,
    asset: defaults.asset ?? null,
    marketType: defaults.marketType,
    marketIndex: legacyMarketIndex,
    marketKey: legacyMarketKey,
    marketSymbol: legacyMarketSymbol,
    marketName: metadataString(metadata, ['marketName']),
    provenance: defaults.provenance ?? 'derived',
    capturedAtStage: defaults.capturedAtStage,
    source: defaults.source,
    ...(defaults.notes === undefined ? {} : { notes: defaults.notes }),
  });
}

export function attachCanonicalMarketIdentityToMetadata(
  metadata: Readonly<Record<string, unknown>>,
  identity: CanonicalMarketIdentity | null,
): Record<string, unknown> {
  const nextMetadata: Record<string, unknown> = {
    ...metadata,
  };

  if (identity === null) {
    return nextMetadata;
  }

  nextMetadata[MARKET_IDENTITY_METADATA_KEY] = {
    venueId: identity.venueId,
    asset: identity.asset,
    marketType: identity.marketType,
    marketIndex: identity.marketIndex,
    marketKey: identity.marketKey,
    marketSymbol: identity.marketSymbol,
    marketName: identity.marketName,
    aliases: identity.aliases,
    normalizedKey: identity.normalizedKey,
    normalizedKeyType: identity.normalizedKeyType,
    provenance: identity.provenance,
    confidence: identity.confidence,
    capturedAtStage: identity.capturedAtStage,
    source: identity.source,
    notes: identity.notes,
  } satisfies CanonicalMarketIdentity;

  if (identity.marketIndex !== null) {
    nextMetadata['marketIndex'] = identity.marketIndex;
  }
  if (identity.marketKey !== null) {
    nextMetadata['marketKey'] = identity.marketKey;
  }
  if (identity.marketSymbol !== null) {
    nextMetadata['marketSymbol'] = identity.marketSymbol;
  }
  if (identity.marketName !== null) {
    nextMetadata['marketName'] = identity.marketName;
  }
  if (identity.marketType !== 'unknown') {
    nextMetadata['marketType'] = identity.marketType;
  }

  return nextMetadata;
}
