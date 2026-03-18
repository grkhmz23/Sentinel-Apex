import { describe, it, expect, vi } from 'vitest';

import {
  Ok,
  Err,
  isOk,
  isErr,
  mapResult,
  flatMapResult,
  asyncResult,
} from '../result.js';

import type { Result } from '../result.js';

// =============================================================================
// Result Type Tests
// =============================================================================

describe('Ok', () => {
  it('creates a successful result', () => {
    const r = Ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(42);
    }
  });

  it('works with string values', () => {
    const r = Ok('hello');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('hello');
    }
  });

  it('works with object values', () => {
    const payload = { orderId: 'ord-1' };
    const r = Ok(payload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(payload);
    }
  });

  it('works with undefined', () => {
    const r = Ok(undefined);
    expect(r.ok).toBe(true);
  });
});

describe('Err', () => {
  it('creates a failure result with an Error', () => {
    const err = new Error('something went wrong');
    const r = Err(err);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(err);
    }
  });

  it('works with a custom error type', () => {
    const r = Err({ code: 'INSUFFICIENT_FUNDS', amount: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('INSUFFICIENT_FUNDS');
    }
  });
});

describe('isOk', () => {
  it('returns true for Ok results', () => {
    expect(isOk(Ok(1))).toBe(true);
  });

  it('returns false for Err results', () => {
    expect(isOk(Err(new Error()))).toBe(false);
  });

  it('acts as a type guard — value is accessible after check', () => {
    const r: Result<number> = Ok(99);
    if (isOk(r)) {
      // TypeScript should narrow r.value to number here
      expect(r.value).toBe(99);
    }
  });
});

describe('isErr', () => {
  it('returns true for Err results', () => {
    expect(isErr(Err(new Error('fail')))).toBe(true);
  });

  it('returns false for Ok results', () => {
    expect(isErr(Ok('value'))).toBe(false);
  });

  it('acts as a type guard — error is accessible after check', () => {
    const r: Result<number> = Err(new Error('bad'));
    if (isErr(r)) {
      expect(r.error.message).toBe('bad');
    }
  });
});

describe('mapResult', () => {
  it('transforms the value in an Ok result', () => {
    const r = mapResult(Ok(2), (v) => v * 10);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBe(20);
    }
  });

  it('passes an Err result through unchanged', () => {
    const err = new Error('original error');
    const r = mapResult(Err(err), (v: number) => v * 10);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error).toBe(err);
    }
  });

  it('does not call the transform function on Err', () => {
    const fn = vi.fn((v: number) => v + 1);
    mapResult(Err(new Error()), fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('flatMapResult', () => {
  function safeDivide(a: number, b: number): Result<number> {
    if (b === 0) return Err(new Error('division by zero'));
    return Ok(a / b);
  }

  it('chains successful results', () => {
    const r = flatMapResult(Ok(10), (v) => safeDivide(v, 2));
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBe(5);
    }
  });

  it('propagates an initial Err without calling fn', () => {
    const fn = vi.fn((_v: number) => Ok(99));
    const r = flatMapResult(Err(new Error('initial')), fn);
    expect(isErr(r)).toBe(true);
    expect(fn).not.toHaveBeenCalled();
  });

  it('returns the inner Err when fn returns Err', () => {
    const r = flatMapResult(Ok(10), (v) => safeDivide(v, 0));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.message).toBe('division by zero');
    }
  });

  it('chains multiple operations', () => {
    const r = flatMapResult(
      flatMapResult(Ok(20), (v) => safeDivide(v, 4)),
      (v) => safeDivide(v, 5),
    );
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBe(1);
    }
  });
});

describe('asyncResult', () => {
  it('wraps a resolved promise in Ok', async () => {
    const r = await asyncResult(async () => 'success');
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBe('success');
    }
  });

  it('wraps a rejected promise with an Error in Err', async () => {
    const r = await asyncResult(async () => {
      throw new Error('async failure');
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.message).toBe('async failure');
    }
  });

  it('converts non-Error throws to Error', async () => {
    const r = await asyncResult(async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error';
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error).toBeInstanceOf(Error);
      expect(r.error.message).toBe('string error');
    }
  });

  it('resolves with undefined correctly', async () => {
    const r = await asyncResult(async () => undefined);
    expect(isOk(r)).toBe(true);
  });

  it('does not throw even when the inner function throws', async () => {
    await expect(
      asyncResult(async () => {
        throw new Error('boom');
      }),
    ).resolves.toBeDefined();
  });
});
