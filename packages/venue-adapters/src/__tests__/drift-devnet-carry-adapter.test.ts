import {
  BN,
  MarketType,
  PositionDirection,
  configs,
  getUserAccountPublicKeySync,
} from '@drift-labs/sdk';
import { Keypair, PublicKey } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import { DriftDevnetCarryAdapter } from '../real/drift-devnet-carry-adapter.js';

describe('DriftDevnetCarryAdapter', () => {
  it('reports execution-capable devnet scope with explicit missing prerequisites when signing config is absent', async () => {
    const adapter = new DriftDevnetCarryAdapter({
      rpcEndpoint: '',
      driftEnv: 'devnet',
    });

    const capability = await adapter.getVenueCapabilitySnapshot();
    const carryCapabilities = await adapter.getCarryCapabilities();

    expect(capability.connectorType).toBe('drift_native_devnet_execution');
    expect(capability.truthMode).toBe('real');
    expect(capability.executionSupport).toBe(true);
    expect(capability.readOnlySupport).toBe(true);
    expect(capability.onboardingState).toBe('read_only');
    expect(capability.missingPrerequisites.some((item) => item.includes('DRIFT_RPC_ENDPOINT'))).toBe(true);
    expect(capability.missingPrerequisites.some((item) => item.includes('DRIFT_PRIVATE_KEY'))).toBe(true);
    expect(capability.metadata['executionPosture']).toBe('devnet_execution_capable');
    expect(carryCapabilities.supportsIncreaseExposure).toBe(true);
    expect(carryCapabilities.supportsReduceExposure).toBe(true);
    expect(carryCapabilities.metadata['supportedExecutionScope']).toContain(
      'BTC-PERP market orders that can open, add to, or reduce a single live perp position',
    );
  });

  it('returns connectivity-only truth until the execution authority key is configured', async () => {
    const adapter = new DriftDevnetCarryAdapter({
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'devnet',
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
    });

    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(snapshot.snapshotSuccessful).toBe(true);
    expect(snapshot.snapshotType).toBe('drift_devnet_execution_connectivity');
    expect(snapshot.snapshotCompleteness).toBe('minimal');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativePositionState.reason).toContain('DRIFT_PRIVATE_KEY');
    expect(snapshot.sourceMetadata.connectorDepth).toBe('execution_capable');
    expect(snapshot.metadata['executionPosture']).toBe('devnet_execution_capable');
  });

  it('submits a real reduce-only devnet order and returns the signature as the execution reference', async () => {
    const keypair = Keypair.generate();
    const placePerpOrder = vi.fn().mockResolvedValue('devnet-sig-1');
    const adapter = new DriftDevnetCarryAdapter({
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'devnet',
      privateKey: JSON.stringify(Array.from(keypair.secretKey)),
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
      createDriftClient: () => ({
        program: {} as never,
        subscribe: vi.fn().mockResolvedValue(true),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        getPerpMarketAccount: vi.fn(),
        getOracleDataForPerpMarket: vi.fn(),
        getUserAccount: vi.fn().mockReturnValue({
          perpPositions: [{
            marketIndex: 1,
            baseAssetAmount: new BN('20000000'),
          }],
        }),
        placePerpOrder,
      }) as never,
    });

    const result = await adapter.placeOrder({
      clientOrderId: 'carry-reduce-1',
      asset: 'BTC',
      side: 'sell',
      type: 'market',
      size: '0.010000000',
      reduceOnly: true,
    });

    expect(result.venueOrderId).toBe('devnet-sig-1');
    expect(result.executionReference).toBe('devnet-sig-1');
    expect(result.executionMode).toBe('real');
    expect(result.status).toBe('submitted');

    const cached = await adapter.getOrder('devnet-sig-1');
    expect(cached?.executionReference).toBe('devnet-sig-1');
    expect(cached?.executionMode).toBe('real');

    const retried = await adapter.placeOrder({
      clientOrderId: 'carry-reduce-1',
      asset: 'BTC',
      side: 'sell',
      type: 'market',
      size: '0.010000000',
      reduceOnly: true,
    });

    expect(retried.venueOrderId).toBe('devnet-sig-1');
    expect(retried.executionReference).toBe('devnet-sig-1');
    expect(placePerpOrder).toHaveBeenCalledTimes(1);
  });

  it('submits a real non-reduce-only devnet order for BTC-PERP exposure increases', async () => {
    const keypair = Keypair.generate();
    const placePerpOrder = vi.fn().mockResolvedValue('devnet-sig-open-1');
    const adapter = new DriftDevnetCarryAdapter({
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'devnet',
      privateKey: JSON.stringify(Array.from(keypair.secretKey)),
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
      createDriftClient: () => ({
        program: {} as never,
        subscribe: vi.fn().mockResolvedValue(true),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        getPerpMarketAccount: vi.fn(),
        getOracleDataForPerpMarket: vi.fn(),
        getUserAccount: vi.fn().mockReturnValue({
          perpPositions: [],
        }),
        placePerpOrder,
      }) as never,
    });

    const result = await adapter.placeOrder({
      clientOrderId: 'carry-open-1',
      asset: 'BTC',
      side: 'buy',
      type: 'market',
      size: '0.010000000',
      reduceOnly: false,
    });

    expect(result.venueOrderId).toBe('devnet-sig-open-1');
    expect(result.executionReference).toBe('devnet-sig-open-1');
    expect(result.executionMode).toBe('real');
    expect(placePerpOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        reduceOnly: false,
        direction: expect.any(Object),
      }),
      undefined,
      0,
    );
  });

  it('rejects non-reduce-only orders that would cross an opposite-side BTC-PERP position', async () => {
    const keypair = Keypair.generate();
    const adapter = new DriftDevnetCarryAdapter({
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'devnet',
      privateKey: JSON.stringify(Array.from(keypair.secretKey)),
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
      createDriftClient: () => ({
        program: {} as never,
        subscribe: vi.fn().mockResolvedValue(true),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        getPerpMarketAccount: vi.fn(),
        getOracleDataForPerpMarket: vi.fn(),
        getUserAccount: vi.fn().mockReturnValue({
          perpPositions: [{
            marketIndex: 1,
            baseAssetAmount: new BN('-20000000'),
          }],
        }),
        placePerpOrder: vi.fn(),
      }) as never,
    });

    await expect(adapter.placeOrder({
      clientOrderId: 'carry-open-2',
      asset: 'BTC',
      side: 'buy',
      type: 'market',
      size: '0.010000000',
      reduceOnly: false,
    })).rejects.toThrow('cannot cross the current short BTC-PERP position');
  });

  it('correlates strong Drift fill events and suppresses duplicate raw fill records', async () => {
    const keypair = Keypair.generate();
    const accountAddress = getUserAccountPublicKeySync(
      new PublicKey(configs.devnet.DRIFT_PROGRAM_ID),
      keypair.publicKey,
      0,
    );
    const orderRecord = {
      eventType: 'OrderRecord',
      txSig: 'devnet-sig-1',
      txSigIndex: 0,
      slot: 1,
      ts: new BN('1710000000'),
      user: accountAddress,
      order: {
        marketType: MarketType.PERP,
        marketIndex: 1,
        reduceOnly: true,
        direction: PositionDirection.SHORT,
        baseAssetAmount: new BN('10000000'),
        baseAssetAmountFilled: new BN('10000000'),
        quoteAssetAmountFilled: new BN('500000000'),
        orderId: 101,
        userOrderId: 7,
      },
    } as never;
    const fillEvent = {
      eventType: 'OrderActionRecord',
      txSig: 'devnet-sig-1',
      txSigIndex: 1,
      slot: 1,
      ts: new BN('1710000001'),
      action: { fill: {} },
      actionExplanation: { orderFilledWithAmm: {} },
      marketIndex: 1,
      marketType: MarketType.PERP,
      fillRecordId: new BN('501'),
      baseAssetAmountFilled: new BN('10000000'),
      quoteAssetAmountFilled: new BN('500000000'),
      taker: accountAddress,
      takerOrderId: 101,
      takerOrderDirection: PositionDirection.SHORT,
      maker: null,
      makerOrderId: null,
    } as never;
    const duplicateFillEvent = {
      ...fillEvent,
      txSigIndex: 2,
    } as never;
    const adapter = new DriftDevnetCarryAdapter({
      rpcEndpoint: 'https://rpc.example.test',
      driftEnv: 'devnet',
      privateKey: JSON.stringify(Array.from(keypair.secretKey)),
    }, {
      createConnection: () => ({
        getVersion: vi.fn().mockResolvedValue({ 'solana-core': '1.18.0' }),
      }) as never,
      createDriftClient: () => ({
        program: {} as never,
        subscribe: vi.fn().mockResolvedValue(true),
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        getPerpMarketAccount: vi.fn(),
        getOracleDataForPerpMarket: vi.fn(),
        getUserAccount: vi.fn().mockReturnValue({
          perpPositions: [{
            marketIndex: 1,
            baseAssetAmount: new BN('20000000'),
          }],
        }),
        placePerpOrder: vi.fn().mockResolvedValue('devnet-sig-1'),
      }) as never,
      createEventSubscriber: () => ({
        currentProviderType: 'websocket',
        subscribe: vi.fn().mockResolvedValue(true),
        unsubscribe: vi.fn().mockResolvedValue(true),
        fetchPreviousTx: vi.fn().mockResolvedValue(undefined),
        awaitTx: vi.fn().mockResolvedValue(undefined),
        getEventsByTx: vi.fn().mockReturnValue([orderRecord, fillEvent, duplicateFillEvent]),
      }),
    });

    await adapter.placeOrder({
      clientOrderId: 'carry-reduce-1',
      asset: 'BTC',
      side: 'sell',
      type: 'market',
      size: '0.010000000',
      reduceOnly: true,
    });

    const [evidence] = await adapter.getExecutionEventEvidence?.([{
      executionReference: 'devnet-sig-1',
      clientOrderId: 'carry-reduce-1',
      asset: 'BTC',
      side: 'sell',
      requestedSize: '0.010000000',
      reduceOnly: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]) ?? [];

    expect(evidence).toBeDefined();
    expect(evidence?.correlationStatus).toBe('event_matched_strong');
    expect(evidence?.deduplicationStatus).toBe('duplicate_event');
    expect(evidence?.duplicateEventCount).toBe(1);
    expect(evidence?.fillBaseAssetAmount).toBe('0.01');
    expect(evidence?.rawEventCount).toBe(2);
  });
});
