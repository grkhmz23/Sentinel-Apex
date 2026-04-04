import {
  buildDeploymentProfile,
  DEFAULT_ENVIRONMENT_LABEL,
  DEFAULT_EXECUTION_BADGE,
  type DeploymentProfile,
} from '@sentinel-apex/shared';

export function getDashboardDeploymentProfile(): DeploymentProfile {
  return buildDeploymentProfile(process.env, {
    environmentLabelKey: 'NEXT_PUBLIC_ENVIRONMENT_LABEL',
    executionBadgeKey: 'NEXT_PUBLIC_EXECUTION_BADGE',
    defaultEnvironmentLabel: DEFAULT_ENVIRONMENT_LABEL,
    defaultExecutionBadge: DEFAULT_EXECUTION_BADGE,
  });
}
