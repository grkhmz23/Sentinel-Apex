// =============================================================================
// Sentinel Apex — Result Type
// =============================================================================
// Explicit error handling without exceptions in domain logic.
// Inspired by Rust's Result<T, E> and fp-ts's Either.
// =============================================================================

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/** Wrap a successful value in a Result. */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wrap a failure value in a Result. */
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return r.ok === false;
}

// ---------------------------------------------------------------------------
// Transformers
// ---------------------------------------------------------------------------

/**
 * Transform the success value of a Result, leaving errors unchanged.
 */
export function mapResult<T, U, E>(
  r: Result<T, E>,
  fn: (v: T) => U,
): Result<U, E> {
  if (r.ok === false) {
    return r;
  }
  return Ok(fn(r.value));
}

/**
 * Chain a function that itself returns a Result.  If `r` is an error it is
 * passed through unchanged; if it is a success the wrapped value is handed to
 * `fn`.
 */
export function flatMapResult<T, U, E>(
  r: Result<T, E>,
  fn: (v: T) => Result<U, E>,
): Result<U, E> {
  if (r.ok === false) {
    return r;
  }
  return fn(r.value);
}

/**
 * Execute an async function and capture any thrown Error as an Err.
 * Non-Error throws are wrapped in a new Error.
 */
export async function asyncResult<T>(
  fn: () => Promise<T>,
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return Ok(value);
  } catch (thrown: unknown) {
    if (thrown instanceof Error) {
      return Err(thrown);
    }
    return Err(new Error(String(thrown)));
  }
}
