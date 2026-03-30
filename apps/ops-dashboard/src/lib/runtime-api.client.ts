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

export async function triggerReconciliation(): Promise<unknown> {
  return request('/reconciliation/run', {
    method: 'POST',
    body: JSON.stringify({
      trigger: 'ops_dashboard_manual_reconciliation',
    }),
  });
}

export async function triggerAllocatorEvaluation(): Promise<unknown> {
  const response = await fetch('/api/allocator/evaluate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function triggerCarryEvaluation(): Promise<unknown> {
  const response = await fetch('/api/carry/evaluate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function approveCarryAction(actionId: string): Promise<unknown> {
  const response = await fetch(`/api/carry/actions/${actionId}/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function approveRebalanceProposal(proposalId: string): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-proposals/${proposalId}/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function rejectRebalanceProposal(proposalId: string, reason: string): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-proposals/${proposalId}/reject`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function triggerTreasuryEvaluation(): Promise<unknown> {
  const response = await fetch('/api/treasury/evaluate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function approveTreasuryAction(actionId: string): Promise<unknown> {
  const response = await fetch(`/api/treasury/actions/${actionId}/approve`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
}

export async function executeTreasuryAction(actionId: string): Promise<unknown> {
  const response = await fetch(`/api/treasury/actions/${actionId}/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    data?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Dashboard request failed: ${response.status}`);
  }

  return payload.data;
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
          ...(body.summary !== undefined ? { summary: body.summary } : {}),
        }),
      });
    case 'recover':
      return request(`/mismatches/${mismatchId}/recover`, {
        method: 'POST',
        body: JSON.stringify({
          summary: body.summary ?? 'Recovery started from ops dashboard.',
        }),
      });
    case 'resolve':
      return request(`/mismatches/${mismatchId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          summary: body.summary ?? 'Resolved from ops dashboard.',
        }),
      });
    case 'verify':
      return request(`/mismatches/${mismatchId}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          summary: body.summary ?? 'Verified from ops dashboard.',
          outcome: body.verificationOutcome ?? 'verified',
        }),
      });
    case 'reopen':
      return request(`/mismatches/${mismatchId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({
          summary: body.summary ?? 'Reopened from ops dashboard.',
        }),
      });
    case 'remediate':
      return request(`/mismatches/${mismatchId}/remediate`, {
        method: 'POST',
        body: JSON.stringify({
          actionType: body.remediationType,
          summary: body.summary ?? 'Remediation requested from ops dashboard.',
        }),
      });
  }
}
