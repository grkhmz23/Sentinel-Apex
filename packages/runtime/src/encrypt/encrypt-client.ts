import type {
  CreateEncryptedStrategyStateInput,
  EncryptedStrategyAdapterResult,
} from './types.js';

export interface EncryptClient {
  createEncryptedStrategyState(input: CreateEncryptedStrategyStateInput): EncryptedStrategyAdapterResult;
  getCiphertextStatus(ref: string): string;
}
