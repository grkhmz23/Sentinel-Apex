function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return null;
  }

  return value.trim();
}

export function getDashboardApiBaseUrl(): string {
  return (
    getOptionalEnv('OPS_DASHBOARD_API_BASE_URL')
    ?? getRequiredEnv('NEXT_PUBLIC_API_BASE_URL')
  ).replace(/\/$/, '');
}

export function getDashboardApiKey(): string {
  return getRequiredEnv('OPS_DASHBOARD_API_KEY');
}

export function getDatabaseUrl(): string {
  return getRequiredEnv('DATABASE_URL');
}

export function getOpsAuthSharedSecret(): string {
  return getRequiredEnv('OPS_AUTH_SHARED_SECRET');
}

export function getSessionCookieName(): string {
  return getOptionalEnv('OPS_DASHBOARD_SESSION_COOKIE_NAME') ?? 'sentinel_apex_ops_session';
}

export function getSessionTtlHours(): number {
  const raw = getOptionalEnv('OPS_DASHBOARD_SESSION_TTL_HOURS');
  const parsed = raw === null ? 12 : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 168) {
    throw new Error('OPS_DASHBOARD_SESSION_TTL_HOURS must be an integer between 1 and 168.');
  }

  return parsed;
}

export function isProductionEnv(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

export function getDefaultSignInEmail(): string {
  return getOptionalEnv('OPS_DASHBOARD_DEFAULT_SIGN_IN_EMAIL') ?? '';
}
