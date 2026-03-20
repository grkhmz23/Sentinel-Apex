function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDashboardApiBaseUrl(): string {
  return getRequiredEnv('OPS_DASHBOARD_API_BASE_URL').replace(/\/$/, '');
}

export function getDashboardApiKey(): string {
  return getRequiredEnv('OPS_DASHBOARD_API_KEY');
}

export function getDefaultActor(): string {
  return process.env['OPS_DASHBOARD_DEFAULT_ACTOR']?.trim() || 'local-operator';
}
