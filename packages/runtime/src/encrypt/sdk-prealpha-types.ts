import type { EncryptSdkDemoEvidence, EncryptSdkDemoInput } from './types.js';

export interface EncryptSdkPreAlphaConfig {
  sdkMode: 'adapter' | 'sdk-prealpha';
  grpcEndpoint: string | null;
  programId: string | null;
  networkEncryptionPublicKey: string | null;
  sdkDemoAck: boolean;
  sdkStrict: boolean;
}

export interface EncryptSdkPreAlphaClient {
  isAvailable(): Promise<boolean>;
  createDemoInput(input: EncryptSdkDemoInput): Promise<EncryptSdkDemoEvidence>;
}

export type EncryptSdkCreateInputParams = {
  chain: number;
  inputs: Array<{
    ciphertextBytes: Uint8Array;
    fheType: number;
  }>;
  proof?: Buffer;
  authorized: Buffer;
  networkEncryptionPublicKey: Buffer;
};

export type EncryptGrpcModule = {
  Chain: {
    Solana: number;
  };
  createEncryptClient: (grpcUrl?: string) => {
    createInput: (params: EncryptSdkCreateInputParams) => Promise<{
      ciphertextIdentifiers: Uint8Array[];
    }>;
    close: () => void;
  };
};
