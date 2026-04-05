import { z } from 'zod';

import { ConfigValidationError } from './errors.js';

// =============================================================================
// Custom boolean coercion for environment variable strings
// =============================================================================
// envBoolean treats any non-empty string as true, which is wrong for
// env vars where "false" and "0" should produce false.
// =============================================================================

const envBoolean = z
  .string()
  .optional()
  .transform((val) => {
    if (val === undefined || val === '') return false;
    if (val === '0' || val.toLowerCase() === 'false') return false;
    return true;
  })
  .pipe(z.boolean());

// =============================================================================
// Enums / scalar types
// =============================================================================

export const NodeEnvEnum = z.enum(['development', 'staging', 'production', 'test']);
export type NodeEnv = z.infer<typeof NodeEnvEnum>;

export const LogLevelEnum = z.enum(['debug', 'info', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevelEnum>;

/** Execution mode controls whether orders are submitted to real venues. */
export const ExecutionModeEnum = z.enum(['dry-run', 'live']);
export type ExecutionMode = z.infer<typeof ExecutionModeEnum>;

// Re-export plain JS value objects for runtime use without importing zod
export const ExecutionMode = {
  DRY_RUN: 'dry-run' as const satisfies ExecutionMode,
  LIVE: 'live' as const satisfies ExecutionMode,
} as const;

export interface AuthConfig {
  NODE_ENV: NodeEnv;
  API_SECRET_KEY: string | undefined;
}

// =============================================================================
// Schema
// =============================================================================

const envSchema = z
  .object({
    // ── Runtime ─────────────────────────────────────────────────────────────
    NODE_ENV: NodeEnvEnum,

    LOG_LEVEL: LogLevelEnum.default('info'),

    EXECUTION_MODE: ExecutionModeEnum.default('dry-run'),

    // ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),

    DB_POOL_MIN: z.coerce.number().int().min(1).default(2),

    DB_POOL_MAX: z.coerce.number().int().min(1).default(10),

    DB_SSL: envBoolean,

    // ── API ──────────────────────────────────────────────────────────────────
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    /**
     * Must be at least 32 characters long.  Not required in 'test' environment
     * so tests can run without secrets infrastructure.
     */
    API_SECRET_KEY: z.string().optional(),

    // ── Metrics ──────────────────────────────────────────────────────────────
    METRICS_ENABLED: envBoolean,

    METRICS_PORT: z.coerce.number().int().min(1).max(65535).default(9090),

    // ── Alerting ─────────────────────────────────────────────────────────────
    ALERT_WEBHOOK_URL: z
      .string()
      .url({ message: 'ALERT_WEBHOOK_URL must be a valid URL' })
      .optional(),

    // ── Feature flags ────────────────────────────────────────────────────────
    FEATURE_FLAG_LIVE_EXECUTION: envBoolean,

    // ── Drift / on-chain ─────────────────────────────────────────────────────
    DRIFT_RPC_ENDPOINT: z.string().optional(),
    DRIFT_READONLY_ENV: z.enum(['devnet', 'mainnet-beta']).optional(),
    DRIFT_READONLY_ACCOUNT_ADDRESS: z.string().optional(),
    DRIFT_READONLY_AUTHORITY_ADDRESS: z.string().optional(),
    DRIFT_READONLY_SUBACCOUNT_ID: z.coerce.number().int().min(0).optional(),
    DRIFT_READONLY_ACCOUNT_LABEL: z.string().optional(),
    DRIFT_EXECUTION_ENV: z.enum(['devnet', 'mainnet-beta']).optional(),
    DRIFT_EXECUTION_SUBACCOUNT_ID: z.coerce.number().int().min(0).optional(),
    DRIFT_EXECUTION_ACCOUNT_LABEL: z.string().optional(),

    DRIFT_PRIVATE_KEY: z.string().optional(),

    DRIFT_MAINNET_EXECUTION_ENABLED: envBoolean,
    DRIFT_SPOT_EXECUTION_ENABLED: envBoolean,
  })
  .superRefine((data, ctx) => {
    // API_SECRET_KEY is required outside of test environments
    if (data.NODE_ENV !== 'test') {
      if (data.API_SECRET_KEY === undefined || data.API_SECRET_KEY === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['API_SECRET_KEY'],
          message: 'API_SECRET_KEY is required in non-test environments',
        });
      } else if (data.API_SECRET_KEY.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          path: ['API_SECRET_KEY'],
          type: 'string',
          minimum: 32,
          inclusive: true,
          message: 'API_SECRET_KEY must be at least 32 characters',
        });
      }
    }

    // Warn about DRIFT_PRIVATE_KEY set in non-production without live execution
    if (
      data.DRIFT_PRIVATE_KEY !== undefined &&
      data.NODE_ENV !== 'production' &&
      !data.FEATURE_FLAG_LIVE_EXECUTION
    ) {
      // We emit a warning to stderr; this is not a hard failure
      process.stderr.write(
        '[config] WARNING: DRIFT_PRIVATE_KEY is set in a non-production environment ' +
          'but FEATURE_FLAG_LIVE_EXECUTION is false. ' +
          'The key will be loaded but live order submission is disabled.\n',
      );
    }

    // DB_POOL_MAX must be >= DB_POOL_MIN
    if (data.DB_POOL_MAX < data.DB_POOL_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DB_POOL_MAX'],
        message: `DB_POOL_MAX (${data.DB_POOL_MAX}) must be >= DB_POOL_MIN (${data.DB_POOL_MIN})`,
      });
    }
  });

export type Config = z.infer<typeof envSchema>;

const authEnvSchema = z
  .object({
    NODE_ENV: NodeEnvEnum,
    API_SECRET_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'test') {
      if (data.API_SECRET_KEY === undefined || data.API_SECRET_KEY === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['API_SECRET_KEY'],
          message: 'API_SECRET_KEY is required in non-test environments',
        });
      } else if (data.API_SECRET_KEY.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          path: ['API_SECRET_KEY'],
          type: 'string',
          minimum: 32,
          inclusive: true,
          message: 'API_SECRET_KEY must be at least 32 characters',
        });
      }
    }
  });

// =============================================================================
// Parse + export singleton
// =============================================================================

function parseEnv(raw: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    throw new ConfigValidationError(result.error);
  }

  return result.data;
}

/**
 * Parse a custom environment bag.  Primarily useful in tests.
 */
export function createConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigValidationError(result.error);
  }
  return result.data;
}

export function createAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const result = authEnvSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigValidationError(result.error);
  }
  return {
    NODE_ENV: result.data.NODE_ENV,
    API_SECRET_KEY: result.data.API_SECRET_KEY,
  };
}

/**
 * Singleton parsed configuration.
 *
 * Lazily initialised on first access so that importing this module in test
 * environments (which typically lack a full process.env) does not throw.
 * Use `createConfig()` in tests to supply a controlled environment bag.
 */
let _config: Config | undefined;
let _authConfig: AuthConfig | undefined;

export const config: Config = new Proxy({} as Config, {
  get(_target, prop: string | symbol) {
    if (_config === undefined) {
      _config = parseEnv();
    }
    return (_config as Record<string | symbol, unknown>)[prop];
  },
  has(_target, prop) {
    if (_config === undefined) {
      _config = parseEnv();
    }
    return prop in (_config as object);
  },
});

export const authConfig: AuthConfig = new Proxy({} as AuthConfig, {
  get(_target, prop: string | symbol) {
    if (_authConfig === undefined) {
      _authConfig = createAuthConfig(process.env);
    }
    return (_authConfig as unknown as Record<string | symbol, unknown>)[prop];
  },
  has(_target, prop) {
    if (_authConfig === undefined) {
      _authConfig = createAuthConfig(process.env);
    }
    return prop in (_authConfig as object);
  },
});
