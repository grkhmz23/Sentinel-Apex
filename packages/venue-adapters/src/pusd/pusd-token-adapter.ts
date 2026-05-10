import { PublicKey, type Connection } from '@solana/web3.js';
import Decimal from 'decimal.js';

export type PusdTokenBalanceStatus = 'ok' | 'rpc_error' | 'invalid_input';

export interface PusdTokenBalance {
  owner: string;
  mint: string;
  decimals: number;
  rawAmount: string;
  amount: string;
  tokenAccountCount: number;
  status: PusdTokenBalanceStatus;
  errorMessage: string | null;
}

export interface PusdTokenReaderConfig {
  connection: Pick<Connection, 'getParsedTokenAccountsByOwner'>;
  ownerPublicKey: string;
  mintPublicKey: string;
  decimals: number;
}

function parsePublicKey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`${label} must be a valid Solana public key.`);
  }
}

function toDisplayAmount(rawAmount: bigint, decimals: number): string {
  const scale = new Decimal(10).pow(decimals);
  return new Decimal(rawAmount.toString()).div(scale).toFixed(decimals);
}

export class PusdTokenReader {
  constructor(private readonly config: PusdTokenReaderConfig) {}

  async readBalance(): Promise<PusdTokenBalance> {
    let owner: PublicKey;
    let mint: PublicKey;
    try {
      owner = parsePublicKey(this.config.ownerPublicKey, 'ownerPublicKey');
      mint = parsePublicKey(this.config.mintPublicKey, 'mintPublicKey');
      if (
        !Number.isSafeInteger(this.config.decimals) ||
        this.config.decimals < 0 ||
        this.config.decimals > 18
      ) {
        throw new Error('decimals must be a safe integer between 0 and 18.');
      }
    } catch (error) {
      return {
        owner: this.config.ownerPublicKey,
        mint: this.config.mintPublicKey,
        decimals: this.config.decimals,
        rawAmount: '0',
        amount: '0',
        tokenAccountCount: 0,
        status: 'invalid_input',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const response = await this.config.connection.getParsedTokenAccountsByOwner(owner, { mint });
      const rawAmount = response.value.reduce((sum, account) => {
        const parsed = account.account.data.parsed as {
          info?: { tokenAmount?: { amount?: string } };
        };
        const amount = parsed.info?.tokenAmount?.amount ?? '0';
        return sum + BigInt(amount);
      }, 0n);

      return {
        owner: owner.toBase58(),
        mint: mint.toBase58(),
        decimals: this.config.decimals,
        rawAmount: rawAmount.toString(),
        amount: toDisplayAmount(rawAmount, this.config.decimals),
        tokenAccountCount: response.value.length,
        status: 'ok',
        errorMessage: null,
      };
    } catch (error) {
      return {
        owner: owner.toBase58(),
        mint: mint.toBase58(),
        decimals: this.config.decimals,
        rawAmount: '0',
        amount: '0',
        tokenAccountCount: 0,
        status: 'rpc_error',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
