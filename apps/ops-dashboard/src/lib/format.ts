const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(value: string | null): string {
  if (value === null) {
    return 'Unavailable';
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

export function isStaleTimestamp(value: string | null, thresholdMs: number): boolean {
  if (value === null) {
    return true;
  }

  return Date.now() - new Date(value).getTime() > thresholdMs;
}
