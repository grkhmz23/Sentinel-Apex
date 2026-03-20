import Decimal from 'decimal.js';

import { createId } from '@sentinel-apex/domain';
import type { Logger } from '@sentinel-apex/observability';
import type { VenueAdapter, VenuePosition } from '@sentinel-apex/venue-adapters';

import { RuntimeStore } from './store.js';

import type {
  OrderView,
  PositionView,
  RuntimeMismatchView,
  RuntimeReconciliationFindingSeverity,
  RuntimeReconciliationFindingStatus,
  RuntimeReconciliationFindingType,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
} from './types.js';

const POSITION_SIZE_TOLERANCE = new Decimal('0.000001');
const POSITION_RELATIVE_TOLERANCE = new Decimal('0.001');

interface ReconciliationCandidateFinding {
  dedupeKey: string;
  findingType: RuntimeReconciliationFindingType;
  severity: RuntimeReconciliationFindingSeverity;
  status: RuntimeReconciliationFindingStatus;
  sourceComponent: string;
  subsystem: string;
  venueId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  expectedState?: Record<string, unknown>;
  actualState?: Record<string, unknown>;
  delta?: Record<string, unknown>;
  details?: Record<string, unknown>;
  detectedAt: Date;
}

export interface RuntimeReconciliationRunInput {
  trigger: string;
  sourceComponent: string;
  triggerReference?: string | null;
  triggeredBy?: string | null;
}

export interface RuntimeReconciliationRunResult {
  run: RuntimeReconciliationRunView;
  summary: RuntimeReconciliationSummaryView | null;
}

function mismatchDedupeKey(findingDedupeKey: string): string {
  return `reconciliation:${findingDedupeKey}`;
}

function formatJson(value: unknown): string {
  return JSON.stringify(value);
}

function positionViewToVenuePosition(position: PositionView): VenuePosition {
  return {
    venueId: position.venueId,
    asset: position.asset,
    side: position.side === 'short' ? 'short' : 'long',
    size: position.size,
    entryPrice: position.entryPrice,
    markPrice: position.markPrice,
    unrealizedPnl: position.unrealizedPnl,
    marginUsed: '0',
    liquidationPrice: null,
    updatedAt: new Date(position.updatedAt),
  };
}

function classifyPositionSeverity(
  localPosition: VenuePosition,
  actualPosition: VenuePosition,
): RuntimeReconciliationFindingSeverity {
  if (localPosition.side !== actualPosition.side) {
    return 'critical';
  }

  const localSize = new Decimal(localPosition.size);
  const actualSize = new Decimal(actualPosition.size);
  const diff = localSize.minus(actualSize).abs();
  if (diff.lte(POSITION_SIZE_TOLERANCE)) {
    return 'low';
  }

  const referencePrice = new Decimal(actualPosition.entryPrice || actualPosition.markPrice || '0');
  const notionalDiff = diff.times(referencePrice);
  if (notionalDiff.lt(new Decimal('100'))) {
    return 'medium';
  }
  if (notionalDiff.lt(new Decimal('10000'))) {
    return 'high';
  }
  return 'critical';
}

export class RuntimeReconciliationEngine {
  constructor(
    private readonly store: RuntimeStore,
    private readonly adapters: Map<string, VenueAdapter>,
    private readonly logger: Logger,
  ) {}

  async run(input: RuntimeReconciliationRunInput): Promise<RuntimeReconciliationRunResult> {
    const run = await this.store.createReconciliationRun({
      trigger: input.trigger,
      triggerReference: input.triggerReference ?? null,
      sourceComponent: input.sourceComponent,
      triggeredBy: input.triggeredBy ?? null,
    });

    try {
      const detectedAt = new Date();
      const candidates = [
        ...(await this.detectProjectionStateFindings(input.sourceComponent, detectedAt)),
        ...(await this.detectCommandOutcomeFindings(input.sourceComponent, detectedAt)),
        ...(await this.detectOrderStateFindings(input.sourceComponent, detectedAt)),
        ...(await this.detectPositionExposureFindings(input.sourceComponent, detectedAt)),
      ];

      const linkedMismatchIds = new Set<string>();

      for (const candidate of candidates) {
        const linkedMismatch = await this.applyFindingToMismatch(run.id, candidate);
        if (linkedMismatch !== null) {
          linkedMismatchIds.add(linkedMismatch.id);
        }

        await this.store.recordReconciliationFinding({
          reconciliationRunId: run.id,
          dedupeKey: candidate.dedupeKey,
          findingType: candidate.findingType,
          severity: candidate.severity,
          status: candidate.status,
          sourceComponent: candidate.sourceComponent,
          subsystem: candidate.subsystem,
          venueId: candidate.venueId ?? null,
          entityType: candidate.entityType ?? null,
          entityId: candidate.entityId ?? null,
          mismatchId: linkedMismatch?.id ?? null,
          summary: candidate.summary,
          expectedState: candidate.expectedState ?? {},
          actualState: candidate.actualState ?? {},
          delta: candidate.delta ?? {},
          details: candidate.details ?? {},
          detectedAt: candidate.detectedAt,
        });
      }

      await this.store.completeReconciliationRun({
        reconciliationRunId: run.id,
        findingCount: candidates.length,
        linkedMismatchCount: linkedMismatchIds.size,
        summary: {
          trigger: input.trigger,
          sourceComponent: input.sourceComponent,
        },
      });

      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.reconciliation_completed',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: input.sourceComponent,
        data: {
          reconciliationRunId: run.id,
          trigger: input.trigger,
          findingCount: candidates.length,
          linkedMismatchCount: linkedMismatchIds.size,
        },
      });

      const completedRun = await this.store.getReconciliationRun(run.id);
      if (completedRun === null) {
        throw new Error(`Reconciliation run "${run.id}" disappeared after completion`);
      }

      return {
        run: completedRun,
        summary: await this.store.summarizeLatestReconciliation(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.failReconciliationRun({
        reconciliationRunId: run.id,
        errorMessage: message,
        summary: {
          trigger: input.trigger,
          sourceComponent: input.sourceComponent,
        },
      });

      this.logger.error('RuntimeReconciliationEngine.run failed', {
        reconciliationRunId: run.id,
        trigger: input.trigger,
        error: message,
      });

      throw error;
    }
  }

  private async applyFindingToMismatch(
    reconciliationRunId: string,
    finding: ReconciliationCandidateFinding,
  ): Promise<RuntimeMismatchView | null> {
    const dedupeKey = mismatchDedupeKey(finding.dedupeKey);

    if (finding.status === 'active') {
      const { mismatch, outcome } = await this.store.upsertMismatch({
        dedupeKey,
        category: finding.findingType,
        severity: finding.severity,
        sourceKind: 'reconciliation',
        sourceComponent: finding.sourceComponent,
        entityType: finding.entityType ?? null,
        entityId: finding.entityId ?? null,
        summary: finding.summary,
        details: {
          reconciliationRunId,
          subsystem: finding.subsystem,
          venueId: finding.venueId ?? null,
          expectedState: finding.expectedState ?? {},
          actualState: finding.actualState ?? {},
          delta: finding.delta ?? {},
          ...(finding.details ?? {}),
        },
        detectedAt: finding.detectedAt,
      });

      await this.store.recordRecoveryEvent({
        mismatchId: mismatch.id,
        eventType: outcome === 'reopened' ? 'reconciliation_mismatch_reopened' : 'reconciliation_mismatch_detected',
        status: mismatch.status,
        sourceComponent: finding.sourceComponent,
        actorId: finding.sourceComponent,
        message: finding.summary,
        details: {
          reconciliationRunId,
          findingType: finding.findingType,
          findingDedupeKey: finding.dedupeKey,
        },
      });

      return mismatch;
    }

    const existing = await this.store.getMismatchByDedupeKey(dedupeKey);
    if (existing === null || existing.status === 'verified') {
      return existing;
    }

    const resolved = await this.store.updateMismatchByDedupeKey(dedupeKey, {
      status: 'resolved',
      resolvedAt: finding.detectedAt,
      resolvedBy: finding.sourceComponent,
      resolutionSummary: finding.summary,
      lastStatusChangeAt: finding.detectedAt,
    });

    if (resolved !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId: resolved.id,
        eventType: 'reconciliation_mismatch_resolved',
        status: 'resolved',
        sourceComponent: finding.sourceComponent,
        actorId: finding.sourceComponent,
        message: finding.summary,
        details: {
          reconciliationRunId,
          findingType: finding.findingType,
          findingDedupeKey: finding.dedupeKey,
        },
      });
    }

    return resolved;
  }

  private async detectProjectionStateFindings(
    sourceComponent: string,
    detectedAt: Date,
  ): Promise<ReconciliationCandidateFinding[]> {
    const results: ReconciliationCandidateFinding[] = [];
    const [runtimeStatus, sources, latestPortfolioSnapshot, latestRiskSnapshot, portfolioCurrent, riskCurrent] = await Promise.all([
      this.store.getRuntimeStatus(),
      this.store.getProjectionSources(),
      this.store.getLatestPortfolioSnapshotRow(),
      this.store.getLatestRiskSnapshotRow(),
      this.store.getPortfolioCurrentRow(),
      this.store.getRiskCurrentRow(),
    ]);

    const staleKey = 'stale_projection_state:runtime_state:primary';
    const staleExpected = {
      projectionStatus: 'fresh',
      lastProjectionSourceRunId: sources.latestSuccessfulRunId,
    };
    const staleActual = {
      projectionStatus: runtimeStatus.projectionStatus,
      lastProjectionSourceRunId: runtimeStatus.lastProjectionSourceRunId,
    };
    const staleActive = runtimeStatus.projectionStatus !== 'fresh'
      || (
        sources.latestSuccessfulRunId !== null
        && runtimeStatus.lastProjectionSourceRunId !== sources.latestSuccessfulRunId
      );

    const staleFinding = await this.toCandidateFinding({
      dedupeKey: staleKey,
      findingType: 'stale_projection_state',
      active: staleActive,
      severity: 'medium',
      sourceComponent,
      subsystem: 'runtime_projection',
      entityType: 'runtime_state',
      entityId: 'primary',
      summaryActive: 'Runtime projection metadata is stale or not aligned with the latest successful run.',
      summaryResolved: 'Runtime projection metadata is aligned and fresh.',
      expectedState: staleExpected,
      actualState: staleActual,
      delta: {
        latestSuccessfulRunId: sources.latestSuccessfulRunId,
      },
      detectedAt,
    });
    if (staleFinding !== null) {
      results.push(staleFinding);
    }

    if (latestPortfolioSnapshot !== null) {
      const expectedState = {
        sourceRunId: latestPortfolioSnapshot.sourceRunId ?? null,
        totalNav: latestPortfolioSnapshot.totalNav,
        grossExposure: latestPortfolioSnapshot.grossExposure,
        netExposure: latestPortfolioSnapshot.netExposure,
        liquidityReserve: latestPortfolioSnapshot.liquidityReserve,
      };
      const actualState = portfolioCurrent === null
        ? {}
        : {
          sourceRunId: portfolioCurrent.sourceRunId ?? null,
          totalNav: portfolioCurrent.totalNav,
          grossExposure: portfolioCurrent.grossExposure,
          netExposure: portfolioCurrent.netExposure,
          liquidityReserve: portfolioCurrent.liquidityReserve,
        };
      const active = portfolioCurrent === null
        || formatJson(expectedState) !== formatJson(actualState);

      const portfolioFinding = await this.toCandidateFinding({
        dedupeKey: 'projection_state_mismatch:portfolio_current:primary',
        findingType: 'projection_state_mismatch',
        active,
        severity: 'high',
        sourceComponent,
        subsystem: 'portfolio_projection',
        entityType: 'portfolio_current',
        entityId: 'primary',
        summaryActive: 'Portfolio current projection does not match the latest durable portfolio snapshot.',
        summaryResolved: 'Portfolio current projection matches the latest durable portfolio snapshot.',
        expectedState,
        actualState,
        delta: {
          expectedSourceRunId: latestPortfolioSnapshot.sourceRunId ?? null,
          actualSourceRunId: portfolioCurrent?.sourceRunId ?? null,
        },
        detectedAt,
      });
      if (portfolioFinding !== null) {
        results.push(portfolioFinding);
      }
    }

    if (latestRiskSnapshot !== null) {
      const expectedState = {
        sourceRunId: latestRiskSnapshot.runId,
        approvedIntentCount: latestRiskSnapshot.approvedIntentCount,
        rejectedIntentCount: latestRiskSnapshot.rejectedIntentCount,
        summary: latestRiskSnapshot.summary,
      };
      const actualState = riskCurrent === null
        ? {}
        : {
          sourceRunId: riskCurrent.sourceRunId,
          approvedIntentCount: riskCurrent.approvedIntentCount,
          rejectedIntentCount: riskCurrent.rejectedIntentCount,
          summary: riskCurrent.summary,
        };
      const active = riskCurrent === null
        || formatJson(expectedState) !== formatJson(actualState);

      const riskFinding = await this.toCandidateFinding({
        dedupeKey: 'projection_state_mismatch:risk_current:primary',
        findingType: 'projection_state_mismatch',
        active,
        severity: 'high',
        sourceComponent,
        subsystem: 'risk_projection',
        entityType: 'risk_current',
        entityId: 'primary',
        summaryActive: 'Risk current projection does not match the latest durable risk snapshot.',
        summaryResolved: 'Risk current projection matches the latest durable risk snapshot.',
        expectedState,
        actualState,
        delta: {
          expectedSourceRunId: latestRiskSnapshot.runId,
          actualSourceRunId: riskCurrent?.sourceRunId ?? null,
        },
        detectedAt,
      });
      if (riskFinding !== null) {
        results.push(riskFinding);
      }
    }

    return results;
  }

  private async detectCommandOutcomeFindings(
    sourceComponent: string,
    detectedAt: Date,
  ): Promise<ReconciliationCandidateFinding[]> {
    const results: ReconciliationCandidateFinding[] = [];
    const commands = await this.store.listRuntimeCommands(100);
    const runtimeStatus = await this.store.getRuntimeStatus();

    for (const command of commands) {
      if (command.status !== 'completed') {
        continue;
      }

      if (command.commandType === 'run_cycle') {
        const runId = typeof command.result['runId'] === 'string' ? String(command.result['runId']) : null;
        const strategyRun = runId === null ? null : await this.store.getStrategyRun(runId);
        const active = runId === null || strategyRun === null || strategyRun.status !== 'completed';

        const candidate = await this.toCandidateFinding({
          dedupeKey: `command_outcome_mismatch:${command.commandId}`,
          findingType: 'command_outcome_mismatch',
          active,
          severity: 'high',
          sourceComponent,
          subsystem: 'runtime_commands',
          entityType: 'runtime_command',
          entityId: command.commandId,
          summaryActive: `Completed run_cycle command ${command.commandId} does not link to a completed strategy run outcome.`,
          summaryResolved: `Completed run_cycle command ${command.commandId} links to a completed strategy run outcome.`,
          expectedState: {
            commandType: command.commandType,
            strategyRunStatus: 'completed',
          },
          actualState: {
            resultRunId: runId,
            strategyRunStatus: strategyRun?.status ?? null,
          },
          delta: {
            commandId: command.commandId,
          },
          detectedAt,
        });
        if (candidate !== null) {
          results.push(candidate);
        }
        continue;
      }

      if (command.commandType === 'rebuild_projections') {
        const resultProjectionStatus = typeof command.result['projectionStatus'] === 'string'
          ? String(command.result['projectionStatus'])
          : null;
        const resultSourceRunId = typeof command.result['lastProjectionSourceRunId'] === 'string'
          ? String(command.result['lastProjectionSourceRunId'])
          : null;
        const active = runtimeStatus.projectionStatus !== 'fresh'
          || (resultProjectionStatus !== null && resultProjectionStatus !== runtimeStatus.projectionStatus)
          || resultSourceRunId !== runtimeStatus.lastProjectionSourceRunId;

        const candidate = await this.toCandidateFinding({
          dedupeKey: `command_outcome_mismatch:${command.commandId}`,
          findingType: 'command_outcome_mismatch',
          active,
          severity: 'medium',
          sourceComponent,
          subsystem: 'runtime_commands',
          entityType: 'runtime_command',
          entityId: command.commandId,
          summaryActive: `Completed rebuild_projections command ${command.commandId} does not match the current runtime projection state.`,
          summaryResolved: `Completed rebuild_projections command ${command.commandId} matches the current runtime projection state.`,
          expectedState: {
            projectionStatus: resultProjectionStatus ?? 'fresh',
            lastProjectionSourceRunId: resultSourceRunId,
          },
          actualState: {
            projectionStatus: runtimeStatus.projectionStatus,
            lastProjectionSourceRunId: runtimeStatus.lastProjectionSourceRunId,
          },
          delta: {
            commandId: command.commandId,
          },
          detectedAt,
        });
        if (candidate !== null) {
          results.push(candidate);
        }
        continue;
      }

      if (command.commandType === 'run_reconciliation') {
        const reconciliationRunId = typeof command.result['reconciliationRunId'] === 'string'
          ? String(command.result['reconciliationRunId'])
          : null;
        const reconciliationRun = reconciliationRunId === null
          ? null
          : await this.store.getReconciliationRun(reconciliationRunId);
        const active = reconciliationRunId === null
          || reconciliationRun === null
          || reconciliationRun.status !== 'completed';

        const candidate = await this.toCandidateFinding({
          dedupeKey: `command_outcome_mismatch:${command.commandId}`,
          findingType: 'command_outcome_mismatch',
          active,
          severity: 'medium',
          sourceComponent,
          subsystem: 'runtime_commands',
          entityType: 'runtime_command',
          entityId: command.commandId,
          summaryActive: `Completed run_reconciliation command ${command.commandId} does not link to a completed reconciliation run.`,
          summaryResolved: `Completed run_reconciliation command ${command.commandId} links to a completed reconciliation run.`,
          expectedState: {
            reconciliationRunStatus: 'completed',
          },
          actualState: {
            reconciliationRunId,
            reconciliationRunStatus: reconciliationRun?.status ?? null,
          },
          delta: {
            commandId: command.commandId,
          },
          detectedAt,
        });
        if (candidate !== null) {
          results.push(candidate);
        }
      }
    }

    return results;
  }

  private async detectOrderStateFindings(
    sourceComponent: string,
    detectedAt: Date,
  ): Promise<ReconciliationCandidateFinding[]> {
    const results: ReconciliationCandidateFinding[] = [];

    for (const [venueId, adapter] of this.adapters) {
      const localOrders = await this.store.listOrdersByVenue(venueId);

      for (const order of localOrders) {
        if (order.venueOrderId === null) {
          continue;
        }

        const actualOrder = await adapter.getOrder(order.venueOrderId);
        const active = this.isOrderMismatch(order, actualOrder);

        const candidate = await this.toCandidateFinding({
          dedupeKey: `order_state_mismatch:${venueId}:${order.clientOrderId}`,
          findingType: 'order_state_mismatch',
          active,
          severity: actualOrder === null ? 'high' : 'medium',
          sourceComponent,
          subsystem: 'execution_orders',
          venueId,
          entityType: 'order',
          entityId: order.clientOrderId,
          summaryActive: actualOrder === null
            ? `Persisted order ${order.clientOrderId} is missing from venue state for ${venueId}.`
            : `Persisted order ${order.clientOrderId} does not match venue state for ${venueId}.`,
          summaryResolved: `Persisted order ${order.clientOrderId} matches venue state for ${venueId}.`,
          expectedState: {
            status: order.status,
            venueOrderId: order.venueOrderId,
            filledSize: order.filledSize,
            averageFillPrice: order.averageFillPrice,
          },
          actualState: actualOrder === null
            ? {
              venueOrderId: order.venueOrderId,
              status: null,
            }
            : {
              venueOrderId: actualOrder.venueOrderId,
              status: actualOrder.status,
              filledSize: actualOrder.filledSize,
              averageFillPrice: actualOrder.averageFillPrice,
            },
          delta: {
            localStatus: order.status,
            actualStatus: actualOrder?.status ?? null,
          },
          details: {
            localOrderId: order.clientOrderId,
            venueOrderId: order.venueOrderId,
          },
          detectedAt,
        });
        if (candidate !== null) {
          results.push(candidate);
        }
      }
    }

    return results;
  }

  private async detectPositionExposureFindings(
    sourceComponent: string,
    detectedAt: Date,
  ): Promise<ReconciliationCandidateFinding[]> {
    const results: ReconciliationCandidateFinding[] = [];

    for (const [venueId, adapter] of this.adapters) {
      const [localPositions, actualPositions] = await Promise.all([
        this.store.listPositionsByVenue(venueId),
        adapter.getPositions(),
      ]);

      const localByAsset = new Map(localPositions.map((position) => [position.asset, positionViewToVenuePosition(position)]));
      const actualByAsset = new Map(actualPositions.map((position) => [position.asset, position]));
      const assets = new Set<string>([
        ...Array.from(localByAsset.keys()),
        ...Array.from(actualByAsset.keys()),
      ]);

      for (const asset of assets) {
        const localPosition = localByAsset.get(asset);
        const actualPosition = actualByAsset.get(asset);
        const active = this.isPositionMismatch(localPosition ?? null, actualPosition ?? null);
        const severity = localPosition === undefined || actualPosition === undefined
          ? 'high'
          : classifyPositionSeverity(localPosition, actualPosition);

        const candidate = await this.toCandidateFinding({
          dedupeKey: `position_exposure_mismatch:${venueId}:${asset}`,
          findingType: 'position_exposure_mismatch',
          active,
          severity,
          sourceComponent,
          subsystem: 'position_projection',
          venueId,
          entityType: 'position',
          entityId: asset,
          summaryActive: `Projected position state for ${asset} on ${venueId} does not match venue-reconciled position state.`,
          summaryResolved: `Projected position state for ${asset} on ${venueId} matches venue-reconciled position state.`,
          expectedState: localPosition === undefined ? {} : {
            side: localPosition.side,
            size: localPosition.size,
            entryPrice: localPosition.entryPrice,
          },
          actualState: actualPosition === undefined ? {} : {
            side: actualPosition.side,
            size: actualPosition.size,
            entryPrice: actualPosition.entryPrice,
          },
          delta: {
            localPresent: localPosition !== undefined,
            actualPresent: actualPosition !== undefined,
          },
          details: {
            asset,
            venueId,
          },
          detectedAt,
        });
        if (candidate !== null) {
          results.push(candidate);
        }
      }
    }

    return results;
  }

  private isOrderMismatch(
    localOrder: OrderView,
    actualOrder: Awaited<ReturnType<VenueAdapter['getOrder']>>,
  ): boolean {
    if (actualOrder === null) {
      return localOrder.status !== 'failed' && localOrder.status !== 'cancelled';
    }

    if (localOrder.status === 'filled') {
      return actualOrder.status !== 'filled';
    }

    if (localOrder.status === 'failed' || localOrder.status === 'cancelled') {
      return actualOrder.status === 'filled' || actualOrder.status === 'partially_filled';
    }

    return actualOrder.status !== 'submitted' && actualOrder.status !== 'partially_filled';
  }

  private isPositionMismatch(
    localPosition: VenuePosition | null,
    actualPosition: VenuePosition | null,
  ): boolean {
    if (localPosition === null || actualPosition === null) {
      return localPosition !== actualPosition;
    }

    if (localPosition.side !== actualPosition.side) {
      return true;
    }

    const localSize = new Decimal(localPosition.size);
    const actualSize = new Decimal(actualPosition.size);
    const diff = localSize.minus(actualSize).abs();
    const reference = Decimal.max(localSize, actualSize);
    const relativeDiff = reference.isZero() ? new Decimal('0') : diff.div(reference);
    return diff.gt(POSITION_SIZE_TOLERANCE) && relativeDiff.gt(POSITION_RELATIVE_TOLERANCE);
  }

  private async toCandidateFinding(input: {
    dedupeKey: string;
    findingType: RuntimeReconciliationFindingType;
    active: boolean;
    severity: RuntimeReconciliationFindingSeverity;
    sourceComponent: string;
    subsystem: string;
    venueId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    summaryActive: string;
    summaryResolved: string;
    expectedState?: Record<string, unknown>;
    actualState?: Record<string, unknown>;
    delta?: Record<string, unknown>;
    details?: Record<string, unknown>;
    detectedAt: Date;
  }): Promise<ReconciliationCandidateFinding | null> {
    const mismatch = await this.store.getMismatchByDedupeKey(mismatchDedupeKey(input.dedupeKey));
    const shouldEmitResolution = !input.active && mismatch !== null && mismatch.status !== 'verified';
    if (!input.active && !shouldEmitResolution) {
      return null;
    }

    return {
      dedupeKey: input.dedupeKey,
      findingType: input.findingType,
      severity: input.severity,
      status: input.active ? 'active' : 'resolved',
      sourceComponent: input.sourceComponent,
      subsystem: input.subsystem,
      venueId: input.venueId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.active || !shouldEmitResolution ? input.summaryActive : input.summaryResolved,
      expectedState: input.expectedState ?? {},
      actualState: input.actualState ?? {},
      delta: input.delta ?? {},
      details: input.details ?? {},
      detectedAt: input.detectedAt,
    };
  }
}
