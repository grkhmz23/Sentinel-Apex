import type {
  RuntimeMismatchStatus,
  RuntimeVerificationOutcome,
} from './types.js';

export type RuntimeMismatchAction =
  | 'acknowledge'
  | 'start_recovery'
  | 'remediation_failed'
  | 'resolve'
  | 'verify'
  | 'reopen';

export class RuntimeMismatchLifecycleError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'RuntimeMismatchLifecycleError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RuntimeMismatchNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'RuntimeMismatchNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function formatStatuses(statuses: RuntimeMismatchStatus[]): string {
  return statuses.join(', ');
}

function assertAllowed(
  currentStatus: RuntimeMismatchStatus,
  action: RuntimeMismatchAction,
  allowed: RuntimeMismatchStatus[],
): void {
  if (allowed.includes(currentStatus)) {
    return;
  }

  throw new RuntimeMismatchLifecycleError(
    `Cannot ${action.replace('_', ' ')} mismatch from status "${currentStatus}". Allowed statuses: ${formatStatuses(allowed)}.`,
  );
}

export function acknowledgeNextStatus(currentStatus: RuntimeMismatchStatus): RuntimeMismatchStatus {
  if (currentStatus === 'acknowledged') {
    return currentStatus;
  }

  assertAllowed(currentStatus, 'acknowledge', ['open', 'reopened', 'acknowledged']);
  return 'acknowledged';
}

export function recoveryNextStatus(currentStatus: RuntimeMismatchStatus): RuntimeMismatchStatus {
  if (currentStatus === 'recovering') {
    return currentStatus;
  }

  assertAllowed(currentStatus, 'start_recovery', ['open', 'acknowledged', 'reopened', 'recovering']);
  return 'recovering';
}

export function resolveNextStatus(currentStatus: RuntimeMismatchStatus): RuntimeMismatchStatus {
  if (currentStatus === 'resolved') {
    return currentStatus;
  }

  assertAllowed(currentStatus, 'resolve', ['open', 'acknowledged', 'recovering', 'reopened', 'resolved']);
  return 'resolved';
}

export function remediationFailureNextStatus(currentStatus: RuntimeMismatchStatus): RuntimeMismatchStatus {
  if (currentStatus === 'reopened') {
    return currentStatus;
  }

  assertAllowed(currentStatus, 'remediation_failed', ['recovering', 'reopened']);
  return 'reopened';
}

export function verifyNextStatus(
  currentStatus: RuntimeMismatchStatus,
  outcome: RuntimeVerificationOutcome,
): RuntimeMismatchStatus {
  if (outcome === 'verified') {
    if (currentStatus === 'verified') {
      return currentStatus;
    }

    assertAllowed(currentStatus, 'verify', ['resolved', 'verified']);
    return 'verified';
  }

  if (currentStatus === 'reopened') {
    return currentStatus;
  }

  assertAllowed(currentStatus, 'verify', ['resolved', 'reopened']);
  return 'reopened';
}

export function reopenNextStatus(currentStatus: RuntimeMismatchStatus): RuntimeMismatchStatus {
  if (currentStatus === 'reopened') {
    return currentStatus;
  }

  assertAllowed(currentStatus, 'reopen', ['resolved', 'verified', 'reopened']);
  return 'reopened';
}

export function isActiveMismatchStatus(status: RuntimeMismatchStatus): boolean {
  return status !== 'verified';
}
