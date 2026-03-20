import type {
  RuntimeMismatchDetailView,
  RuntimeMismatchStatus,
  RuntimeRemediationActionType,
} from '@sentinel-apex/runtime';

export function canAcknowledge(status: RuntimeMismatchStatus): boolean {
  return status === 'open' || status === 'reopened' || status === 'acknowledged';
}

export function canRecover(status: RuntimeMismatchStatus): boolean {
  return status === 'open' || status === 'acknowledged' || status === 'reopened' || status === 'recovering';
}

export function canResolve(status: RuntimeMismatchStatus): boolean {
  return status === 'open' || status === 'acknowledged' || status === 'recovering' || status === 'reopened' || status === 'resolved';
}

export function canVerify(status: RuntimeMismatchStatus): boolean {
  return status === 'resolved' || status === 'verified';
}

export function canReopen(status: RuntimeMismatchStatus): boolean {
  return status === 'resolved' || status === 'verified' || status === 'reopened';
}

export function canRunRemediation(
  detail: RuntimeMismatchDetailView,
  remediationType: RuntimeRemediationActionType,
): boolean {
  if (!detail.isActionable || detail.remediationInFlight) {
    return false;
  }

  return detail.recommendedRemediationTypes.includes(remediationType);
}
