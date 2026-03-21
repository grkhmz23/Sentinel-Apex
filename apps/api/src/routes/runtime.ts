import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function runtimeRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/runtime/status',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await controlPlane.getRuntimeOverview();
      return reply.status(200).send({
        data: status,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: { trigger?: string; triggerReference?: string };
  }>(
    '/api/v1/runtime/reconciliation/run',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const command = await controlPlane.enqueueReconciliationRun(operator.operatorId, {
        trigger: request.body.trigger ?? 'api_manual_reconciliation',
        ...(request.body.triggerReference !== undefined
          ? { triggerReference: request.body.triggerReference }
          : {}),
        triggeredBy: operator.operatorId,
      });
      return reply.status(202).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post(
    '/api/v1/runtime/cycles/run',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const command = await controlPlane.enqueueCommand('run_cycle', operator.operatorId, {
        triggerSource: 'api-runtime-trigger',
      });
      return reply.status(202).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post(
    '/api/v1/runtime/projections/rebuild',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const command = await controlPlane.enqueueCommand(
        'rebuild_projections',
        operator.operatorId,
      );
      return reply.status(202).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: {
      limit?: string;
      status?: 'open' | 'acknowledged' | 'recovering' | 'resolved' | 'verified' | 'reopened';
      severity?: string;
      sourceKind?: 'workflow' | 'reconciliation';
      category?: string;
    };
  }>(
    '/api/v1/runtime/mismatches',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const mismatches = await controlPlane.listMismatches(limit, {
        ...(request.query.status !== undefined ? { status: request.query.status } : {}),
        ...(request.query.severity !== undefined ? { severity: request.query.severity } : {}),
        ...(request.query.sourceKind !== undefined ? { sourceKind: request.query.sourceKind } : {}),
        ...(request.query.category !== undefined ? { category: request.query.category } : {}),
      });
      return reply.status(200).send({
        data: mismatches,
        meta: {
          correlationId: request.id,
          count: mismatches.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/runtime/mismatches/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.summarizeMismatches();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { mismatchId: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const detail = await controlPlane.getMismatchDetail(request.params.mismatchId);

      if (detail === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Mismatch '${request.params.mismatchId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: detail,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { summary?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/acknowledge',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const mismatch = await controlPlane.acknowledgeMismatch(
        request.params.mismatchId,
        operator.operatorId,
        request.body.summary ?? null,
      );

      if (mismatch === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Mismatch '${request.params.mismatchId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: mismatch,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { summary?: string; commandId?: string; linkedRecoveryEventId?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/recover',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const mismatch = await controlPlane.startMismatchRecovery({
        mismatchId: request.params.mismatchId,
        actorId: operator.operatorId,
        summary: request.body.summary ?? null,
        commandId: request.body.commandId ?? null,
        linkedRecoveryEventId: request.body.linkedRecoveryEventId ?? null,
      });

      return reply.status(200).send({
        data: mismatch,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { actionType: 'run_cycle' | 'rebuild_projections'; summary?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/remediate',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const remediation = await controlPlane.remediateMismatch({
        mismatchId: request.params.mismatchId,
        actorId: operator.operatorId,
        remediationType: request.body.actionType,
        summary: request.body.summary ?? null,
      });

      return reply.status(202).send({
        data: remediation,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { mismatchId: string };
    Querystring: { limit?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/remediation-history',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const history = await controlPlane.listMismatchRemediationHistory(request.params.mismatchId, limit);
      return reply.status(200).send({
        data: history,
        meta: {
          correlationId: request.id,
          count: history.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { mismatchId: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/remediation-latest',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const remediation = await controlPlane.getLatestMismatchRemediation(request.params.mismatchId);
      return reply.status(200).send({
        data: remediation,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { summary: string; commandId?: string; linkedRecoveryEventId?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/resolve',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const mismatch = await controlPlane.resolveMismatch({
        mismatchId: request.params.mismatchId,
        actorId: operator.operatorId,
        summary: request.body.summary,
        commandId: request.body.commandId ?? null,
        linkedRecoveryEventId: request.body.linkedRecoveryEventId ?? null,
      });

      return reply.status(200).send({
        data: mismatch,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { summary: string; outcome?: 'verified' | 'failed' };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/verify',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const mismatch = await controlPlane.verifyMismatch({
        mismatchId: request.params.mismatchId,
        actorId: operator.operatorId,
        summary: request.body.summary,
        ...(request.body.outcome !== undefined ? { outcome: request.body.outcome } : {}),
      });

      return reply.status(200).send({
        data: mismatch,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { summary: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/reopen',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const mismatch = await controlPlane.reopenMismatch(
        request.params.mismatchId,
        operator.operatorId,
        request.body.summary,
      );

      return reply.status(200).send({
        data: mismatch,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/runtime/reconciliation/runs',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const runs = await controlPlane.listReconciliationRuns(limit);
      return reply.status(200).send({
        data: runs,
        meta: {
          correlationId: request.id,
          count: runs.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { reconciliationRunId: string };
  }>(
    '/api/v1/runtime/reconciliation/runs/:reconciliationRunId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const run = await controlPlane.getReconciliationRun(request.params.reconciliationRunId);
      if (run === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Reconciliation run '${request.params.reconciliationRunId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: run,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: {
      limit?: string;
      findingType?: 'order_state_mismatch' | 'position_exposure_mismatch' | 'projection_state_mismatch' | 'stale_projection_state' | 'command_outcome_mismatch';
      severity?: 'low' | 'medium' | 'high' | 'critical';
      status?: 'active' | 'resolved';
      reconciliationRunId?: string;
    };
  }>(
    '/api/v1/runtime/reconciliation/findings',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const findings = await controlPlane.listReconciliationFindings({
        limit,
        ...(request.query.findingType !== undefined ? { findingType: request.query.findingType } : {}),
        ...(request.query.severity !== undefined ? { severity: request.query.severity } : {}),
        ...(request.query.status !== undefined ? { status: request.query.status } : {}),
        ...(request.query.reconciliationRunId !== undefined
          ? { reconciliationRunId: request.query.reconciliationRunId }
          : {}),
      });
      return reply.status(200).send({
        data: findings,
        meta: {
          correlationId: request.id,
          count: findings.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { findingId: string };
  }>(
    '/api/v1/runtime/reconciliation/findings/:findingId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const detail = await controlPlane.getReconciliationFinding(request.params.findingId);
      if (detail === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Reconciliation finding '${request.params.findingId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: detail,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get(
    '/api/v1/runtime/reconciliation/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getReconciliationSummary();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { mismatchId: string };
    Querystring: { limit?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/findings',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const findings = await controlPlane.listMismatchFindings(request.params.mismatchId, limit);
      return reply.status(200).send({
        data: findings,
        meta: {
          correlationId: request.id,
          count: findings.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/runtime/recovery-events',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const events = await controlPlane.listRecoveryEvents(limit);
      return reply.status(200).send({
        data: events,
        meta: {
          correlationId: request.id,
          count: events.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/runtime/recovery-outcomes',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const events = await controlPlane.listRecoveryOutcomes(limit);
      return reply.status(200).send({
        data: events,
        meta: {
          correlationId: request.id,
          count: events.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/runtime/worker',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const worker = await controlPlane.getWorkerStatus();
      return reply.status(200).send({
        data: worker,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: {
      limit?: string;
    };
  }>(
    '/api/v1/runtime/commands',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const commands = await controlPlane.listRuntimeCommands(limit);
      return reply.status(200).send({
        data: commands,
        meta: {
          correlationId: request.id,
          count: commands.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { commandId: string };
  }>(
    '/api/v1/runtime/commands/:commandId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const command = await controlPlane.getCommand(request.params.commandId);

      if (command === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Runtime command '${request.params.commandId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );
}
