/**
 * Ranger Vault Integration Schema
 * 
 * Database schema for Ranger Earn vault on-chain state and submission verification.
 */

import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { vaultCurrent, vaultDepositLots, vaultRedemptionRequests, vaultSubmissionProfiles } from './vault.js';

// =============================================================================
// On-Chain Vault Addresses
// =============================================================================

export const vaultOnChainAddresses = pgTable(
  'vault_on_chain_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: text('vault_id')
      .notNull()
      .references(() => vaultCurrent.id),
    chain: text('chain').notNull().default('solana'),
    vaultAddress: text('vault_address').notNull(),
    vaultProgramId: text('vault_program_id'),
    shareTokenMint: text('share_token_mint'),
    strategyProgramId: text('strategy_program_id'),
    authorityAddress: text('authority_address').notNull(),
    creationSignature: text('creation_signature'),
    creationBlockTime: timestamp('creation_block_time', { withTimezone: true }),
    verificationStatus: text('verification_status').notNull().default('pending'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verificationNotes: text('verification_notes'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    vaultIdIdx: index('vault_on_chain_addresses_vault_id_idx').on(t.vaultId),
    vaultAddressIdx: index('vault_on_chain_addresses_vault_address_idx').on(t.vaultAddress),
    verificationStatusIdx: index('vault_on_chain_addresses_verification_status_idx').on(t.verificationStatus),
  }),
);

// =============================================================================
// Ranger Vault State
// =============================================================================

export const rangerVaultState = pgTable(
  'ranger_vault_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: text('vault_id')
      .notNull()
      .unique()
      .references(() => vaultCurrent.id),
    rangerVaultId: text('ranger_vault_id'),
    integrationMode: text('integration_mode').notNull().default('simulated'),
    sdkAvailable: boolean('sdk_available').notNull().default(false),
    factoryConfigured: boolean('factory_configured').notNull().default(false),
    strategyAdapterConfigured: boolean('strategy_adapter_configured').notNull().default(false),
    vaultStatus: text('vault_status').notNull().default('initializing'),
    totalShares: text('total_shares').notNull().default('0'),
    totalAum: text('total_aum').notNull().default('0'),
    sharePrice: text('share_price').notNull().default('1'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    syncError: text('sync_error'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    vaultIdIdx: index('ranger_vault_state_vault_id_idx').on(t.vaultId),
    integrationModeIdx: index('ranger_vault_state_integration_mode_idx').on(t.integrationMode),
    vaultStatusIdx: index('ranger_vault_state_vault_status_idx').on(t.vaultStatus),
  }),
);

// =============================================================================
// On-Chain Deposits
// =============================================================================

export const vaultOnChainDeposits = pgTable(
  'vault_on_chain_deposits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: text('vault_id')
      .notNull()
      .references(() => vaultCurrent.id),
    depositLotId: uuid('deposit_lot_id').references(() => vaultDepositLots.id),
    depositId: text('deposit_id').notNull(),
    depositorAddress: text('depositor_address').notNull(),
    amount: text('amount').notNull(),
    sharesMinted: text('shares_minted').notNull(),
    sharePrice: text('share_price').notNull(),
    lockExpiresAt: timestamp('lock_expires_at', { withTimezone: true }).notNull(),
    transactionSignature: text('transaction_signature').notNull(),
    blockTime: timestamp('block_time', { withTimezone: true }).notNull(),
    confirmationStatus: text('confirmation_status').notNull().default('confirmed'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    vaultIdIdx: index('vault_on_chain_deposits_vault_id_idx').on(t.vaultId),
    depositorIdx: index('vault_on_chain_deposits_depositor_idx').on(t.depositorAddress),
    signatureIdx: index('vault_on_chain_deposits_signature_idx').on(t.transactionSignature),
    blockTimeIdx: index('vault_on_chain_deposits_block_time_idx').on(t.blockTime),
  }),
);

// =============================================================================
// On-Chain Withdrawals
// =============================================================================

export const vaultOnChainWithdrawals = pgTable(
  'vault_on_chain_withdrawals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: text('vault_id')
      .notNull()
      .references(() => vaultCurrent.id),
    redemptionRequestId: uuid('redemption_request_id').references(() => vaultRedemptionRequests.id),
    withdrawalId: text('withdrawal_id').notNull(),
    shareholderAddress: text('shareholder_address').notNull(),
    sharesBurned: text('shares_burned').notNull(),
    amountReturned: text('amount_returned').notNull(),
    sharePrice: text('share_price').notNull(),
    transactionSignature: text('transaction_signature').notNull(),
    blockTime: timestamp('block_time', { withTimezone: true }).notNull(),
    confirmationStatus: text('confirmation_status').notNull().default('completed'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    vaultIdIdx: index('vault_on_chain_withdrawals_vault_id_idx').on(t.vaultId),
    shareholderIdx: index('vault_on_chain_withdrawals_shareholder_idx').on(t.shareholderAddress),
    signatureIdx: index('vault_on_chain_withdrawals_signature_idx').on(t.transactionSignature),
  }),
);

// =============================================================================
// Submission Verification
// =============================================================================

export const vaultSubmissionVerification = pgTable(
  'vault_submission_verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionProfileId: text('submission_profile_id')
      .notNull()
      .references(() => vaultSubmissionProfiles.id),
    verificationType: text('verification_type').notNull(),
    status: text('status').notNull().default('pending'),
    verificationData: jsonb('verification_data').notNull().default({}),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    verificationNotes: text('verification_notes'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdIdx: index('vault_submission_verification_profile_id_idx').on(t.submissionProfileId),
    verificationTypeIdx: index('vault_submission_verification_type_idx').on(t.verificationType),
    statusIdx: index('vault_submission_verification_status_idx').on(t.status),
  }),
);
