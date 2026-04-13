export const SUPPORTED_EXECUTION_SCOPE = Object.freeze([
  'Jupiter Perps devnet only',
  'USDC-collateralized perp trading',
  'BTC-PERP, ETH-PERP, SOL-PERP markets',
]);

export const BLOCKED_EXECUTION_SCOPE = Object.freeze([
  'No mainnet execution (Jupiter devnet only)',
  'No spot market trading',
  'No CEX execution',
  'No legacy perps connector support outside Jupiter Perps',
]);

export const READINESS_TRUTH_STATEMENT =
  'Jupiter Perpetuals devnet execution is available for hackathon demonstration. All trades use USDC collateral on devnet.';

export const DEFAULT_ENVIRONMENT_LABEL = 'staging demo';
export const DEFAULT_EXECUTION_BADGE = 'jupiter devnet';

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
    supportedExecutionScope: SUPPORTED_EXECUTION_SCOPE,
    blockedExecutionScope: BLOCKED_EXECUTION_SCOPE,
    readinessTruth: READINESS_TRUTH_STATEMENT,
  };
}

export function getDevnetExecutionSafetyErrors(
  _env: Record<string, string | undefined>,
): string[] {
  // Additional safety checks can be added here as non-Jupiter venues are introduced.
  return [];
}

export function getDevnetExecutionSafetyWarnings(
  _env: Record<string, string | undefined>,
): string[] {
  // No warnings - current execution posture is already constrained by deployment truth.
  return [];
}
