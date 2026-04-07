import { config } from '@sentinel-apex/config';
import { createLogger } from '@sentinel-apex/observability';
import type { RuntimeOverviewView } from '@sentinel-apex/runtime';
import {
  buildDeploymentProfile,
  getDevnetExecutionSafetyErrors,
  getDevnetExecutionSafetyWarnings,
} from '@sentinel-apex/shared';
import type { DeploymentProfile } from '@sentinel-apex/shared';

const logger = createLogger('api:deployment');

type ApiReadinessStatus = 'ok' | 'degraded';

type ApiReadinessPayload = {
  status: ApiReadinessStatus;
  service: 'api';
  version: string;
  timestamp: string;
  environmentLabel: string;
  executionBadge: string;
  executionMode: string;
  liveExecutionEnabled: boolean;
  readinessTruth: string;
  supportedExecutionScope: DeploymentProfile['supportedExecutionScope'];
  blockedExecutionScope: DeploymentProfile['blockedExecutionScope'];
  runtime: {
    lifecycleState: RuntimeOverviewView['runtime']['lifecycleState'];
    halted: RuntimeOverviewView['runtime']['halted'];
    projectionStatus: RuntimeOverviewView['runtime']['projectionStatus'];
    lastCycleCompletedAt: RuntimeOverviewView['runtime']['lastCycleCompletedAt'];
  };
  worker: {
    lifecycleState: RuntimeOverviewView['worker']['lifecycleState'];
    schedulerState: RuntimeOverviewView['worker']['schedulerState'];
    cycleIntervalMs: RuntimeOverviewView['worker']['cycleIntervalMs'];
    lastHeartbeatAt: RuntimeOverviewView['worker']['lastHeartbeatAt'];
    nextScheduledRunAt: RuntimeOverviewView['worker']['nextScheduledRunAt'];
    heartbeatStale: boolean;
  };
  openMismatchCount: RuntimeOverviewView['openMismatchCount'];
  degradedReasons: string[];
};

type ApiReadinessResult = {
  status: ApiReadinessStatus;
  payload: ApiReadinessPayload;
};

function getOpsAuthSharedSecret(): string | null {
  const raw = process.env['OPS_AUTH_SHARED_SECRET'];
  if (raw === undefined || raw.trim() === '') {
    return null;
  }

  return raw.trim();
}

export function assertApiStartupSafety(): void {
  const errors = [...getDevnetExecutionSafetyErrors(process.env)];

  if (getOpsAuthSharedSecret() === null) {
    errors.push(
      'OPS_AUTH_SHARED_SECRET is required so the dashboard can sign operator headers for protected API routes.',
    );
  }

  if (errors.length > 0) {
    throw new Error(`API startup safety check failed:\n- ${errors.join('\n- ')}`);
  }
}

export function logApiStartup(): void {
  const profile = buildDeploymentProfile(process.env);

  for (const warning of getDevnetExecutionSafetyWarnings(process.env)) {
    logger.warn(warning, {
      component: 'api:deployment',
    });
  }

  logger.info('API deployment profile loaded', {
    component: 'api:deployment',
    service: 'api',
    apiPort: config.API_PORT,
    environmentLabel: profile.environmentLabel,
    executionBadge: profile.executionBadge,
    executionMode: profile.executionMode,
    liveExecutionEnabled: profile.liveExecutionEnabled,

    corsOrigin: process.env['CORS_ORIGIN'] ?? 'any',
    supportedExecutionScope: profile.supportedExecutionScope,
    blockedExecutionScope: profile.blockedExecutionScope,
  });
}

function isWorkerHeartbeatStale(overview: RuntimeOverviewView): boolean {
  if (overview.worker.lastHeartbeatAt === null) {
    return true;
  }

  const heartbeatAt = Date.parse(overview.worker.lastHeartbeatAt);
  if (!Number.isFinite(heartbeatAt)) {
    return true;
  }

  const staleAfterMs = Math.max(overview.worker.cycleIntervalMs * 3, 180_000);
  return Date.now() - heartbeatAt > staleAfterMs;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim() !== '')));
}

export function buildApiReadinessPayload(
  overview: RuntimeOverviewView,
  version: string,
): ApiReadinessResult {
  const profile = buildDeploymentProfile(process.env);
  const workerHeartbeatStale = isWorkerHeartbeatStale(overview);
  const degradedReasons = dedupe([
    ...overview.degradedReasons,
    ...(overview.runtime.lifecycleState !== 'ready'
      ? [`Runtime lifecycle is ${overview.runtime.lifecycleState}.`]
      : []),
    ...(overview.runtime.halted ? ['Runtime kill switch is engaged.'] : []),
    ...(overview.worker.lifecycleState !== 'ready'
      ? [`Runtime worker lifecycle is ${overview.worker.lifecycleState}.`]
      : []),
    ...(workerHeartbeatStale ? ['Runtime worker heartbeat is stale or missing.'] : []),
  ]);

  const status = degradedReasons.length === 0 ? 'ok' : 'degraded';

  return {
    status,
    payload: {
      status,
      service: 'api',
      version,
      timestamp: new Date().toISOString(),
      environmentLabel: profile.environmentLabel,
      executionBadge: profile.executionBadge,
      executionMode: profile.executionMode,
      liveExecutionEnabled: profile.liveExecutionEnabled,
      readinessTruth: profile.readinessTruth,
      supportedExecutionScope: profile.supportedExecutionScope,
      blockedExecutionScope: profile.blockedExecutionScope,
      runtime: {
        lifecycleState: overview.runtime.lifecycleState,
        halted: overview.runtime.halted,
        projectionStatus: overview.runtime.projectionStatus,
        lastCycleCompletedAt: overview.runtime.lastCycleCompletedAt,
      },
      worker: {
        lifecycleState: overview.worker.lifecycleState,
        schedulerState: overview.worker.schedulerState,
        cycleIntervalMs: overview.worker.cycleIntervalMs,
        lastHeartbeatAt: overview.worker.lastHeartbeatAt,
        nextScheduledRunAt: overview.worker.nextScheduledRunAt,
        heartbeatStale: workerHeartbeatStale,
      },
      openMismatchCount: overview.openMismatchCount,
      degradedReasons,
    },
  };
}
