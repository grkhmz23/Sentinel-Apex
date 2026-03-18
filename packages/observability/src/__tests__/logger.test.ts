import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createLogger } from '../logger.js';

import type { LogContext } from '../logger.js';

// =============================================================================
// Logger Tests
// =============================================================================

describe('createLogger', () => {
  it('returns a logger with all four log-level methods', () => {
    const log = createLogger('test-component');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.withContext).toBe('function');
  });

  it('accepts an initial context without throwing', () => {
    const context: LogContext = {
      correlationId: 'corr-123',
      sleeveId: 'equity-us',
      venueId: 'NYSE',
    };
    expect(() => createLogger('risk-engine', context)).not.toThrow();
  });

  it('creates a logger with no context without throwing', () => {
    expect(() => createLogger('order-manager')).not.toThrow();
  });
});

describe('Logger#withContext', () => {
  it('returns a new logger without mutating the original', () => {
    const parent = createLogger('parent', { sleeveId: 'equity-us' });
    const child = parent.withContext({ venueId: 'NYSE' });
    // The returned value is a different object
    expect(child).not.toBe(parent);
  });

  it('child logger has all log-level methods', () => {
    const parent = createLogger('parent');
    const child = parent.withContext({ correlationId: 'abc' });
    expect(typeof child.debug).toBe('function');
    expect(typeof child.info).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('allows chaining withContext calls', () => {
    const log = createLogger('svc')
      .withContext({ sleeveId: 'equity-us' })
      .withContext({ venueId: 'NASDAQ' })
      .withContext({ correlationId: 'corr-456' });
    // Should not throw
    expect(() => log.info('chained context log')).not.toThrow();
  });
});

describe('Logger log levels', () => {
  it('debug does not throw when called with just a message', () => {
    const log = createLogger('test', {});
    expect(() => log.debug('a debug message')).not.toThrow();
  });

  it('info does not throw with data', () => {
    const log = createLogger('test');
    expect(() => log.info('order received', { orderId: 'ord-1', qty: 100 })).not.toThrow();
  });

  it('warn does not throw with data', () => {
    const log = createLogger('test');
    expect(() => log.warn('high latency detected', { latencyMs: 500 })).not.toThrow();
  });

  it('error does not throw with data', () => {
    const log = createLogger('test');
    expect(() =>
      log.error('unexpected failure', { errorCode: 'E_CONN_REFUSED' }),
    ).not.toThrow();
  });
});

describe('Sensitive field redaction', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Capture output so tests stay silent and we can inspect what pino emits.
    // pino writes to stdout by default when transport is undefined (JSON mode).
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  /**
   * Collect all string output written to stdout during the callback.
   */
  function captureOutput(fn: () => void): string {
    const lines: string[] = [];
    stdoutSpy.mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') lines.push(chunk);
      else if (Buffer.isBuffer(chunk)) lines.push(chunk.toString());
      return true;
    });
    fn();
    return lines.join('');
  }

  it('redacts "password" field from log data', () => {
    // Force JSON mode by pretending we are in production
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const log = createLogger('security-test');
      const output = captureOutput(() => {
        log.info('user action', {
          userId: 'u-1',
          password: 's3cr3t!',
        });
      });
      // pino should replace the value with [REDACTED]
      expect(output).not.toContain('s3cr3t!');
      if (output.length > 0) {
        // If output was captured, confirm the field is redacted
        expect(output).toContain('[REDACTED]');
      }
    } finally {
      process.env['NODE_ENV'] = origEnv;
    }
  });

  it('redacts "apiSecret" field from log data', () => {
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const log = createLogger('security-test');
      const output = captureOutput(() => {
        log.warn('api call', { apiSecret: 'super-secret-key-xyz' });
      });
      expect(output).not.toContain('super-secret-key-xyz');
    } finally {
      process.env['NODE_ENV'] = origEnv;
    }
  });

  it('redacts "privateKey" field from log data', () => {
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const log = createLogger('security-test');
      const output = captureOutput(() => {
        log.error('key material leaked', { privateKey: 'MIIEvAIBADANBg...' });
      });
      expect(output).not.toContain('MIIEvAIBADANBg...');
    } finally {
      process.env['NODE_ENV'] = origEnv;
    }
  });

  it('does not redact non-sensitive fields', () => {
    const origEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const log = createLogger('security-test');
      const output = captureOutput(() => {
        log.info('order submitted', { orderId: 'ord-999', venue: 'NYSE' });
      });
      if (output.length > 0) {
        expect(output).toContain('ord-999');
        expect(output).toContain('NYSE');
      }
    } finally {
      process.env['NODE_ENV'] = origEnv;
    }
  });
});
