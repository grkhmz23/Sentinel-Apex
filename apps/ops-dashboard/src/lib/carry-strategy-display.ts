export function carryStrategyEligibilityTone(
  status: string,
): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  return status === 'eligible' ? 'good' : 'bad';
}

export function carryStrategyRuleTone(
  status: string,
): 'neutral' | 'good' | 'warn' | 'bad' | 'accent' {
  return status === 'pass' ? 'good' : 'bad';
}

export function formatCarryStrategyEvidenceLabel(value: string): string {
  return value
    .split('_')
    .join(' ');
}

export function formatCarryStrategyEnvironment(value: string): string {
  switch (value) {
    case 'devnet':
      return 'Devnet';
    case 'backtest':
      return 'Backtest';
    case 'live':
      return 'Live';
    default:
      return 'Unknown';
  }
}

