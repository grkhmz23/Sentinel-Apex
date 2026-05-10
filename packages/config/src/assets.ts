import { z } from 'zod';

export const VaultBaseAssetEnum = z.enum(['USDC', 'PUSD']);
export type VaultBaseAsset = z.infer<typeof VaultBaseAssetEnum>;

export interface StablecoinAssetConfig {
  symbol: VaultBaseAsset;
  mint: string | null;
  decimals: number;
}

export interface VaultAssetConfig {
  baseAsset: StablecoinAssetConfig;
  supportedAssets: StablecoinAssetConfig[];
}

export function isSolanaPublicKey(value: string): boolean {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const trimmed = value.trim();
  if (trimmed !== value || trimmed.length < 32 || trimmed.length > 44) {
    return false;
  }
  const bytes = [0];
  for (const char of trimmed) {
    const valueIndex = alphabet.indexOf(char);
    if (valueIndex < 0) {
      return false;
    }
    let carry = valueIndex;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += (bytes[index] ?? 0) * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of trimmed) {
    if (char !== '1') {
      break;
    }
    bytes.push(0);
  }
  return bytes.length === 32;
}

export function buildVaultAssetConfig(input: {
  VAULT_BASE_ASSET?: VaultBaseAsset;
  USDC_MINT?: string;
  USDC_DECIMALS?: number;
  PUSD_MINT?: string;
  PUSD_DECIMALS?: number;
}): VaultAssetConfig {
  const baseAsset = input.VAULT_BASE_ASSET ?? 'USDC';
  if (baseAsset === 'PUSD') {
    if (input.PUSD_MINT === undefined || input.PUSD_MINT.trim() === '') {
      throw new Error('PUSD_MINT is required when VAULT_BASE_ASSET=PUSD');
    }
    if (!isSolanaPublicKey(input.PUSD_MINT)) {
      throw new Error('PUSD_MINT must be a valid Solana public key');
    }
    if (
      input.PUSD_DECIMALS === undefined ||
      !Number.isSafeInteger(input.PUSD_DECIMALS) ||
      input.PUSD_DECIMALS < 0 ||
      input.PUSD_DECIMALS > 18
    ) {
      throw new Error('PUSD_DECIMALS is required as a safe integer between 0 and 18 when VAULT_BASE_ASSET=PUSD');
    }
  }

  const usdc: StablecoinAssetConfig = {
    symbol: 'USDC',
    mint: input.USDC_MINT ?? null,
    decimals: input.USDC_DECIMALS ?? 6,
  };
  const pusd: StablecoinAssetConfig = {
    symbol: 'PUSD',
    mint: input.PUSD_MINT ?? null,
    decimals: input.PUSD_DECIMALS ?? 0,
  };

  return {
    baseAsset: baseAsset === 'PUSD' ? pusd : usdc,
    supportedAssets: [usdc, pusd],
  };
}
