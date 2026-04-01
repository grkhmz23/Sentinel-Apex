import { describe, expect, it, vi } from 'vitest';

import { DriftReadonlyTruthAdapter } from '../real/drift-readonly-truth-adapter.js';

describe('DriftReadonlyTruthAdapter', () => {
  const VALID_ACCOUNT_ADDRESS = '11111111111111111111111111111111';

  it('remains read-only and capability-gated when no Drift account locator is configured', async () => {
    const adapter = new DriftReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'devnet',
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
    } as never);

    const capability = await adapter.getVenueCapabilitySnapshot();
    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(capability.connectorType).toBe('drift_native_readonly');
    expect(capability.readOnlySupport).toBe(true);
    expect(capability.executionSupport).toBe(false);
    expect(capability.metadata['executionPosture']).toBe('read_only');
    expect(capability.missingPrerequisites[0]).toContain('DRIFT_READONLY_ACCOUNT_ADDRESS');

    expect(snapshot.snapshotSuccessful).toBe(true);
    expect(snapshot.snapshotType).toBe('drift_native_connectivity');
    expect(snapshot.snapshotCompleteness).toBe('minimal');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativePositionState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativeHealthState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.orderState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.balanceState.status).toBe('unsupported');
    expect(snapshot.sourceMetadata.connectorDepth).toBe('drift_native_readonly');
  });

  it('returns rich typed Drift-native truth when decode succeeds', async () => {
    const adapter = new DriftReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'mainnet-beta',
      accountAddress: VALID_ACCOUNT_ADDRESS,
      accountLabel: 'Apex Carry',
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
      loadSnapshot: vi.fn().mockResolvedValue({
        accountLocatorMode: 'user_account_address',
        accountExists: true,
        observedSlot: '123',
        sourceMetadata: {
          sourceKind: 'adapter',
          sourceName: 'drift_native_readonly',
          connectorDepth: 'drift_native_readonly',
          commitment: 'confirmed',
          observedSlot: '123',
          observedScope: [
            'drift_user_account_lookup',
            'drift_user_account_decode',
            'drift_position_inventory',
            'drift_margin_health',
            'drift_open_orders',
            'recent_signatures',
          ],
          provenanceNotes: [
            'This connector is read-only and never signs or submits transactions.',
          ],
        },
        sectionErrors: {},
        accountState: {
          accountAddress: VALID_ACCOUNT_ADDRESS,
          accountLabel: 'Apex Carry',
          accountExists: true,
          ownerProgram: 'drift-program',
          executable: false,
          lamports: '12000000000',
          nativeBalanceDisplay: '12.000000000',
          observedSlot: '123',
          rentEpoch: '0',
          dataLength: 512,
        },
        exposureState: {
          exposures: [{
            exposureKey: `perp:0:${VALID_ACCOUNT_ADDRESS}`,
            exposureType: 'position',
            assetKey: 'BTC-PERP',
            quantity: '0.75',
            quantityDisplay: '0.75',
            accountAddress: VALID_ACCOUNT_ADDRESS,
          }],
          methodology: 'drift_position_inventory_exposure',
          provenance: {
            classification: 'derived',
            source: 'drift_sdk_margin_math',
            notes: ['Exposure rows were derived from decoded Drift position inventory.'],
          },
        },
        derivativeAccountState: {
          venue: 'drift-solana-readonly',
          accountAddress: VALID_ACCOUNT_ADDRESS,
          accountLabel: 'Apex Carry',
          accountExists: true,
          ownerProgram: 'drift-program',
          accountModel: 'program_account',
          venueAccountType: 'drift_user',
          decoded: true,
          authorityAddress: 'drift-authority',
          subaccountId: 0,
          userName: 'Apex Carry',
          delegateAddress: 'drift-delegate',
          marginMode: 'default',
          poolId: 0,
          marginTradingEnabled: true,
          openOrderCount: 2,
          openAuctionCount: 0,
          statusFlags: ['protected_maker'],
          observedSlot: '123',
          rpcVersion: '1.18.0',
          dataLength: 512,
          rawDiscriminatorHex: '0102030405060708',
          notes: ['Decoded directly from the Drift user account.'],
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: ['Values were decoded directly from the Drift user account.'],
          },
        },
        derivativePositionState: {
          positions: [{
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            positionType: 'perp',
            side: 'long',
            baseAssetAmount: '0.75',
            quoteAssetAmount: '-51250',
            entryPrice: '68333.333333',
            breakEvenPrice: '68400.000000',
            unrealizedPnlUsd: '950.250000',
            liquidationPrice: '52100.000000',
            positionValueUsd: '52125.000000',
            openOrders: 1,
            openBids: '0.10',
            openAsks: '0',
            metadata: {},
            provenance: {
              classification: 'mixed',
              source: 'drift_user_account_with_market_context',
              notes: ['Inventory is exact while valuation uses Drift SDK market context.'],
            },
          }],
          openPositionCount: 1,
          methodology: 'drift_user_account_with_market_context',
          notes: ['Perp and spot inventory was decoded from the Drift user account.'],
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: ['Inventory is exact venue-native state while valuation fields are SDK-derived.'],
          },
        },
        derivativeHealthState: {
          healthStatus: 'healthy',
          healthScore: 84,
          collateralUsd: '153450.250000',
          marginRatio: '0.2841',
          leverage: '2.1100',
          maintenanceMarginRequirementUsd: '18050.000000',
          initialMarginRequirementUsd: '26250.000000',
          freeCollateralUsd: '109150.250000',
          methodology: 'drift_sdk_margin_calculation',
          notes: ['Derived from decoded Drift user, market, and oracle state.'],
          provenance: {
            classification: 'derived',
            source: 'drift_sdk_margin_math',
            notes: ['All health and margin metrics are SDK-derived from venue-native state.'],
          },
        },
        orderState: {
          openOrderCount: 2,
          openOrders: [{
            marketIndex: 0,
            venueOrderId: '901',
            reference: '41',
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            marketType: 'perp',
            userOrderId: 41,
            side: 'buy',
            status: 'open',
            orderType: 'limit',
            price: '68000.000000',
            quantity: '0.100000000',
            reduceOnly: false,
            accountAddress: VALID_ACCOUNT_ADDRESS,
            slot: '123',
            placedAt: null,
            metadata: {},
            provenance: {
              classification: 'exact',
              source: 'drift_user_account_decode',
              notes: ['Open-order inventory was decoded directly from the Drift user account.'],
            },
          }],
          referenceMode: 'venue_open_orders',
          methodology: 'drift_user_account_open_orders',
          notes: ['Open-order inventory was decoded directly from the Drift user account.'],
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: ['Open-order inventory was decoded directly from the Drift user account.'],
          },
        },
        executionReferenceState: {
          referenceLookbackLimit: 10,
          references: [{
            referenceType: 'solana_signature',
            reference: 'sig-1',
            accountAddress: VALID_ACCOUNT_ADDRESS,
            slot: '123',
            blockTime: '2026-03-31T11:59:00.000Z',
            confirmationStatus: 'confirmed',
            errored: false,
            memo: null,
          }],
          oldestReferenceAt: '2026-03-31T11:59:00.000Z',
        },
        payload: {
          accountAddress: VALID_ACCOUNT_ADDRESS,
          openOrderCount: 2,
          openPositionCount: 1,
          healthScore: 84,
        },
        metadata: {
          driftEnv: 'mainnet-beta',
          commitment: 'confirmed',
        },
      }),
    } as never);

    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(snapshot.snapshotSuccessful).toBe(true);
    expect(snapshot.snapshotType).toBe('drift_native_user_account');
    expect(snapshot.snapshotCompleteness).toBe('complete');
    expect(snapshot.truthCoverage.balanceState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('available');
    expect(snapshot.truthCoverage.derivativePositionState.status).toBe('available');
    expect(snapshot.truthCoverage.derivativeHealthState.status).toBe('available');
    expect(snapshot.truthCoverage.orderState.status).toBe('available');
    expect(snapshot.truthCoverage.executionReferences.status).toBe('available');
    expect(snapshot.derivativeAccountState?.decoded).toBe(true);
    expect(snapshot.derivativePositionState?.positions[0]?.marketSymbol).toBe('BTC-PERP');
    expect(snapshot.derivativeHealthState?.healthScore).toBe(84);
    expect(snapshot.orderState?.referenceMode).toBe('venue_open_orders');
    expect(snapshot.executionReferenceState?.references[0]?.reference).toBe('sig-1');
  });

  it('keeps failures honest when Drift-native decode cannot complete', async () => {
    const adapter = new DriftReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
      accountAddress: VALID_ACCOUNT_ADDRESS,
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
      loadSnapshot: vi.fn().mockRejectedValue(new Error('market context unavailable')),
    } as never);

    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(snapshot.snapshotSuccessful).toBe(false);
    expect(snapshot.healthState).toBe('unavailable');
    expect(snapshot.snapshotType).toBe('drift_native_error');
    expect(snapshot.truthCoverage.balanceState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('partial');
    expect(snapshot.truthCoverage.derivativePositionState.status).toBe('partial');
    expect(snapshot.truthCoverage.derivativeHealthState.status).toBe('partial');
    expect(snapshot.truthCoverage.orderState.status).toBe('partial');
    expect(snapshot.errorMessage).toContain('market context unavailable');
  });
});
