// =============================================================================
// Sentinel Apex — In-Process Metrics Registry
// =============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram';

// ---------------------------------------------------------------------------
// Label key utilities
// ---------------------------------------------------------------------------

function labelsToKey(labels?: Record<string, string>): string {
  if (labels === undefined || Object.keys(labels).length === 0) {
    return '__default__';
  }
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

export interface Counter {
  /** Increment the counter by 1 (or a custom amount). */
  increment(labels?: Record<string, string>, by?: number): void;
  get(labels?: Record<string, string>): number;
}

class CounterImpl implements Counter {
  private readonly _name: string;
  private readonly _values = new Map<string, number>();

  constructor(name: string) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  increment(labels?: Record<string, string>, by = 1): void {
    const key = labelsToKey(labels);
    this._values.set(key, (this._values.get(key) ?? 0) + by);
  }

  get(labels?: Record<string, string>): number {
    return this._values.get(labelsToKey(labels)) ?? 0;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this._values);
  }
}

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------

export interface Gauge {
  set(value: number, labels?: Record<string, string>): void;
  get(labels?: Record<string, string>): number;
}

class GaugeImpl implements Gauge {
  private readonly _name: string;
  private readonly _values = new Map<string, number>();

  constructor(name: string) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  set(value: number, labels?: Record<string, string>): void {
    this._values.set(labelsToKey(labels), value);
  }

  get(labels?: Record<string, string>): number {
    return this._values.get(labelsToKey(labels)) ?? 0;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this._values);
  }
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

export interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
  /** Returns the p-th percentile (0–100) of observed values. */
  getPercentile(pct: number, labels?: Record<string, string>): number;
}

class HistogramImpl implements Histogram {
  private readonly _name: string;
  private readonly _buckets = new Map<string, number[]>();

  constructor(name: string) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  observe(value: number, labels?: Record<string, string>): void {
    const key = labelsToKey(labels);
    const bucket = this._buckets.get(key);
    if (bucket !== undefined) {
      bucket.push(value);
    } else {
      this._buckets.set(key, [value]);
    }
  }

  getPercentile(pct: number, labels?: Record<string, string>): number {
    const key = labelsToKey(labels);
    const raw = this._buckets.get(key);
    if (raw === undefined || raw.length === 0) {
      return 0;
    }
    const sorted = [...raw].sort((a, b) => a - b);
    const index = Math.ceil((pct / 100) * sorted.length) - 1;
    const clamped = Math.max(0, Math.min(index, sorted.length - 1));
    return sorted[clamped] ?? 0;
  }

  snapshot(): Record<string, { count: number; p50: number; p95: number; p99: number }> {
    const result: Record<string, { count: number; p50: number; p95: number; p99: number }> = {};
    for (const [key] of this._buckets) {
      result[key] = {
        count: this._buckets.get(key)?.length ?? 0,
        p50: this.getPercentile(50, key === '__default__' ? undefined : this._keyToLabels(key)),
        p95: this.getPercentile(95, key === '__default__' ? undefined : this._keyToLabels(key)),
        p99: this.getPercentile(99, key === '__default__' ? undefined : this._keyToLabels(key)),
      };
    }
    return result;
  }

  private _keyToLabels(key: string): Record<string, string> {
    if (key === '__default__') return {};
    const labels: Record<string, string> = {};
    for (const part of key.split(',')) {
      const eq = part.indexOf('=');
      if (eq !== -1) {
        labels[part.slice(0, eq)] = part.slice(eq + 1);
      }
    }
    return labels;
  }
}

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface MetricsSnapshot {
  counters: Record<string, Record<string, number>>;
  gauges: Record<string, Record<string, number>>;
  histograms: Record<
    string,
    Record<string, { count: number; p50: number; p95: number; p99: number }>
  >;
  capturedAt: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface MetricsRegistry {
  createCounter(name: string): Counter;
  createGauge(name: string): Gauge;
  createHistogram(name: string): Histogram;
  snapshot(): MetricsSnapshot;
}

class MetricsRegistryImpl implements MetricsRegistry {
  private readonly _counters = new Map<string, CounterImpl>();
  private readonly _gauges = new Map<string, GaugeImpl>();
  private readonly _histograms = new Map<string, HistogramImpl>();

  createCounter(name: string): Counter {
    const existing = this._counters.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const counter = new CounterImpl(name);
    this._counters.set(name, counter);
    return counter;
  }

  createGauge(name: string): Gauge {
    const existing = this._gauges.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const gauge = new GaugeImpl(name);
    this._gauges.set(name, gauge);
    return gauge;
  }

  createHistogram(name: string): Histogram {
    const existing = this._histograms.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const histogram = new HistogramImpl(name);
    this._histograms.set(name, histogram);
    return histogram;
  }

  snapshot(): MetricsSnapshot {
    const counters: Record<string, Record<string, number>> = {};
    for (const [name, counter] of this._counters) {
      counters[name] = counter.snapshot();
    }

    const gauges: Record<string, Record<string, number>> = {};
    for (const [name, gauge] of this._gauges) {
      gauges[name] = gauge.snapshot();
    }

    const histograms: Record<
      string,
      Record<string, { count: number; p50: number; p95: number; p99: number }>
    > = {};
    for (const [name, histogram] of this._histograms) {
      histograms[name] = histogram.snapshot();
    }

    return {
      counters,
      gauges,
      histograms,
      capturedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Default registry singleton with pre-defined metrics
// ---------------------------------------------------------------------------

export const registry: MetricsRegistry = new MetricsRegistryImpl();

/**
 * Total orders submitted, broken down by sleeve, venue, side, and status.
 * Increment on every order state transition.
 */
export const ordersTotal: Counter = registry.createCounter('sentinel_orders_total');

/**
 * Current position size in USD for a given (sleeve, venue, asset) triplet.
 */
export const positionSizeUsd: Gauge = registry.createGauge('sentinel_position_size_usd');

/**
 * Portfolio Net Asset Value in USD. No labels — single global value.
 */
export const portfolioNavUsd: Gauge = registry.createGauge('sentinel_portfolio_nav_usd');

/**
 * Count of risk checks executed, labelled by check_name and result (pass/fail).
 */
export const riskChecksTotal: Counter = registry.createCounter('sentinel_risk_checks_total');

/**
 * Count of trading opportunities detected, labelled by type.
 */
export const opportunityDetectedTotal: Counter = registry.createCounter(
  'sentinel_opportunity_detected_total',
);

/**
 * End-to-end execution latency in milliseconds, labelled by venue.
 */
export const executionLatencyMs: Histogram = registry.createHistogram(
  'sentinel_execution_latency_ms',
);
