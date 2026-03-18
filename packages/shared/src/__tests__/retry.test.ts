import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { retry } from '../retry.js';

import type { RetryOptions } from '../retry.js';

// =============================================================================
// Retry Tests
// =============================================================================

// Use fake timers so tests don't actually wait for backoff delays.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Helper: run the retry call while advancing fake timers so sleep() resolves
 * without waiting real time.
 *
 * We attach a no-op catch before handing the promise to the caller so that
 * Node never sees an unhandled rejection — the caller is responsible for
 * asserting on the settled value.
 */
async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
  // Suppress unhandled-rejection warnings; the caller will observe the result.
  promise.catch(() => undefined);
  await vi.runAllTimersAsync();
  return promise;
}

const BASE_OPTS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5_000,
  backoffMultiplier: 2,
};

describe('retry — success paths', () => {
  it('returns the value when fn succeeds on the first attempt', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await runWithTimers(retry(fn, BASE_OPTS));
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the value when fn succeeds on the second attempt', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new Error('transient');
      return 'recovered';
    });
    const result = await runWithTimers(retry(fn, BASE_OPTS));
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns the value when fn succeeds on the last attempt', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < BASE_OPTS.maxAttempts) throw new Error('transient');
      return 'last-chance';
    });
    const result = await runWithTimers(retry(fn, BASE_OPTS));
    expect(result).toBe('last-chance');
    expect(fn).toHaveBeenCalledTimes(BASE_OPTS.maxAttempts);
  });
});

describe('retry — exhaustion', () => {
  it('throws the last error after all attempts are exhausted', async () => {
    const fn = vi.fn(async () => {
      throw new Error('persistent failure');
    });
    await expect(runWithTimers(retry(fn, BASE_OPTS))).rejects.toThrowError(
      'persistent failure',
    );
    expect(fn).toHaveBeenCalledTimes(BASE_OPTS.maxAttempts);
  });

  it('calls fn exactly maxAttempts times on total failure', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      throw new Error('fail');
    };
    await expect(runWithTimers(retry(fn, { ...BASE_OPTS, maxAttempts: 5 }))).rejects.toThrow();
    expect(callCount).toBe(5);
  });
});

describe('retry — shouldRetry predicate', () => {
  it('stops immediately when shouldRetry returns false', async () => {
    const fn = vi.fn(async () => {
      throw new Error('non-retryable');
    });
    const opts: RetryOptions = {
      ...BASE_OPTS,
      shouldRetry: (err) => !err.message.includes('non-retryable'),
    };
    await expect(runWithTimers(retry(fn, opts))).rejects.toThrowError('non-retryable');
    // Should have stopped after the first failure
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('continues retrying while shouldRetry returns true', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('retryable');
      return 'done';
    });
    const opts: RetryOptions = {
      ...BASE_OPTS,
      shouldRetry: (err) => err.message === 'retryable',
    };
    const result = await runWithTimers(retry(fn, opts));
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('distinguishes retryable from non-retryable errors mid-sequence', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('retryable');
      throw new Error('fatal');
    });
    const opts: RetryOptions = {
      ...BASE_OPTS,
      shouldRetry: (err) => err.message === 'retryable',
    };
    await expect(runWithTimers(retry(fn, opts))).rejects.toThrowError('fatal');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('retry — backoff timing', () => {
  it('applies exponential backoff between attempts', async () => {
    const sleepSpy = vi.spyOn(await import('../time.js'), 'sleep').mockResolvedValue();

    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'done';
    };

    const opts: RetryOptions = {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 5_000,
      backoffMultiplier: 2,
    };

    const result = await retry(fn, opts);
    expect(result).toBe('done');

    // First retry: 100 ms, second retry: 200 ms
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 100);
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 200);

    sleepSpy.mockRestore();
  });

  it('caps the delay at maxDelayMs', async () => {
    const sleepSpy = vi.spyOn(await import('../time.js'), 'sleep').mockResolvedValue();

    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 4) throw new Error('fail');
      return 'done';
    };

    const opts: RetryOptions = {
      maxAttempts: 4,
      initialDelayMs: 1_000,
      maxDelayMs: 2_000,
      backoffMultiplier: 10,
    };

    await retry(fn, opts);
    // Delays should be: 1000, min(10000, 2000)=2000, min(20000, 2000)=2000
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 1_000);
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 2_000);
    expect(sleepSpy).toHaveBeenNthCalledWith(3, 2_000);

    sleepSpy.mockRestore();
  });
});

describe('retry — edge cases', () => {
  it('throws RangeError when maxAttempts < 1', async () => {
    const fn = vi.fn(async () => 'value');
    await expect(
      retry(fn, { ...BASE_OPTS, maxAttempts: 0 }),
    ).rejects.toThrowError(RangeError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('succeeds with maxAttempts = 1', async () => {
    const fn = vi.fn(async () => 42);
    const result = await retry(fn, { ...BASE_OPTS, maxAttempts: 1 });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fails immediately with maxAttempts = 1 and a throwing fn', async () => {
    const fn = vi.fn(async () => {
      throw new Error('single shot');
    });
    await expect(retry(fn, { ...BASE_OPTS, maxAttempts: 1 })).rejects.toThrowError(
      'single shot',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error throws in an Error', async () => {
    const fn = vi.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'bare string error';
    });
    await expect(runWithTimers(retry(fn, BASE_OPTS))).rejects.toThrowError(
      'bare string error',
    );
  });
});
