import { describe, expect, it, vi } from 'vitest';

import { SolanaRpcReadonlyTruthAdapter } from '../real/solana-rpc-readonly-truth-adapter.js';

describe('SolanaRpcReadonlyTruthAdapter', () => {
  it('reports real read-only capability and ingests account, balance, exposure, and reference truth', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: { 'solana-core': '1.18.0' },
        id: 'version',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          context: { slot: 123 },
          value: {
            data: ['AQIDBAUGBwg=', 'base64'],
            executable: false,
            lamports: 12_000_000_000,
            owner: 'drift-program',
            rentEpoch: 0,
            space: 512,
          },
        },
        id: 'account-info',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          context: { slot: 123 },
          value: 12_000_000_000,
        },
        id: 'balance',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          context: { slot: 123 },
          value: [{
            pubkey: 'token-account-1',
            account: {
              data: {
                parsed: {
                  info: {
                    mint: 'mint-1',
                    tokenAmount: {
                      amount: '2500000',
                      decimals: 6,
                      uiAmountString: '2.5',
                    },
                  },
                },
              },
            },
          }],
        },
        id: 'token-balances',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: [{
          signature: 'sig-1',
          slot: 124,
          blockTime: 1_711_884_000,
          confirmationStatus: 'confirmed',
          err: null,
          memo: null,
        }],
        id: 'signatures',
      }), { status: 200 }));

    const adapter = new SolanaRpcReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
      accountAddress: 'readonly-account',
      accountLabel: 'Treasury observation wallet',
    }, fetchImpl as typeof fetch);

    const capability = await adapter.getVenueCapabilitySnapshot();
    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(capability.truthMode).toBe('real');
    expect(capability.readOnlySupport).toBe(true);
    expect(capability.executionSupport).toBe(false);
    expect(snapshot.snapshotSuccessful).toBe(true);
    expect(snapshot.snapshotType).toBe('solana_rpc_account_state');
    expect(snapshot.snapshotCompleteness).toBe('partial');
    expect(snapshot.truthCoverage.accountState.status).toBe('available');
    expect(snapshot.truthCoverage.balanceState.status).toBe('available');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('partial');
    expect(snapshot.truthCoverage.derivativePositionState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativeHealthState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.orderState.status).toBe('partial');
    expect(snapshot.truthCoverage.executionReferences.status).toBe('available');
    expect(snapshot.accountState?.accountAddress).toBe('readonly-account');
    expect(snapshot.derivativeAccountState?.accountModel).toBe('program_account');
    expect(snapshot.derivativeAccountState?.decoded).toBe(false);
    expect(snapshot.derivativeAccountState?.rawDiscriminatorHex).toBe('0102030405060708');
    expect(snapshot.balanceState?.balances).toHaveLength(2);
    expect(snapshot.exposureState?.exposures).toHaveLength(2);
    expect(snapshot.derivativePositionState).toBeNull();
    expect(snapshot.derivativeHealthState).toBeNull();
    expect(snapshot.orderState?.referenceMode).toBe('recent_account_signatures');
    expect(snapshot.orderState?.openOrders[0]?.reference).toBe('sig-1');
    expect(snapshot.executionReferenceState?.references[0]?.reference).toBe('sig-1');
    expect(snapshot.payload['nativeBalanceSol']).toBe('12.000000000');
  });

  it('returns a minimal connectivity snapshot when no tracked account is configured', async () => {
    const adapter = new SolanaRpcReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
    }, vi.fn().mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: '2.0',
      result: { 'solana-core': '1.18.0' },
      id: 'version',
    }), { status: 200 })) as typeof fetch);

    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(snapshot.snapshotSuccessful).toBe(true);
    expect(snapshot.snapshotCompleteness).toBe('minimal');
    expect(snapshot.truthCoverage.accountState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.balanceState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativePositionState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.derivativeHealthState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.orderState.status).toBe('unsupported');
    expect(snapshot.executionReferenceState).toBeNull();
  });

  it('marks the snapshot degraded when one deeper RPC section fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: { 'solana-core': '1.18.0' },
        id: 'version',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          context: { slot: 123 },
          value: {
            data: ['AQIDBAUGBwg=', 'base64'],
            executable: false,
            lamports: 12_000_000_000,
            owner: 'drift-program',
            rentEpoch: 0,
            space: 512,
          },
        },
        id: 'account-info',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: {
          context: { slot: 123 },
          value: 12_000_000_000,
        },
        id: 'balance',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'token query failed',
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: '2.0',
        result: [],
        id: 'signatures',
      }), { status: 200 }));

    const adapter = new SolanaRpcReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
      accountAddress: 'readonly-account',
    }, fetchImpl as typeof fetch);

    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(snapshot.snapshotSuccessful).toBe(true);
    expect(snapshot.healthState).toBe('degraded');
    expect(snapshot.snapshotCompleteness).toBe('partial');
    expect(snapshot.truthCoverage.balanceState.status).toBe('partial');
    expect(snapshot.truthCoverage.derivativeAccountState.status).toBe('partial');
    expect(snapshot.truthCoverage.orderState.status).toBe('partial');
    expect(snapshot.errorMessage).toContain('token query failed');
  });

  it('persists unavailable truth honestly when RPC fetch fails', async () => {
    const adapter = new SolanaRpcReadonlyTruthAdapter({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      rpcEndpoint: 'https://rpc.example.test',
    }, vi.fn().mockRejectedValue(new Error('network unavailable')) as typeof fetch);

    const snapshot = await adapter.getVenueTruthSnapshot();

    expect(snapshot.snapshotSuccessful).toBe(false);
    expect(snapshot.healthState).toBe('unavailable');
    expect(snapshot.truthCoverage.derivativePositionState.status).toBe('unsupported');
    expect(snapshot.truthCoverage.orderState.status).toBe('unsupported');
    expect(snapshot.errorMessage).toContain('network unavailable');
  });
});
