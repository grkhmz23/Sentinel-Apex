// =============================================================================
// Sentinel Apex — Time Utilities
// =============================================================================

/** Return the current wall-clock time as an ISO 8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Return the current wall-clock time as Unix epoch milliseconds. */
export function nowMs(): number {
  return Date.now();
}

/** Convert a Date object to an ISO 8601 string. */
export function toIso(date: Date): string {
  return date.toISOString();
}

/** Parse an ISO 8601 string into a Date object. */
export function fromIso(iso: string): Date {
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new RangeError(`Invalid ISO 8601 string: "${iso}"`);
  }
  return d;
}

/** Return a new Date that is `seconds` seconds after `date`. */
export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

/**
 * Return the signed difference `a - b` in milliseconds.
 * A positive result means `a` is later than `b`.
 */
export function diffMs(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/**
 * Returns `true` if `lastUpdated` is older than `maxAgeMs` milliseconds
 * relative to the current time.
 */
export function isStale(lastUpdated: Date, maxAgeMs: number): boolean {
  return Date.now() - lastUpdated.getTime() > maxAgeMs;
}

/** Resolve after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
