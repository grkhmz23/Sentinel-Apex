// =============================================================================
// Sentinel Apex — Backtest Utilities
// =============================================================================

import { randomUUID } from 'crypto';

/**
 * Generate a unique ID for backtest entities
 */
export function createId(): string {
  return randomUUID();
}

/**
 * Format a date for display in reports
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || '';
}

/**
 * Format a number with commas and fixed decimals
 */
export function formatNumber(num: string | number, decimals = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a percentage
 */
export function formatPercent(num: string | number, decimals = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return `${n.toFixed(decimals)}%`;
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
