import { RuntimeStore } from './store.js';

export class RuntimeHealthMonitor {
  constructor(private readonly store: RuntimeStore) {}

  async reconcileExecutionConsistency(runId: string, sourceComponent: string): Promise<void> {
    const approvedIntentCount = await this.store.countApprovedIntentsForRun(runId);
    const orderCount = await this.store.countOrdersForRun(runId);
    const dedupeKey = `execution_state_mismatch:${runId}`;

    if (orderCount < approvedIntentCount) {
      const { mismatch, outcome } = await this.store.upsertMismatch({
        dedupeKey,
        category: 'execution_state_mismatch',
        severity: 'high',
        sourceComponent,
        entityType: 'strategy_run',
        entityId: runId,
        summary: `Approved intents exceeded persisted orders for run ${runId}.`,
        details: {
          runId,
          approvedIntentCount,
          persistedOrderCount: orderCount,
        },
        detectedAt: new Date(),
      });

      await this.store.recordRecoveryEvent({
        mismatchId: mismatch.id,
        runId,
        eventType: outcome === 'reopened' ? 'execution_mismatch_reopened' : 'execution_mismatch_detected',
        status: mismatch.status,
        sourceComponent,
        message: mismatch.summary,
        details: mismatch.details,
      });
      return;
    }

    const resolved = await this.resolveMismatchByDedupeKey(
      dedupeKey,
      sourceComponent,
      `Execution records are consistent for run ${runId}.`,
    );

    if (resolved !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId: resolved.id,
        runId,
        eventType: 'execution_mismatch_resolved',
        status: 'resolved',
        sourceComponent,
        message: resolved.resolutionSummary ?? 'Execution mismatch resolved.',
        details: {
          runId,
          approvedIntentCount,
          persistedOrderCount: orderCount,
        },
      });
    }
  }

  async reconcileProjectionConsistency(sourceComponent: string): Promise<void> {
    const snapshot = await this.store.getProjectionSources();
    const targetRunId = snapshot.latestSuccessfulRunId;

    await this.handleProjectionMismatch({
      dedupeKey: 'projection_mismatch:runtime_state',
      category: 'projection_mismatch',
      sourceComponent,
      entityType: 'runtime_state',
      entityId: 'primary',
      expectedRunId: targetRunId,
      actualRunId: snapshot.runtimeProjectionSourceRunId,
      projectionStatus: snapshot.projectionStatus,
      summary: 'Runtime projection source run is stale or missing.',
    });

    await this.handleProjectionMismatch({
      dedupeKey: 'projection_mismatch:risk_current',
      category: 'projection_mismatch',
      sourceComponent,
      entityType: 'risk_current',
      entityId: 'primary',
      expectedRunId: targetRunId,
      actualRunId: snapshot.riskCurrentSourceRunId,
      projectionStatus: snapshot.projectionStatus,
      summary: 'Risk current projection does not match the latest successful run.',
    });

    await this.handleProjectionMismatch({
      dedupeKey: 'projection_mismatch:portfolio_current',
      category: 'projection_mismatch',
      sourceComponent,
      entityType: 'portfolio_current',
      entityId: 'primary',
      expectedRunId: targetRunId,
      actualRunId: snapshot.portfolioCurrentSourceRunId,
      projectionStatus: snapshot.projectionStatus,
      summary: 'Portfolio current projection does not match the latest successful run.',
    });
  }

  async recordRuntimeFailure(sourceComponent: string, runId: string | null, message: string): Promise<void> {
    const { mismatch, outcome } = await this.store.upsertMismatch({
      dedupeKey: 'runtime_failure:primary',
      category: 'runtime_failure',
      severity: 'high',
      sourceComponent,
      entityType: 'runtime_state',
      entityId: 'primary',
      summary: message,
      details: {
        runId,
      },
      detectedAt: new Date(),
    });

    await this.store.recordRecoveryEvent({
      mismatchId: mismatch.id,
      runId,
      eventType: outcome === 'reopened' ? 'runtime_failure_reopened' : 'runtime_failure_detected',
      status: mismatch.status,
      sourceComponent,
      message,
      details: {
        runId,
      },
    });
  }

  async resolveRuntimeFailure(sourceComponent: string, runId: string | null): Promise<void> {
    const resolved = await this.resolveMismatchByDedupeKey(
      'runtime_failure:primary',
      sourceComponent,
      'Runtime recovered and completed a healthy execution path.',
    );

    if (resolved !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId: resolved.id,
        runId,
        eventType: 'runtime_failure_resolved',
        status: 'resolved',
        sourceComponent,
        message: resolved.resolutionSummary ?? 'Runtime failure resolved.',
        details: {
          runId,
        },
      });
    }
  }

  private async handleProjectionMismatch(input: {
    dedupeKey: string;
    category: string;
    sourceComponent: string;
    entityType: string;
    entityId: string;
    expectedRunId: string | null;
    actualRunId: string | null;
    projectionStatus: string;
    summary: string;
  }): Promise<void> {
    if (
      input.expectedRunId === null
      || (input.actualRunId === input.expectedRunId && input.projectionStatus === 'fresh')
    ) {
      const resolved = await this.resolveMismatchByDedupeKey(
        input.dedupeKey,
        input.sourceComponent,
        `Projection ${input.entityType} is aligned with the latest successful run.`,
      );

      if (resolved !== null) {
        await this.store.recordRecoveryEvent({
          mismatchId: resolved.id,
          eventType: 'projection_mismatch_resolved',
          status: 'resolved',
          sourceComponent: input.sourceComponent,
          message: resolved.resolutionSummary ?? 'Projection mismatch resolved.',
          details: {
            entityType: input.entityType,
            entityId: input.entityId,
            expectedRunId: input.expectedRunId,
            actualRunId: input.actualRunId,
          },
        });
      }
      return;
    }

    const { mismatch, outcome } = await this.store.upsertMismatch({
      dedupeKey: input.dedupeKey,
      category: input.category,
      severity: 'medium',
      sourceComponent: input.sourceComponent,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      details: {
        expectedRunId: input.expectedRunId,
        actualRunId: input.actualRunId,
        projectionStatus: input.projectionStatus,
      },
      detectedAt: new Date(),
    });

    await this.store.recordRecoveryEvent({
      mismatchId: mismatch.id,
      eventType: outcome === 'reopened' ? 'projection_mismatch_reopened' : 'projection_mismatch_detected',
      status: mismatch.status,
      sourceComponent: input.sourceComponent,
      message: mismatch.summary,
      details: mismatch.details,
    });
  }

  private async resolveMismatchByDedupeKey(
    dedupeKey: string,
    sourceComponent: string,
    resolutionSummary: string,
  ): Promise<Awaited<ReturnType<RuntimeStore['updateMismatchByDedupeKey']>>> {
    const existing = await this.store.getMismatchByDedupeKey(dedupeKey);
    if (existing === null || existing.status === 'verified') {
      return null;
    }

    return this.store.updateMismatchByDedupeKey(dedupeKey, {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: sourceComponent,
      resolutionSummary,
      lastStatusChangeAt: new Date(),
    });
  }
}
