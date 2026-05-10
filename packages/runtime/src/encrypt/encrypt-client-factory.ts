import { PreAlphaEncryptClient } from './prealpha-encrypt-client.js';
import { SdkPreAlphaEncryptClient } from './sdk-prealpha-client.js';

import type { EncryptClient } from './encrypt-client.js';
import type { EncryptSdkPreAlphaConfig } from './sdk-prealpha-types.js';

export function createEncryptStrategyClient(_config: EncryptSdkPreAlphaConfig): EncryptClient {
  return new PreAlphaEncryptClient();
}

export function createEncryptSdkPreAlphaClient(config: EncryptSdkPreAlphaConfig): SdkPreAlphaEncryptClient {
  return new SdkPreAlphaEncryptClient(config);
}
