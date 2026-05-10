import { describe, expect, it } from 'vitest';

import { PusdTokenReader } from '../pusd/pusd-token-adapter.js';

const owner = '11111111111111111111111111111111';
const mint = 'So11111111111111111111111111111111111111112';

function mockConnection(value: unknown[], error?: Error) {
  return {
    async getParsedTokenAccountsByOwner() {
      if (error !== undefined) {
        throw error;
      }
      return { value };
    },
  };
}

describe('PusdTokenReader', () => {
  it('returns zero for a missing token account', async () => {
    const reader = new PusdTokenReader({
      connection: mockConnection([]),
      ownerPublicKey: owner,
      mintPublicKey: mint,
      decimals: 6,
    });

    const result = await reader.readBalance();

    expect(result.status).toBe('ok');
    expect(result.rawAmount).toBe('0');
    expect(result.amount).toBe('0.000000');
    expect(result.tokenAccountCount).toBe(0);
  });

  it('returns a structured RPC error', async () => {
    const reader = new PusdTokenReader({
      connection: mockConnection([], new Error('rpc unavailable')),
      ownerPublicKey: owner,
      mintPublicKey: mint,
      decimals: 6,
    });

    const result = await reader.readBalance();

    expect(result.status).toBe('rpc_error');
    expect(result.errorMessage).toBe('rpc unavailable');
  });

  it('converts mocked balance using decimals', async () => {
    const reader = new PusdTokenReader({
      connection: mockConnection([
        {
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: { amount: '123450000' },
                },
              },
            },
          },
        },
      ]),
      ownerPublicKey: owner,
      mintPublicKey: mint,
      decimals: 6,
    });

    const result = await reader.readBalance();

    expect(result.status).toBe('ok');
    expect(result.rawAmount).toBe('123450000');
    expect(result.amount).toBe('123.450000');
  });
});
