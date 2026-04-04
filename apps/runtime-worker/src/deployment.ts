import { config } from '@sentinel-apex/config';
import { createLogger } from '@sentinel-apex/observability';
import {
  buildDeploymentProfile,
  getDevnetExecutionSafetyErrors,
  getDevnetExecutionSafetyWarnings,
} from '@sentinel-apex/shared';

const logger = createLogger('runtime-worker:deployment');

export function assertWorkerStartupSafety(): void {
  const errors = getDevnetExecutionSafetyErrors(process.env);

  if (errors.length > 0) {
    throw new Error(`Runtime worker startup safety check failed:\n- ${errors.join('\n- ')}`);
  }
}

export function logWorkerStartup(cycleIntervalMs: number): void {
  const profile = buildDeploymentProfile(process.env);

  for (const warning of getDevnetExecutionSafetyWarnings(process.env)) {
    logger.warn(warning, {
      component: 'runtime-worker:deployment',
    });
  }

  logger.info('Runtime worker deployment profile loaded', {
    component: 'runtime-worker:deployment',
    service: 'runtime-worker',
    cycleIntervalMs,
    environmentLabel: profile.environmentLabel,
    executionBadge: profile.executionBadge,
    executionMode: profile.executionMode,
    liveExecutionEnabled: profile.liveExecutionEnabled,
    driftExecutionEnv: profile.driftExecutionEnv ?? 'disabled',
    driftReadonlyEnv: profile.driftReadonlyEnv ?? 'unset',
    supportedExecutionScope: profile.supportedExecutionScope,
    blockedExecutionScope: profile.blockedExecutionScope,
    databaseUrlConfigured: config.DATABASE_URL.length > 0,
  });
}
