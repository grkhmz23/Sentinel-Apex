import type { OpsOperatorRole } from '@sentinel-apex/shared';

export interface DashboardOperatorIdentity {
  operatorId: string;
  email: string;
  displayName: string;
  role: OpsOperatorRole;
  active: boolean;
}

export interface DashboardSession {
  sessionId: string;
  expiresAt: string;
  operator: DashboardOperatorIdentity;
}
