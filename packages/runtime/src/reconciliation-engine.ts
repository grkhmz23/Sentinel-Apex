import Decimal from 'decimal.js';

import { createId } from '@sentinel-apex/domain';
import type { Logger } from '@sentinel-apex/observability';
import type { VenueAdapter, VenuePosition, VenueTruthAdapter } from '@sentinel-apex/venue-adapters';

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
    private readonly truthAdapters: Map<string, VenueTruthAdapter>,
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
        ...(await this.detectVenueTruthFindings(input.sourceComponent, detectedAt)),
        ...(await this.detectDerivativeComparisonFindings(input.sourceComponent, detectedAt)),
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

  private async detectVenueTruthFindings(
    sourceComponent: string,
    detectedAt: Date,
  ): Promise<ReconciliationCandidateFinding[]> {
    const results: ReconciliationCandidateFinding[] = [];
    const venues = await this.store.listVenues(500);
    const venueById = new Map(venues.map((venue) => [venue.venueId, venue] as const));

    for (const adapter of this.truthAdapters.values()) {
      const capability = await adapter.getVenueCapabilitySnapshot();
      if (capability.truthMode !== 'real') {
        continue;
      }

      const venue = venueById.get(capability.venueId);
      const missingSuccessfulSnapshot = venue === undefined || venue.lastSuccessfulSnapshotAt === null;
      const missingSnapshot = await this.toCandidateFinding({
        dedupeKey: `missing_venue_truth_snapshot:${capability.venueId}`,
        findingType: 'missing_venue_truth_snapshot',
        active: missingSuccessfulSnapshot,
        severity: 'high',
        sourceComponent,
        subsystem: 'venue_truth_inventory',
        venueId: capability.venueId,
        entityType: 'venue_connector',
        entityId: capability.venueId,
        summaryActive: `Configured real connector ${capability.venueId} has no successful persisted venue truth snapshot yet.`,
        summaryResolved: `Configured real connector ${capability.venueId} now has a successful persisted venue truth snapshot.`,
        expectedState: {
          truthMode: 'real',
          connectorType: capability.connectorType,
          lastSuccessfulSnapshotAt: 'present',
        },
        actualState: venue === undefined
          ? {
            snapshotFreshness: 'missing',
            lastSuccessfulSnapshotAt: null,
          }
          : {
            truthMode: venue.truthMode,
            connectorType: venue.connectorType,
            snapshotFreshness: venue.snapshotFreshness,
            lastSnapshotAt: venue.lastSnapshotAt,
            lastSuccessfulSnapshotAt: venue.lastSuccessfulSnapshotAt,
            healthState: venue.healthState,
          },
        delta: {
          onboardingState: capability.onboardingState,
          missingPrerequisites: capability.missingPrerequisites,
        },
        details: {
          venueName: capability.venueName,
          authRequirementsSummary: capability.authRequirementsSummary,
        },
        detectedAt,
      });
      if (missingSnapshot !== null) {
        results.push(missingSnapshot);
      }
    }

    for (const venue of venues) {
      if (venue.truthMode !== 'real') {
        continue;
      }

      const staleSnapshot = await this.toCandidateFinding({
        dedupeKey: `stale_venue_truth_snapshot:${venue.venueId}`,
        findingType: 'stale_venue_truth_snapshot',
        active: venue.snapshotFreshness === 'stale',
        severity: 'medium',
        sourceComponent,
        subsystem: 'venue_truth_inventory',
        venueId: venue.venueId,
        entityType: 'venue_connector',
        entityId: venue.venueId,
        summaryActive: `Latest real venue truth snapshot for ${venue.venueId} is stale.`,
        summaryResolved: `Latest real venue truth snapshot for ${venue.venueId} is fresh.`,
        expectedState: {
          snapshotFreshness: 'fresh',
          healthState: 'healthy',
        },
        actualState: {
          snapshotFreshness: venue.snapshotFreshness,
          healthState: venue.healthState,
          truthProfile: venue.truthProfile,
          connectorDepth: venue.sourceMetadata.connectorDepth ?? null,
          lastSnapshotAt: venue.lastSnapshotAt,
          lastSuccessfulSnapshotAt: venue.lastSuccessfulSnapshotAt,
        },
        delta: {
          latestSnapshotType: venue.latestSnapshotType,
        },
        details: {
          venueName: venue.venueName,
          latestSnapshotSummary: venue.latestSnapshotSummary,
          comparisonCoverage: venue.comparisonCoverage,
        },
        detectedAt,
      });
      if (staleSnapshot !== null) {
        results.push(staleSnapshot);
      }

      const unavailableSnapshot = await this.toCandidateFinding({
        dedupeKey: `venue_truth_unavailable:${venue.venueId}`,
        findingType: 'venue_truth_unavailable',
        active: venue.healthState === 'unavailable',
        severity: 'high',
        sourceComponent,
        subsystem: 'venue_truth_inventory',
        venueId: venue.venueId,
        entityType: 'venue_connector',
        entityId: venue.venueId,
        summaryActive: `Real venue truth for ${venue.venueId} is currently unavailable.`,
        summaryResolved: `Real venue truth for ${venue.venueId} is available again.`,
        expectedState: {
          healthState: 'healthy',
          snapshotSuccessful: true,
        },
        actualState: {
          healthState: venue.healthState,
          truthProfile: venue.truthProfile,
          connectorDepth: venue.sourceMetadata.connectorDepth ?? null,
          latestSnapshotType: venue.latestSnapshotType,
          latestErrorMessage: venue.latestErrorMessage,
          lastSnapshotAt: venue.lastSnapshotAt,
        },
        delta: {
          degradedReason: venue.degradedReason,
        },
        details: {
          venueName: venue.venueName,
          latestSnapshotSummary: venue.latestSnapshotSummary,
          comparisonCoverage: venue.comparisonCoverage,
        },
        detectedAt,
      });
      if (unavailableSnapshot !== null) {
        results.push(unavailableSnapshot);
      }

      const partialCoverage = await this.toCandidateFinding({
        dedupeKey: `venue_truth_partial_coverage:${venue.venueId}`,
        findingType: 'venue_truth_partial_coverage',
        active: venue.snapshotCompleteness !== 'complete'
          || venue.truthCoverage.derivativeAccountState.status === 'partial'
          || venue.truthCoverage.derivativePositionState.status === 'partial'
          || venue.truthCoverage.derivativeHealthState.status === 'partial'
          || venue.truthCoverage.orderState.status === 'partial',
        severity: 'low',
        sourceComponent,
        subsystem: 'venue_truth_inventory',
        venueId: venue.venueId,
        entityType: 'venue_connector',
        entityId: venue.venueId,
        summaryActive: `Real venue truth for ${venue.venueId} is only ${venue.snapshotCompleteness}.`,
        summaryResolved: `Real venue truth for ${venue.venueId} now covers its supported depth completely.`,
        expectedState: {
          snapshotCompleteness: 'complete',
          derivativeAccountState: 'available_or_unsupported',
          derivativePositionState: 'available_or_unsupported',
          derivativeHealthState: 'available_or_unsupported',
          orderState: 'available_or_unsupported',
        },
        actualState: {
          truthProfile: venue.truthProfile,
          snapshotCompleteness: venue.snapshotCompleteness,
          connectorDepth: venue.sourceMetadata.connectorDepth ?? null,
          truthCoverage: venue.truthCoverage,
          comparisonCoverage: venue.comparisonCoverage,
          lastSnapshotAt: venue.lastSnapshotAt,
        },
        delta: {
          onboardingState: venue.onboardingState,
          missingPrerequisites: venue.missingPrerequisites,
        },
        details: {
          venueName: venue.venueName,
          latestSnapshotSummary: venue.latestSnapshotSummary,
          sourceMetadata: venue.sourceMetadata,
          comparisonCoverage: venue.comparisonCoverage,
          derivativeCoverage: {
            derivativeAccountState: venue.truthCoverage.derivativeAccountState,
            derivativePositionState: venue.truthCoverage.derivativePositionState,
            derivativeHealthState: venue.truthCoverage.derivativeHealthState,
            orderState: venue.truthCoverage.orderState,
          },
        },
        detectedAt,
      });
      if (partialCoverage !== null) {
        results.push(partialCoverage);
      }

      if (venue.truthCoverage.executionReferences.status !== 'available') {
        continue;
      }

      const [expectedReferences, latestSnapshot] = await Promise.all([
        this.store.listExpectedVenueExecutionReferences(venue.venueId, 100),
        this.store.listVenueSnapshots(venue.venueId, 1),
      ]);
      if (expectedReferences.length === 0) {
        continue;
      }

      const observedReferences = new Set(
        latestSnapshot[0]?.executionReferenceState?.references.map((reference) => reference.reference) ?? [],
      );
      const missingReferences = expectedReferences.filter((reference) => !observedReferences.has(reference));

      const executionReferenceMismatch = await this.toCandidateFinding({
        dedupeKey: `venue_execution_reference_mismatch:${venue.venueId}`,
        findingType: 'venue_execution_reference_mismatch',
        active: missingReferences.length > 0,
        severity: 'medium',
        sourceComponent,
        subsystem: 'venue_truth_inventory',
        venueId: venue.venueId,
        entityType: 'venue_connector',
        entityId: venue.venueId,
        summaryActive: `Real venue truth for ${venue.venueId} is missing ${missingReferences.length} internal execution references.`,
        summaryResolved: `Real venue truth for ${venue.venueId} now includes the internal execution references currently persisted.`,
        expectedState: {
          executionReferences: expectedReferences,
        },
        actualState: {
          observedExecutionReferences: Array.from(observedReferences),
          truthProfile: venue.truthProfile,
          snapshotCompleteness: venue.snapshotCompleteness,
          lastSnapshotAt: venue.lastSnapshotAt,
        },
        delta: {
          missingExecutionReferences: missingReferences,
        },
        details: {
          venueName: venue.venueName,
          latestSnapshotSummary: venue.latestSnapshotSummary,
          orderReferenceMode: latestSnapshot[0]?.orderState?.referenceMode ?? 'none',
          orderCoverage: latestSnapshot[0]?.truthCoverage.orderState ?? null,
          connectorDepth: venue.sourceMetadata.connectorDepth ?? null,
          comparisonCoverage: venue.comparisonCoverage,
        },
        detectedAt,
      });
      if (executionReferenceMismatch !== null) {
        results.push(executionReferenceMismatch);
      }
    }

    return results;
  }

  private async detectDerivativeComparisonFindings(
    sourceComponent: string,
    detectedAt: Date,
  ): Promise<ReconciliationCandidateFinding[]> {
    const results: ReconciliationCandidateFinding[] = [];
    const venues = await this.store.listVenues(500);

    for (const venue of venues) {
      if (venue.truthMode !== 'real' || venue.truthProfile !== 'derivative_aware') {
        continue;
      }

      const [comparisonDetail, sourceWatermark] = await Promise.all([
        this.store.getVenueComparisonDetail(venue.venueId),
        this.store.getInternalDerivativeSourceWatermark(venue.venueId),
      ]);
      if (comparisonDetail === null) {
        continue;
      }

      const staleInternalState = await this.toCandidateFinding({
        dedupeKey: `stale_internal_derivative_state:${venue.venueId}`,
        findingType: 'stale_internal_derivative_state',
        active: sourceWatermark !== null
          && (
            comparisonDetail.summary.internalSnapshotAt === null
            || sourceWatermark > comparisonDetail.summary.internalSnapshotAt
          ),
        severity: 'medium',
        sourceComponent,
        subsystem: 'internal_derivative_state',
        venueId: venue.venueId,
        entityType: 'venue_connector',
        entityId: venue.venueId,
        summaryActive: `Internal derivative state for ${venue.venueId} is stale relative to persisted internal order or fill facts.`,
        summaryResolved: `Internal derivative state for ${venue.venueId} is current against persisted internal order and fill facts.`,
        expectedState: {
          internalSnapshotAt: sourceWatermark ?? comparisonDetail.summary.internalSnapshotAt,
        },
        actualState: {
          internalSnapshotAt: comparisonDetail.summary.internalSnapshotAt,
          sourceWatermark,
        },
        delta: {
          venueName: venue.venueName,
        },
        details: {
          comparisonSummary: comparisonDetail.summary,
        },
        detectedAt,
      });
      if (staleInternalState !== null) {
        results.push(staleInternalState);
      }

      const gapSectionCandidates: Array<{
        section: string;
        coverage: typeof comparisonDetail.summary.subaccountIdentity;
        externallyAvailable: boolean;
      }> = [
        {
          section: 'subaccountIdentity',
          coverage: comparisonDetail.summary.subaccountIdentity,
          externallyAvailable: venue.truthCoverage.derivativeAccountState.status === 'available',
        },
        {
          section: 'positionInventory',
          coverage: comparisonDetail.summary.positionInventory,
          externallyAvailable: venue.truthCoverage.derivativePositionState.status === 'available',
        },
        {
          section: 'marketIdentity',
          coverage: comparisonDetail.summary.marketIdentity,
          externallyAvailable: venue.truthCoverage.derivativePositionState.status === 'available',
        },
        {
          section: 'healthState',
          coverage: comparisonDetail.summary.healthState,
          externallyAvailable: venue.truthCoverage.derivativeHealthState.status === 'available',
        },
        {
          section: 'orderInventory',
          coverage: comparisonDetail.summary.orderInventory,
          externallyAvailable: venue.truthCoverage.orderState.status === 'available',
        },
      ];
      const gapSections = gapSectionCandidates
        .filter((candidate) => candidate.externallyAvailable && candidate.coverage.status !== 'available')
        .map(({ section, coverage }) => ({
          section,
          coverage,
        }));

      const comparisonGap = await this.toCandidateFinding({
        dedupeKey: `drift_truth_comparison_gap:${venue.venueId}`,
        findingType: 'drift_truth_comparison_gap',
        active: gapSections.length > 0,
        severity: 'low',
        sourceComponent,
        subsystem: 'derivative_truth_comparison',
        venueId: venue.venueId,
        entityType: 'venue_connector',
        entityId: venue.venueId,
        summaryActive: `Derivative truth comparison for ${venue.venueId} remains partial or unsupported for ${gapSections.length} section(s).`,
        summaryResolved: `Derivative truth comparison for ${venue.venueId} now covers every externally supported internal section.`,
        expectedState: {
          subaccountIdentity: 'available_or_external_unsupported',
          positionInventory: 'available_or_external_unsupported',
          marketIdentity: 'available_or_external_unsupported',
          healthState: 'available_or_external_unsupported',
          orderInventory: 'available_or_external_unsupported',
        },
        actualState: {
          comparisonSummary: comparisonDetail.summary,
        },
        delta: {
          gapSections: gapSections.map((gap) => ({
            section: gap.section,
            status: gap.coverage.status,
            reason: gap.coverage.reason,
          })),
        },
        details: {
          venueName: venue.venueName,
          comparisonSummary: comparisonDetail.summary,
        },
        detectedAt,
      });
      if (comparisonGap !== null) {
        results.push(comparisonGap);
      }

      const subaccountMismatch = await this.toCandidateFinding({
        dedupeKey: `drift_subaccount_identity_mismatch:${venue.venueId}`,
        findingType: 'drift_subaccount_identity_mismatch',
        active: comparisonDetail.accountComparison.comparable
          && comparisonDetail.accountComparison.status === 'mismatched',
        severity: 'high',
        sourceComponent,
        subsystem: 'derivative_truth_comparison',
        venueId: venue.venueId,
        entityType: 'derivative_account',
        entityId: venue.venueId,
        summaryActive: `Internal derivative account identity for ${venue.venueId} does not match external Drift-native account truth.`,
        summaryResolved: `Internal derivative account identity for ${venue.venueId} matches external Drift-native account truth.`,
        expectedState: comparisonDetail.accountComparison.internalState === null
          ? {}
          : { ...comparisonDetail.accountComparison.internalState },
        actualState: comparisonDetail.accountComparison.externalState === null
          ? {}
          : { ...comparisonDetail.accountComparison.externalState },
        delta: {
          notes: comparisonDetail.accountComparison.notes,
        },
        details: {
          venueName: venue.venueName,
        },
        detectedAt,
      });
      if (subaccountMismatch !== null) {
        results.push(subaccountMismatch);
      }

      const partialHealthComparison = await this.toCandidateFinding({
        dedupeKey: `drift_partial_health_comparison:${venue.venueId}`,
        findingType: 'drift_partial_health_comparison',
        active: comparisonDetail.summary.healthState.status === 'partial',
        severity: 'low',
        sourceComponent,
        subsystem: 'derivative_truth_comparison',
        venueId: venue.venueId,
        entityType: 'derivative_health',
        entityId: venue.venueId,
        summaryActive: `Internal-vs-external health comparison for ${venue.venueId} remains partial.`,
        summaryResolved: `Internal-vs-external health comparison for ${venue.venueId} is no longer partial.`,
        expectedState: {
          healthComparison: 'available_or_external_unsupported',
        },
        actualState: {
          comparisonMode: comparisonDetail.healthComparison.comparisonMode,
          fields: comparisonDetail.healthComparison.fields,
        },
        delta: {
          comparableFields: comparisonDetail.healthComparison.fields
            .filter((field) => field.comparable)
            .map((field) => field.field),
        },
        details: {
          notes: comparisonDetail.healthComparison.notes,
        },
        detectedAt,
      });
      if (partialHealthComparison !== null) {
        results.push(partialHealthComparison);
      }

      const partialMarketIdentityComparison = await this.toCandidateFinding({
        dedupeKey: `drift_partial_market_identity_comparison:${venue.venueId}`,
        findingType: 'drift_partial_market_identity_comparison',
        active: comparisonDetail.summary.marketIdentity.status === 'partial',
        severity: 'low',
        sourceComponent,
        subsystem: 'derivative_truth_comparison',
        venueId: venue.venueId,
        entityType: 'derivative_market_identity',
        entityId: venue.venueId,
        summaryActive: `Market identity comparison for ${venue.venueId} still depends on derived or partial internal keys.`,
        summaryResolved: `Market identity comparison for ${venue.venueId} no longer depends on derived or partial internal keys.`,
        expectedState: {
          marketIdentityComparison: 'available_or_external_unsupported',
        },
        actualState: {
          summary: comparisonDetail.summary,
        },
        delta: {
          exactPositionIdentityCount: comparisonDetail.summary.exactPositionIdentityCount,
          partialPositionIdentityCount: comparisonDetail.summary.partialPositionIdentityCount,
          positionIdentityGapCount: comparisonDetail.summary.positionIdentityGapCount,
        },
        details: {
          venueName: venue.venueName,
        },
        detectedAt,
      });
      if (partialMarketIdentityComparison !== null) {
        results.push(partialMarketIdentityComparison);
      }

      const healthMismatch = await this.toCandidateFinding({
        dedupeKey: `drift_health_state_mismatch:${venue.venueId}`,
        findingType: 'drift_health_state_mismatch',
        active: comparisonDetail.summary.healthState.status === 'available'
          && comparisonDetail.healthComparison.status === 'mismatched',
        severity: 'medium',
        sourceComponent,
        subsystem: 'derivative_truth_comparison',
        venueId: venue.venueId,
        entityType: 'derivative_health',
        entityId: venue.venueId,
        summaryActive: `Internal health state for ${venue.venueId} does not match external Drift-native truth.`,
        summaryResolved: `Internal health state for ${venue.venueId} matches external Drift-native truth.`,
        expectedState: comparisonDetail.healthComparison.internalState === null
          ? {}
          : { ...comparisonDetail.healthComparison.internalState },
        actualState: comparisonDetail.healthComparison.externalState === null
          ? {}
          : { ...comparisonDetail.healthComparison.externalState },
        delta: {
          fields: comparisonDetail.healthComparison.fields,
        },
        details: {
          notes: comparisonDetail.healthComparison.notes,
        },
        detectedAt,
      });
      if (healthMismatch !== null) {
        results.push(healthMismatch);
      }

      for (const comparison of comparisonDetail.positionComparisons) {
        const positionIdentityGap = await this.toCandidateFinding({
          dedupeKey: `drift_position_identity_gap:${venue.venueId}:${comparison.comparisonKey}`,
          findingType: 'drift_position_identity_gap',
          active: comparison.status === 'not_comparable',
          severity: 'low',
          sourceComponent,
          subsystem: 'derivative_truth_comparison',
          venueId: venue.venueId,
          entityType: 'derivative_position',
          entityId: comparison.comparisonKey,
          summaryActive: `Derivative position ${comparison.comparisonKey} on ${venue.venueId} could not be truthfully aligned by market identity.`,
          summaryResolved: `Derivative position ${comparison.comparisonKey} on ${venue.venueId} can now be truthfully aligned by market identity.`,
          expectedState: {
            marketIdentity: 'truthfully_comparable',
          },
          actualState: {
            internalIdentity: comparison.marketIdentityComparison.internalIdentity,
            externalIdentity: comparison.marketIdentityComparison.externalIdentity,
          },
          delta: {
            notes: comparison.marketIdentityComparison.notes,
          },
          details: {
            comparisonStatus: comparison.status,
          },
          detectedAt,
        });
        if (positionIdentityGap !== null) {
          results.push(positionIdentityGap);
        }

        const positionMarketIdentityMismatch = await this.toCandidateFinding({
          dedupeKey: `drift_market_identity_mismatch:${venue.venueId}:position:${comparison.comparisonKey}`,
          findingType: 'drift_market_identity_mismatch',
          active: comparison.marketIdentityComparison.status === 'mismatched'
            && comparison.marketIdentityComparison.comparisonMode === 'exact',
          severity: 'high',
          sourceComponent,
          subsystem: 'derivative_truth_comparison',
          venueId: venue.venueId,
          entityType: 'derivative_market_identity',
          entityId: comparison.comparisonKey,
          summaryActive: `Exact market identity for derivative position ${comparison.comparisonKey} on ${venue.venueId} does not match external Drift truth.`,
          summaryResolved: `Exact market identity for derivative position ${comparison.comparisonKey} on ${venue.venueId} matches external Drift truth.`,
          expectedState: comparison.marketIdentityComparison.internalIdentity === null
            ? {}
            : { ...comparison.marketIdentityComparison.internalIdentity },
          actualState: comparison.marketIdentityComparison.externalIdentity === null
            ? {}
            : { ...comparison.marketIdentityComparison.externalIdentity },
          delta: {
            normalizedIdentity: comparison.marketIdentityComparison.normalizedIdentity,
          },
          details: {
            notes: comparison.marketIdentityComparison.notes,
          },
          detectedAt,
        });
        if (positionMarketIdentityMismatch !== null) {
          results.push(positionMarketIdentityMismatch);
        }

        const positionMismatch = await this.toCandidateFinding({
          dedupeKey: `drift_position_mismatch:${venue.venueId}:${comparison.comparisonKey}`,
          findingType: 'drift_position_mismatch',
          active: comparison.status === 'mismatched'
            || comparison.status === 'internal_only'
            || comparison.status === 'external_only',
          severity: comparison.status === 'matched'
            ? 'low'
            : comparison.status === 'mismatched'
              ? 'high'
              : 'medium',
          sourceComponent,
          subsystem: 'derivative_truth_comparison',
          venueId: venue.venueId,
          entityType: 'derivative_position',
          entityId: comparison.comparisonKey,
          summaryActive: `Internal derivative position ${comparison.comparisonKey} on ${venue.venueId} does not match external Drift-native truth.`,
          summaryResolved: `Internal derivative position ${comparison.comparisonKey} on ${venue.venueId} matches external Drift-native truth.`,
          expectedState: comparison.internalPosition === null ? {} : { ...comparison.internalPosition },
          actualState: comparison.externalPosition === null ? {} : { ...comparison.externalPosition },
          delta: {
            quantityDelta: comparison.quantityDelta,
            status: comparison.status,
          },
          details: {
            notes: comparison.notes,
          },
          detectedAt,
        });
        if (positionMismatch !== null) {
          results.push(positionMismatch);
        }
      }

      for (const comparison of comparisonDetail.orderComparisons) {
        const orderMarketIdentityMismatch = await this.toCandidateFinding({
          dedupeKey: `drift_market_identity_mismatch:${venue.venueId}:order:${comparison.comparisonKey}`,
          findingType: 'drift_market_identity_mismatch',
          active: comparison.marketIdentityComparison.status === 'mismatched'
            && comparison.marketIdentityComparison.comparisonMode === 'exact',
          severity: 'high',
          sourceComponent,
          subsystem: 'derivative_truth_comparison',
          venueId: venue.venueId,
          entityType: 'derivative_market_identity',
          entityId: comparison.comparisonKey,
          summaryActive: `Exact market identity for open order ${comparison.comparisonKey} on ${venue.venueId} does not match external Drift truth.`,
          summaryResolved: `Exact market identity for open order ${comparison.comparisonKey} on ${venue.venueId} matches external Drift truth.`,
          expectedState: comparison.marketIdentityComparison.internalIdentity === null
            ? {}
            : { ...comparison.marketIdentityComparison.internalIdentity },
          actualState: comparison.marketIdentityComparison.externalIdentity === null
            ? {}
            : { ...comparison.marketIdentityComparison.externalIdentity },
          delta: {
            normalizedIdentity: comparison.marketIdentityComparison.normalizedIdentity,
          },
          details: {
            notes: comparison.marketIdentityComparison.notes,
          },
          detectedAt,
        });
        if (orderMarketIdentityMismatch !== null) {
          results.push(orderMarketIdentityMismatch);
        }

        const orderMismatch = await this.toCandidateFinding({
          dedupeKey: `drift_order_inventory_mismatch:${venue.venueId}:${comparison.comparisonKey}`,
          findingType: 'drift_order_inventory_mismatch',
          active: comparison.status === 'mismatched'
            || comparison.status === 'internal_only'
            || comparison.status === 'external_only',
          severity: comparison.status === 'matched' ? 'low' : 'medium',
          sourceComponent,
          subsystem: 'derivative_truth_comparison',
          venueId: venue.venueId,
          entityType: 'derivative_order',
          entityId: comparison.comparisonKey,
          summaryActive: `Internal open-order inventory for ${comparison.comparisonKey} on ${venue.venueId} does not match external Drift-native truth.`,
          summaryResolved: `Internal open-order inventory for ${comparison.comparisonKey} on ${venue.venueId} matches external Drift-native truth.`,
          expectedState: comparison.internalOrder === null ? {} : { ...comparison.internalOrder },
          actualState: comparison.externalOrder === null ? {} : { ...comparison.externalOrder },
          delta: {
            remainingSizeDelta: comparison.remainingSizeDelta,
            status: comparison.status,
          },
          details: {
            notes: comparison.notes,
          },
          detectedAt,
        });
        if (orderMismatch !== null) {
          results.push(orderMismatch);
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
