import pinoLib, {
  stdTimeFunctions,
  type Logger as PinoBaseLogger,
  type LoggerOptions,
  type redactOptions,
} from 'pino';

// =============================================================================
// Sentinel Apex — Structured Logger
// =============================================================================

/**
 * Context fields that can be attached to a logger or individual log calls.
 * All fields are optional so callers may supply only what they have.
 */
export interface LogContext {
  correlationId?: string;
  sleeveId?: string;
  venueId?: string;
  orderId?: string;
  opportunityId?: string;
  component?: string;
}

/**
 * The logger interface exposed to consumers. Each method accepts a human-
 * readable message and an optional structured data bag.
 */
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  /** Return a child logger that merges additional context into every log entry. */
  withContext(context: LogContext): Logger;
}

// Fields that must never appear in log output even if passed in data bags.
const REDACTED_FIELDS = ['privateKey', 'apiSecret', 'password'];

/**
 * Build a pino transport that pretty-prints in development and emits clean
 * JSON in production / CI environments.
 */
function buildPinoLogger(
  component: string,
  context: LogContext,
): PinoBaseLogger {
  const isDev =
    process.env['NODE_ENV'] !== 'production' &&
    process.env['NODE_ENV'] !== 'test';

  const redact: redactOptions = {
    paths: REDACTED_FIELDS,
    censor: '[REDACTED]',
  };

  const baseOptions: LoggerOptions = {
    level: process.env['LOG_LEVEL'] ?? 'info',
    redact,
    timestamp: stdTimeFunctions.isoTime,
    base: {
      component,
      ...(context.correlationId !== undefined
        ? { correlationId: context.correlationId }
        : {}),
      ...(context.sleeveId !== undefined ? { sleeveId: context.sleeveId } : {}),
      ...(context.venueId !== undefined ? { venueId: context.venueId } : {}),
      ...(context.orderId !== undefined ? { orderId: context.orderId } : {}),
      ...(context.opportunityId !== undefined
        ? { opportunityId: context.opportunityId }
        : {}),
    },
  };

  if (isDev) {
    return pinoLib(
      {
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      },
    );
  }

  return pinoLib(baseOptions);
}

/**
 * Adapts a raw pino logger into the Logger interface.
 */
class PinoLogger implements Logger {
  private readonly _pino: PinoBaseLogger;
  private readonly _component: string;
  private readonly _context: LogContext;

  constructor(pinoInstance: PinoBaseLogger, component: string, context: LogContext) {
    this._pino = pinoInstance;
    this._component = component;
    this._context = context;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (data !== undefined) {
      this._pino.debug(data, message);
    } else {
      this._pino.debug(message);
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (data !== undefined) {
      this._pino.info(data, message);
    } else {
      this._pino.info(message);
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (data !== undefined) {
      this._pino.warn(data, message);
    } else {
      this._pino.warn(message);
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (data !== undefined) {
      this._pino.error(data, message);
    } else {
      this._pino.error(message);
    }
  }

  withContext(context: LogContext): Logger {
    const merged: LogContext = { ...this._context, ...context };
    const child = this._pino.child({
      ...(merged.correlationId !== undefined
        ? { correlationId: merged.correlationId }
        : {}),
      ...(merged.sleeveId !== undefined ? { sleeveId: merged.sleeveId } : {}),
      ...(merged.venueId !== undefined ? { venueId: merged.venueId } : {}),
      ...(merged.orderId !== undefined ? { orderId: merged.orderId } : {}),
      ...(merged.opportunityId !== undefined
        ? { opportunityId: merged.opportunityId }
        : {}),
      ...(merged.component !== undefined
        ? { component: merged.component }
        : {}),
    });
    return new PinoLogger(child, merged.component ?? this._component, merged);
  }
}

/**
 * Create a named logger for a given component with optional initial context.
 *
 * @example
 * const log = createLogger('risk-engine', { sleeveId: 'equity-us' });
 * log.info('Risk check passed', { checkName: 'position-limit' });
 */
export function createLogger(component: string, context: LogContext = {}): Logger {
  const pinoInstance = buildPinoLogger(component, context);
  return new PinoLogger(pinoInstance, component, context);
}
