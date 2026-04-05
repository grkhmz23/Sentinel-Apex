// =============================================================================
// CEX (Centralized Exchange) Trade Import Schema
// For hackathon verification of trades executed on CEXs
// =============================================================================

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Supported CEX platforms
export const CEX_PLATFORMS = ['binance', 'okx', 'bybit', 'coinbase'] as const;
export type CexPlatform = typeof CEX_PLATFORMS[number];

// Import status tracking
export const CEX_IMPORT_STATUSES = [
  'pending',      // Upload received, not yet processed
  'parsing',      // CSV being parsed
  'validating',   // Trades being validated
  'calculating',  // PnL being calculated
  'completed',    // Import successful
  'failed',       // Import failed
  'rejected',     // Validation failed (e.g., data mismatch)
] as const;
export type CexImportStatus = typeof CEX_IMPORT_STATUSES[number];

// API key verification status
export const CEX_API_KEY_STATUSES = [
  'unverified',
  'verifying',
  'verified',
  'invalid',
  'expired',
] as const;
export type CexApiKeyStatus = typeof CEX_API_KEY_STATUSES[number];

// Main table for CEX trade imports
export const cexTradeImports = pgTable('cex_trade_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Import metadata
  sleeveId: text('sleeve_id').notNull(),
  strategyId: text('strategy_id').notNull(),
  venueId: text('venue_id'), // Link to internal venue if applicable
  
  // Source information
  platform: text('platform').notNull(), // binance, okx, bybit, coinbase
  importType: text('import_type').notNull().default('csv'), // csv, api
  
  // File/metadata info
  originalFilename: text('original_filename'),
  fileHash: text('file_hash'), // SHA256 of uploaded file
  fileSizeBytes: integer('file_size_bytes'),
  
  // Processing status
  status: text('status').notNull().default('pending'),
  statusMessage: text('status_message'), // Human-readable status/error
  
  // Validation results
  validationPassed: boolean('validation_passed'),
  validationErrors: jsonb('validation_errors'), // Array of error messages
  
  // Statistics
  totalRowsParsed: integer('total_rows_parsed'),
  validTradesCount: integer('valid_trades_count'),
  invalidTradesCount: integer('invalid_trades_count'),
  
  // PnL summary (denormalized for quick access)
  realizedPnlUsd: text('realized_pnl_usd'),
  totalFeesUsd: text('total_fees_usd'),
  totalVolumeUsd: text('total_volume_usd'),
  
  // Time range of imported trades
  firstTradeAt: timestamp('first_trade_at', { withTimezone: true }),
  lastTradeAt: timestamp('last_trade_at', { withTimezone: true }),
  
  // Cross-validation
  crossValidated: boolean('cross_validated').default(false),
  crossValidationResult: jsonb('cross_validation_result'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // Audit
  createdBy: text('created_by'), // User/operator who initiated import
  metadata: jsonb('metadata'), // Additional platform-specific data
});

// Individual imported trades
export const cexImportedTrades = pgTable('cex_imported_trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  importId: uuid('import_id').notNull().references(() => cexTradeImports.id),
  
  // Trade identification
  tradeId: text('trade_id').notNull(), // Original exchange trade ID
  orderId: text('order_id'), // Original exchange order ID
  
  // Trade details
  platform: text('platform').notNull(),
  symbol: text('symbol').notNull(), // e.g., "BTCUSDT"
  asset: text('asset').notNull(), // e.g., "BTC"
  quoteAsset: text('quote_asset'), // e.g., "USDT"
  
  // Side and type
  side: text('side').notNull(), // buy, sell
  type: text('type'), // market, limit, etc.
  
  // Quantities
  quantity: text('quantity').notNull(), // Base asset amount
  price: text('price').notNull(), // Execution price
  quoteQuantity: text('quote_quantity'), // Quote asset amount
  
  // Fees
  fee: text('fee'),
  feeAsset: text('fee_asset'), // Asset in which fee was paid
  
  // PnL (for closing trades)
  realizedPnl: text('realized_pnl'),
  
  // Timestamps
  tradeTime: timestamp('trade_time', { withTimezone: true }).notNull(),
  
  // Validation
  isValid: boolean('is_valid').notNull().default(true),
  validationErrors: jsonb('validation_errors'),
  
  // Cross-reference to internal system
  internalFillId: text('internal_fill_id'), // If matched to internal record
  crossValidatedAt: timestamp('cross_validated_at', { withTimezone: true }),
  
  // Raw data
  rawData: jsonb('raw_data').notNull(), // Original row data from CSV/API
  
  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// API key verification for CEX accounts
export const cexApiCredentials = pgTable('cex_api_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Account identification
  sleeveId: text('sleeve_id').notNull(),
  venueId: text('venue_id'), // Internal venue mapping
  
  // Platform
  platform: text('platform').notNull(),
  
  // API credentials (encrypted in practice)
  apiKey: text('api_key').notNull(),
  apiSecret: text('api_secret').notNull(), // Should be encrypted
  passphrase: text('passphrase'), // For OKX and some other exchanges
  
  // Verification status
  status: text('status').notNull().default('unverified'),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  verificationResult: jsonb('verification_result'),
  
  // Permissions verification
  canReadTrades: boolean('can_read_trades').default(false),
  canReadBalances: boolean('can_read_balances').default(false),
  isReadOnly: boolean('is_read_only').default(true), // Must be read-only for safety
  
  // Account info from exchange
  accountId: text('account_id'), // Exchange's account ID
  accountType: text('account_type'), // spot, margin, futures, etc.
  
  // Metadata
  label: text('label'), // User-provided label
  isActive: boolean('is_active').default(true),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  
  // Audit
  createdBy: text('created_by'),
  metadata: jsonb('metadata'),
});

// Cross-validation results between CEX imports and internal signals
export const cexCrossValidations = pgTable('cex_cross_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  importId: uuid('import_id').notNull().references(() => cexTradeImports.id),
  
  // What was validated
  validationType: text('validation_type').notNull(), // timestamp, price, size, etc.
  
  // Internal reference
  internalSignalId: text('internal_signal_id'),
  internalFillId: text('internal_fill_id'),
  
  // CEX reference
  importedTradeId: uuid('imported_trade_id').references(() => cexImportedTrades.id),
  
  // Comparison data
  internalValue: text('internal_value'),
  cexValue: text('cex_value'),
  difference: text('difference'),
  differencePct: text('difference_pct'),
  
  // Result
  isMatch: boolean('is_match').notNull(),
  toleranceUsed: text('tolerance_used'), // e.g., "1%" for price, "1s" for time
  
  // Details
  details: jsonb('details'),
  
  // Timestamp
  validatedAt: timestamp('validated_at', { withTimezone: true }).notNull().defaultNow(),
});

// PnL calculation snapshots for imported trades
export const cexPnlSnapshots = pgTable('cex_pnl_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  importId: uuid('import_id').notNull().references(() => cexTradeImports.id),
  
  // Snapshot metadata
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  calculationMethod: text('calculation_method').notNull(), // fifo, lifo, avg
  
  // Asset breakdown (JSON for flexibility)
  assetBreakdown: jsonb('asset_breakdown'), // { "BTC": { trades: 10, realizedPnl: "..." }, ... }
  
  // Overall summary
  totalRealizedPnlUsd: text('total_realized_pnl_usd'),
  totalFeesUsd: text('total_fees_usd'),
  netPnlUsd: text('net_pnl_usd'),
  
  // Period stats
  tradeCount: integer('trade_count'),
  winningTrades: integer('winning_trades'),
  losingTrades: integer('losing_trades'),
  winRatePct: text('win_rate_pct'),
  
  // Average metrics
  avgTradeSizeUsd: text('avg_trade_size_usd'),
  avgFeeUsd: text('avg_fee_usd'),
  
  // Metadata
  metadata: jsonb('metadata'),
});
