import { config } from '@sentinel-apex/config';
import { RuntimeControlPlane } from '@sentinel-apex/runtime';

export async function createControlPlaneFromEnv(): Promise<RuntimeControlPlane> {
  return RuntimeControlPlane.connect(config.DATABASE_URL);
}
