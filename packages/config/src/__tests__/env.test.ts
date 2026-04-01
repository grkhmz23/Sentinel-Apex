import { describe, it, expect } from 'vitest';

import { createConfig } from '../env.js';
import { ConfigValidationError } from '../errors.js';

// =============================================================================
// Helpers
// =============================================================================

/** A minimal valid environment for the 'test' NODE_ENV (no API_SECRET_KEY req.) */
const BASE_TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/sentinelapex',
};

/** A minimal valid environment for 'development' (requires API_SECRET_KEY). */
const BASE_DEV_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/sentinelapex',
  API_SECRET_KEY: 'this-is-a-32-character-secret!!!', // 32 chars
};

// =============================================================================
// Suites
// =============================================================================

describe('config/env — valid configuration', () => {
  it('parses a minimal test environment without error', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.NODE_ENV).toBe('test');
    expect(cfg.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/sentinelapex');
  });

  it('parses a full development environment without error', () => {
    const cfg = createConfig({
      ...BASE_DEV_ENV,
      LOG_LEVEL: 'debug',
      EXECUTION_MODE: 'dry-run',
      DB_POOL_MIN: '3',
      DB_POOL_MAX: '15',
      DB_SSL: 'true',
      API_PORT: '4000',
      METRICS_ENABLED: 'true',
      METRICS_PORT: '9100',
      ALERT_WEBHOOK_URL: 'https://hooks.example.com/alert',
      FEATURE_FLAG_LIVE_EXECUTION: 'false',
      DRIFT_RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
      DRIFT_READONLY_ACCOUNT_ADDRESS: 'readonly-account',
      DRIFT_READONLY_ACCOUNT_LABEL: 'Treasury watch wallet',
    });

    expect(cfg.LOG_LEVEL).toBe('debug');
    expect(cfg.DB_POOL_MIN).toBe(3);
    expect(cfg.DB_POOL_MAX).toBe(15);
    expect(cfg.DB_SSL).toBe(true);
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.METRICS_ENABLED).toBe(true);
    expect(cfg.METRICS_PORT).toBe(9100);
    expect(cfg.ALERT_WEBHOOK_URL).toBe('https://hooks.example.com/alert');
    expect(cfg.DRIFT_RPC_ENDPOINT).toBe('https://api.mainnet-beta.solana.com');
    expect(cfg.DRIFT_READONLY_ACCOUNT_ADDRESS).toBe('readonly-account');
    expect(cfg.DRIFT_READONLY_ACCOUNT_LABEL).toBe('Treasury watch wallet');
  });
});

describe('config/env — default values', () => {
  it('applies default LOG_LEVEL of "info"', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.LOG_LEVEL).toBe('info');
  });

  it('applies default EXECUTION_MODE of "dry-run"', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.EXECUTION_MODE).toBe('dry-run');
  });

  it('applies default DB_POOL_MIN of 2', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.DB_POOL_MIN).toBe(2);
  });

  it('applies default DB_POOL_MAX of 10', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.DB_POOL_MAX).toBe(10);
  });

  it('applies default API_PORT of 3000', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.API_PORT).toBe(3000);
  });

  it('applies default METRICS_ENABLED of false', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.METRICS_ENABLED).toBe(false);
  });

  it('applies default METRICS_PORT of 9090', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.METRICS_PORT).toBe(9090);
  });

  it('applies default FEATURE_FLAG_LIVE_EXECUTION of false', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.FEATURE_FLAG_LIVE_EXECUTION).toBe(false);
  });

  it('applies default DB_SSL of false', () => {
    const cfg = createConfig(BASE_TEST_ENV);
    expect(cfg.DB_SSL).toBe(false);
  });
});

describe('config/env — numeric coercion from strings', () => {
  it('coerces DB_POOL_MIN string to number', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, DB_POOL_MIN: '5' });
    expect(cfg.DB_POOL_MIN).toBe(5);
    expect(typeof cfg.DB_POOL_MIN).toBe('number');
  });

  it('coerces DB_POOL_MAX string to number', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, DB_POOL_MAX: '20' });
    expect(cfg.DB_POOL_MAX).toBe(20);
  });

  it('coerces API_PORT string to number', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, API_PORT: '8080' });
    expect(cfg.API_PORT).toBe(8080);
  });

  it('coerces METRICS_PORT string to number', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, METRICS_PORT: '9200' });
    expect(cfg.METRICS_PORT).toBe(9200);
  });
});

describe('config/env — boolean coercion from strings', () => {
  it('coerces METRICS_ENABLED "true" to boolean true', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, METRICS_ENABLED: 'true' });
    expect(cfg.METRICS_ENABLED).toBe(true);
  });

  it('coerces METRICS_ENABLED "false" to boolean false', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, METRICS_ENABLED: 'false' });
    expect(cfg.METRICS_ENABLED).toBe(false);
  });

  it('coerces DB_SSL "1" to boolean true', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, DB_SSL: '1' });
    expect(cfg.DB_SSL).toBe(true);
  });

  it('coerces FEATURE_FLAG_LIVE_EXECUTION "true" to boolean true', () => {
    const cfg = createConfig({ ...BASE_TEST_ENV, FEATURE_FLAG_LIVE_EXECUTION: 'true' });
    expect(cfg.FEATURE_FLAG_LIVE_EXECUTION).toBe(true);
  });
});

describe('config/env — validation errors', () => {
  it('throws ConfigValidationError when DATABASE_URL is missing', () => {
    expect(() =>
      createConfig({ NODE_ENV: 'test' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when DATABASE_URL is not a URL', () => {
    expect(() =>
      createConfig({ ...BASE_TEST_ENV, DATABASE_URL: 'not-a-url' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when NODE_ENV is missing', () => {
    expect(() =>
      createConfig({ DATABASE_URL: 'postgres://localhost/db' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when EXECUTION_MODE is invalid', () => {
    expect(() =>
      createConfig({ ...BASE_TEST_ENV, EXECUTION_MODE: 'real' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when LOG_LEVEL is invalid', () => {
    expect(() =>
      createConfig({ ...BASE_TEST_ENV, LOG_LEVEL: 'verbose' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when API_SECRET_KEY is missing in development', () => {
    expect(() =>
      createConfig({ NODE_ENV: 'development', DATABASE_URL: 'postgres://localhost/db' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when API_SECRET_KEY is shorter than 32 chars in development', () => {
    expect(() =>
      createConfig({
        ...BASE_DEV_ENV,
        API_SECRET_KEY: 'short-key',
      }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when DB_POOL_MAX < DB_POOL_MIN', () => {
    expect(() =>
      createConfig({ ...BASE_TEST_ENV, DB_POOL_MIN: '10', DB_POOL_MAX: '5' }),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when ALERT_WEBHOOK_URL is not a URL', () => {
    expect(() =>
      createConfig({ ...BASE_TEST_ENV, ALERT_WEBHOOK_URL: 'not-a-url' }),
    ).toThrow(ConfigValidationError);
  });

  it('ConfigValidationError message includes field name', () => {
    let error: unknown;
    try {
      createConfig({ NODE_ENV: 'test' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigValidationError);
    expect((error as ConfigValidationError).message).toMatch(/DATABASE_URL/);
  });

  it('ConfigValidationError exposes zodError with issues', () => {
    let error: unknown;
    try {
      createConfig({ NODE_ENV: 'test' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigValidationError);
    const ce = error as ConfigValidationError;
    expect(ce.zodError.issues.length).toBeGreaterThan(0);
  });
});

describe('config/env — production environment', () => {
  it('parses a valid production config', () => {
    const cfg = createConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@db.prod.example.com:5432/sentinel',
      API_SECRET_KEY: 'production-secret-key-that-is-long-enough!!',
      EXECUTION_MODE: 'live',
      FEATURE_FLAG_LIVE_EXECUTION: 'true',
      DB_SSL: 'true',
    });
    expect(cfg.NODE_ENV).toBe('production');
    expect(cfg.EXECUTION_MODE).toBe('live');
    expect(cfg.DB_SSL).toBe(true);
  });
});
