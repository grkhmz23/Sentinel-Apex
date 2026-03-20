import type { ActionRequestBody } from './types';

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api/runtime${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function triggerCycle(): Promise<unknown> {
  return request('/cycles/run', { method: 'POST' });
}

export async function rebuildProjections(): Promise<unknown> {
  return request('/projections/rebuild', { method: 'POST' });
}

export async function triggerReconciliation(actorId: string): Promise<unknown> {
  return request('/reconciliation/run', {
    method: 'POST',
    body: JSON.stringify({
      triggeredBy: actorId,
      trigger: 'ops_dashboard_manual_reconciliation',
    }),
  });
}

export async function postMismatchAction(
  mismatchId: string,
  action: 'acknowledge' | 'recover' | 'resolve' | 'verify' | 'reopen' | 'remediate',
  body: ActionRequestBody,
): Promise<unknown> {
  switch (action) {
    case 'acknowledge':
      return request(`/mismatches/${mismatchId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({
          acknowledgedBy: body.actorId,
          ...(body.summary !== undefined ? { summary: body.summary } : {}),
        }),
      });
    case 'recover':
      return request(`/mismatches/${mismatchId}/recover`, {
        method: 'POST',
        body: JSON.stringify({
          recoveryBy: body.actorId,
          summary: body.summary ?? 'Recovery started from ops dashboard.',
        }),
      });
    case 'resolve':
      return request(`/mismatches/${mismatchId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          resolvedBy: body.actorId,
          summary: body.summary ?? 'Resolved from ops dashboard.',
        }),
      });
    case 'verify':
      return request(`/mismatches/${mismatchId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          verifiedBy: body.actorId,
          summary: body.summary ?? 'Verified from ops dashboard.',
          outcome: body.verificationOutcome ?? 'verified',
        }),
      });
    case 'reopen':
      return request(`/mismatches/${mismatchId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({
          reopenedBy: body.actorId,
          summary: body.summary ?? 'Reopened from ops dashboard.',
        }),
      });
    case 'remediate':
      return request(`/mismatches/${mismatchId}/remediate`, {
        method: 'POST',
        body: JSON.stringify({
          remediationBy: body.actorId,
          actionType: body.remediationType,
          summary: body.summary ?? 'Remediation requested from ops dashboard.',
        }),
      });
  }
}
