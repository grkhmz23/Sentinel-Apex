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

async function requestVenues<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api/venues${path}`, {
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

export async function requestRebalanceBundleRecoveryAction(input: {
  bundleId: string;
  recoveryActionType: 'requeue_child_execution';
  targetChildType: 'carry_action' | 'treasury_action' | 'rebalance_proposal';
  targetChildId: string;
  note?: string;
}): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-bundles/${input.bundleId}/recovery-actions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      recoveryActionType: input.recoveryActionType,
      targetChildType: input.targetChildType,
      targetChildId: input.targetChildId,
      ...(input.note !== undefined ? { note: input.note } : {}),
    }),
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

export async function requestRebalanceBundleResolutionAction(input: {
  bundleId: string;
  resolutionActionType:
    | 'accept_partial_application'
    | 'mark_bundle_manually_resolved'
    | 'escalate_bundle_for_review';
  note: string;
}): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-bundles/${input.bundleId}/resolution-actions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      resolutionActionType: input.resolutionActionType,
      note: input.note,
    }),
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

export async function assignRebalanceBundleEscalation(input: {
  bundleId: string;
  ownerId: string;
  note: string;
  dueAt?: string;
}): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-bundles/${input.bundleId}/escalation/assign`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ownerId: input.ownerId,
      note: input.note,
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    }),
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

export async function acknowledgeRebalanceBundleEscalation(input: {
  bundleId: string;
  note?: string;
}): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-bundles/${input.bundleId}/escalation/acknowledge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...(input.note !== undefined ? { note: input.note } : {}),
    }),
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

export async function startRebalanceBundleEscalationReview(input: {
  bundleId: string;
  note?: string;
}): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-bundles/${input.bundleId}/escalation/start-review`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ...(input.note !== undefined ? { note: input.note } : {}),
    }),
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

export async function closeRebalanceBundleEscalation(input: {
  bundleId: string;
  note: string;
}): Promise<unknown> {
  const response = await fetch(`/api/allocator/rebalance-bundles/${input.bundleId}/escalation/close`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      note: input.note,
    }),
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

export async function requestConnectorPromotion(
  venueId: string,
  note?: string,
): Promise<unknown> {
  return requestVenues(`/${venueId}/promotion/request`, {
    method: 'POST',
    body: JSON.stringify({
      ...(note !== undefined ? { note } : {}),
    }),
  });
}

export async function approveConnectorPromotion(
  venueId: string,
  note?: string,
): Promise<unknown> {
  return requestVenues(`/${venueId}/promotion/approve`, {
    method: 'POST',
    body: JSON.stringify({
      ...(note !== undefined ? { note } : {}),
    }),
  });
}

export async function rejectConnectorPromotion(
  venueId: string,
  note: string,
): Promise<unknown> {
  return requestVenues(`/${venueId}/promotion/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function suspendConnectorPromotion(
  venueId: string,
  note: string,
): Promise<unknown> {
  return requestVenues(`/${venueId}/promotion/suspend`, {
    method: 'POST',
    body: JSON.stringify({ note }),
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

// =============================================================================
// CEX Verification API
// =============================================================================

export async function listCexVerificationSessions(sleeveId?: string): Promise<
  Array<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    totalVolumeUsd: string | null;
    realizedPnl: string | null;
    calculatedApy: string | null;
    createdAt: string;
    validatedAt: string | null;
  }>
> {
  const query = sleeveId ? `?sleeveId=${encodeURIComponent(sleeveId)}` : '';
  const response = await fetch(`/api/cex-verification/sessions${query}`, {
    headers: { 'content-type': 'application/json' },
  });

  const payload = (await response.json()) as {
    data?: Array<{
      id: string;
      sleeveId: string;
      platform: string;
      status: string;
      totalTrades: number;
      totalVolumeUsd: string | null;
      realizedPnl: string | null;
      calculatedApy: string | null;
      createdAt: string;
      validatedAt: string | null;
    }>;
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Failed to list CEX sessions: ${response.status}`);
  }

  return payload.data;
}

export async function getCexVerificationSession(sessionId: string): Promise<{
  id: string;
  sleeveId: string;
  platform: string;
  status: string;
  totalTrades: number;
  totalVolumeUsd: string | null;
  realizedPnl: string | null;
  calculatedApy: string | null;
  fileHash: string | null;
  createdAt: string;
  validatedAt: string | null;
  trades: Array<{
    id: string;
    tradeId: string;
    asset: string;
    side: string;
    quantity: string;
    price: string;
    fee: string | null;
    realizedPnl: string | null;
    tradeTime: string;
  }>;
} | null> {
  const response = await fetch(`/api/cex-verification/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { 'content-type': 'application/json' },
  });

  if (response.status === 404) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: {
      id: string;
      sleeveId: string;
      platform: string;
      status: string;
      totalTrades: number;
      totalVolumeUsd: string | null;
      realizedPnl: string | null;
      calculatedApy: string | null;
      fileHash: string | null;
      createdAt: string;
      validatedAt: string | null;
      trades: Array<{
        id: string;
        tradeId: string;
        asset: string;
        side: string;
        quantity: string;
        price: string;
        fee: string | null;
        realizedPnl: string | null;
        tradeTime: string;
      }>;
    };
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Failed to get CEX session: ${response.status}`);
  }

  return payload.data;
}

export async function validateCexCsv(
  csvContent: string,
  platform?: 'binance' | 'okx' | 'bybit' | 'coinbase',
): Promise<{
  valid: boolean;
  detectedPlatform: string | undefined;
  errors: Array<{ row: number; message: string }>;
  preview: Array<{
    tradeId: string;
    symbol: string;
    side: string;
    quantity: string;
    price: string;
    tradeTime: string;
  }> | undefined;
}> {
  const response = await fetch('/api/cex-verification/validate-csv', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ csvContent, platform }),
  });

  const payload = (await response.json()) as {
    data?: {
      valid: boolean;
      detectedPlatform: string | undefined;
      errors: Array<{ row: number; message: string }>;
      preview: Array<{
        tradeId: string;
        symbol: string;
        side: string;
        quantity: string;
        price: string;
        tradeTime: string;
      }> | undefined;
    };
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `CSV validation failed: ${response.status}`);
  }

  return payload.data;
}

export async function createCexVerificationSession(input: {
  sleeveId: string;
  platform: 'binance' | 'okx' | 'bybit' | 'coinbase';
  csvContent: string;
  fileName?: string;
}): Promise<{
  id: string;
  sleeveId: string;
  platform: string;
  status: string;
  totalTrades: number;
  errors: Array<{ row: number; message: string }>;
}> {
  const response = await fetch('/api/cex-verification/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    data?: {
      id: string;
      sleeveId: string;
      platform: string;
      status: string;
      totalTrades: number;
      errors: Array<{ row: number; message: string }>;
    };
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Failed to create CEX session: ${response.status}`);
  }

  return payload.data;
}

export async function calculateCexPnl(
  sessionId: string,
  options: { method?: 'fifo' | 'lifo' | 'avg'; includeFees?: boolean } = {},
): Promise<{
  summary: {
    totalTrades: number;
    totalPnl: string;
    totalFees: string;
    netPnl: string;
    profitableTrades: number;
    losingTrades: number;
    winRate: string;
    largestWin: string;
    largestLoss: string;
    averageWin: string;
    averageLoss: string;
    profitFactor: string;
    tradingDays: number;
    firstTradeAt: string | null;
    lastTradeAt: string | null;
  };
  assets: Array<{
    asset: string;
    summary: {
      totalTrades: number;
      buyVolume: string;
      sellVolume: string;
      realizedPnl: string;
      totalFees: string;
      profitableTrades: number;
      losingTrades: number;
      winRate: string;
      largestWin: string;
      largestLoss: string;
    };
    trades: Array<{
      tradeId: string;
      symbol: string;
      side: 'buy' | 'sell';
      quantity: string;
      price: string;
      fee: string | undefined;
      realizedPnl: string | undefined;
      costBasis: string | undefined;
      tradeTime: string;
    }>;
  }>;
}> {
  const response = await fetch(`/api/cex-verification/sessions/${encodeURIComponent(sessionId)}/calculate-pnl`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      method: options.method ?? 'fifo',
      includeFees: options.includeFees ?? true,
    }),
  });

  const payload = (await response.json()) as {
    data?: {
      summary: {
        totalTrades: number;
        totalPnl: string;
        totalFees: string;
        netPnl: string;
        profitableTrades: number;
        losingTrades: number;
        winRate: string;
        largestWin: string;
        largestLoss: string;
        averageWin: string;
        averageLoss: string;
        profitFactor: string;
        tradingDays: number;
        firstTradeAt: string | null;
        lastTradeAt: string | null;
      };
      assets: Array<{
        asset: string;
        summary: {
          totalTrades: number;
          buyVolume: string;
          sellVolume: string;
          realizedPnl: string;
          totalFees: string;
          profitableTrades: number;
          losingTrades: number;
          winRate: string;
          largestWin: string;
          largestLoss: string;
        };
        trades: Array<{
          tradeId: string;
          symbol: string;
          side: 'buy' | 'sell';
          quantity: string;
          price: string;
          fee: string | undefined;
          realizedPnl: string | undefined;
          costBasis: string | undefined;
          tradeTime: string;
        }>;
      }>;
    };
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `PnL calculation failed: ${response.status}`);
  }

  return payload.data;
}

export async function generateCexSubmissionReport(
  sessionId: string,
  options: { method?: 'fifo' | 'lifo' | 'avg'; includeFees?: boolean } = {},
): Promise<{
  sessionId: string;
  generatedAt: string;
  portfolioSummary: {
    totalTrades: number;
    totalPnl: string;
    totalFees: string;
    winRate: string;
    profitableAssets: number;
    losingAssets: number;
  };
  assetReports: Array<{
    asset: string;
    totalTrades: number;
    realizedPnl: string;
    winRate: string;
  }>;
  hackathonEligibility: {
    hasSufficientTrades: boolean;
    hasPositivePnl: boolean;
    meetsMinimumPeriod: boolean;
  };
}> {
  const query = new URLSearchParams();
  if (options.method) query.set('method', options.method);
  if (options.includeFees !== undefined) query.set('includeFees', String(options.includeFees));

  const response = await fetch(
    `/api/cex-verification/sessions/${encodeURIComponent(sessionId)}/submission-report?${query.toString()}`,
    { headers: { 'content-type': 'application/json' } },
  );

  const payload = (await response.json()) as {
    data?: {
      sessionId: string;
      generatedAt: string;
      portfolioSummary: {
        totalTrades: number;
        totalPnl: string;
        totalFees: string;
        winRate: string;
        profitableAssets: number;
        losingAssets: number;
      };
      assetReports: Array<{
        asset: string;
        totalTrades: number;
        realizedPnl: string;
        winRate: string;
      }>;
      hackathonEligibility: {
        hasSufficientTrades: boolean;
        hasPositivePnl: boolean;
        meetsMinimumPeriod: boolean;
      };
    };
    error?: { message?: string };
  };

  if (!response.ok || payload.data === undefined) {
    throw new Error(payload.error?.message ?? `Failed to generate report: ${response.status}`);
  }

  return payload.data;
}

export async function deleteCexVerificationSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/cex-verification/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? `Failed to delete session: ${response.status}`);
  }
}
