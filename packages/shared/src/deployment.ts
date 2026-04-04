export const SUPPORTED_EXECUTION_SCOPE = Object.freeze([
  'Drift devnet only',
  'carry sleeve only',
  'BTC-PERP only',
  'market orders only',
  'reduce-only only',
]);

export const BLOCKED_EXECUTION_SCOPE = Object.freeze([
  'No mainnet execution',
  'no non-carry sleeve real execution',
  'no treasury real execution',
  'no new exposure or opening orders',
  'no non-BTC-PERP markets',
  'no limit or post-only execution',
  'no silent simulation fallback',
]);

export const READINESS_TRUTH_STATEMENT =
  'Venue-native Drift events and post-trade confirmation remain the source of execution truth.';

export const DEFAULT_ENVIRONMENT_LABEL = 'staging demo';
export const DEFAULT_EXECUTION_BADGE = 'devnet only';

function trimToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

export function envFlagEnabled(value: string | undefined | null): boolean {
  const normalized = trimToNull(value);
  if (normalized === null) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  return lowered !== '0' && lowered !== 'false' && lowered !== 'no';
}

export interface DeploymentProfile {
  environmentLabel: string;
  executionBadge: string;
  executionMode: string;
  liveExecutionEnabled: boolean;
  driftExecutionEnv: string | null;
  driftReadonlyEnv: string | null;
  supportedExecutionScope: readonly string[];
  blockedExecutionScope: readonly string[];
  readinessTruth: string;
}

export function buildDeploymentProfile(
  env: Record<string, string | undefined>,
  options: {
    environmentLabelKey?: string;
    executionBadgeKey?: string;
    defaultEnvironmentLabel?: string;
    defaultExecutionBadge?: string;
  } = {},
): DeploymentProfile {
  const environmentLabelKey = options.environmentLabelKey ?? 'SENTINEL_ENVIRONMENT_LABEL';
  const executionBadgeKey = options.executionBadgeKey ?? 'SENTINEL_EXECUTION_BADGE';

  return {
    environmentLabel:
      trimToNull(env[environmentLabelKey])
      ?? options.defaultEnvironmentLabel
      ?? DEFAULT_ENVIRONMENT_LABEL,
    executionBadge:
      trimToNull(env[executionBadgeKey])
      ?? options.defaultExecutionBadge
      ?? DEFAULT_EXECUTION_BADGE,
    executionMode: trimToNull(env['EXECUTION_MODE']) ?? 'dry-run',
    liveExecutionEnabled: envFlagEnabled(env['FEATURE_FLAG_LIVE_EXECUTION']),
    driftExecutionEnv: trimToNull(env['DRIFT_EXECUTION_ENV']),
    driftReadonlyEnv: trimToNull(env['DRIFT_READONLY_ENV']),
    supportedExecutionScope: SUPPORTED_EXECUTION_SCOPE,
    blockedExecutionScope: BLOCKED_EXECUTION_SCOPE,
    readinessTruth: READINESS_TRUTH_STATEMENT,
  };
}

export function getDevnetExecutionSafetyErrors(
  env: Record<string, string | undefined>,
): string[] {
  const liveExecutionRequested =
    (trimToNull(env['EXECUTION_MODE']) ?? 'dry-run') === 'live'
    || envFlagEnabled(env['FEATURE_FLAG_LIVE_EXECUTION']);

  if (!liveExecutionRequested) {
    return [];
  }

  const errors: string[] = [];

  if (trimToNull(env['DRIFT_EXECUTION_ENV']) !== 'devnet') {
    errors.push(
      'Live execution is enabled, but DRIFT_EXECUTION_ENV is not pinned to devnet.',
    );
  }

  if (trimToNull(env['DRIFT_RPC_ENDPOINT']) === null) {
    errors.push(
      'Live execution is enabled, but DRIFT_RPC_ENDPOINT is missing.',
    );
  }

  if (trimToNull(env['DRIFT_PRIVATE_KEY']) === null) {
    errors.push(
      'Live execution is enabled, but DRIFT_PRIVATE_KEY is missing.',
    );
  }

  return errors;
}

export function getDevnetExecutionSafetyWarnings(
  env: Record<string, string | undefined>,
): string[] {
  const liveExecutionRequested =
    (trimToNull(env['EXECUTION_MODE']) ?? 'dry-run') === 'live'
    || envFlagEnabled(env['FEATURE_FLAG_LIVE_EXECUTION']);

  if (!liveExecutionRequested) {
    return [];
  }

  const warnings: string[] = [];

  const readonlyEnv = trimToNull(env['DRIFT_READONLY_ENV']);
  if (readonlyEnv !== null && readonlyEnv !== 'devnet') {
    warnings.push(
      'DRIFT_READONLY_ENV is not devnet while live devnet execution is enabled. Keep read-only truth aligned to devnet for the narrow real execution path.',
    );
  }

  return warnings;
}
