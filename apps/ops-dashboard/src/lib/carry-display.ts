export function carryStatusTone(
  status: string,
): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'good';
    case 'failed':
    case 'cancelled':
      return 'bad';
    case 'recommended':
    case 'queued':
    case 'executing':
      return 'accent';
    default:
      return 'warn';
  }
}

export function carryReadinessTone(
  readiness: string,
): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  return readiness === 'actionable' ? 'good' : 'warn';
}

export function carryModeTone(
  mode: string,
): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  return mode === 'live' ? 'good' : 'warn';
}

export function carryOnboardingTone(
  onboardingState: string,
): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  switch (onboardingState) {
    case 'approved_for_live':
      return 'good';
    case 'ready_for_review':
      return 'accent';
    case 'read_only':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function formatCarryOnboardingState(value: string): string {
  return value
    .split('_')
    .join(' ');
}
