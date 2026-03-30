import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function allocatorRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/allocator/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getAllocatorSummary();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/allocator/targets',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '20', 10), 200);
      const targets = await controlPlane.listAllocatorTargets(limit);
      return reply.status(200).send({
        data: targets,
        meta: {
          correlationId: request.id,
          count: targets.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/allocator/decisions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '20', 10), 200);
      const decisions = await controlPlane.listAllocatorRuns(limit);
      return reply.status(200).send({
        data: decisions,
        meta: {
          correlationId: request.id,
          count: decisions.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/allocator/runs',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '20', 10), 200);
      const runs = await controlPlane.listAllocatorRuns(limit);
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
    Params: { allocatorRunId: string };
  }>(
    '/api/v1/allocator/decisions/:allocatorRunId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const decision = await controlPlane.getAllocatorDecision(request.params.allocatorRunId);
      if (decision === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Allocator decision '${request.params.allocatorRunId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: decision,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/allocator/rebalance-bundles',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '20', 10), 200);
      const bundles = await controlPlane.listRebalanceBundles(limit);
      return reply.status(200).send({
        data: bundles,
        meta: {
          correlationId: request.id,
          count: bundles.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const bundle = await controlPlane.getRebalanceBundle(request.params.bundleId);
      if (bundle === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: bundle,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { proposalId: string };
  }>(
    '/api/v1/allocator/rebalance-proposals/:proposalId/bundle',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const bundle = await controlPlane.getRebalanceBundleForProposal(request.params.proposalId);
      if (bundle === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Rebalance bundle for proposal '${request.params.proposalId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: bundle,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/timeline',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const bundle = await controlPlane.getRebalanceBundle(request.params.bundleId);
      if (bundle === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: bundle.graph.timeline,
        meta: {
          correlationId: request.id,
          count: bundle.graph.timeline.length,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/allocator/rebalance-proposals',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '20', 10), 200);
      const proposals = await controlPlane.listRebalanceProposals(limit);
      return reply.status(200).send({
        data: proposals,
        meta: {
          correlationId: request.id,
          count: proposals.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { allocatorRunId: string };
  }>(
    '/api/v1/allocator/decisions/:allocatorRunId/rebalance-proposals',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const proposals = await controlPlane.listRebalanceProposalsForDecision(request.params.allocatorRunId);
      return reply.status(200).send({
        data: proposals,
        meta: {
          correlationId: request.id,
          count: proposals.length,
        },
      });
    },
  );

  app.get<{
    Params: { proposalId: string };
  }>(
    '/api/v1/allocator/rebalance-proposals/:proposalId/execution-graph',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const graph = await controlPlane.getRebalanceExecutionGraph(request.params.proposalId);
      if (graph === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Rebalance proposal '${request.params.proposalId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: graph,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { proposalId: string };
  }>(
    '/api/v1/allocator/rebalance-proposals/:proposalId/timeline',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const proposal = await controlPlane.getRebalanceProposal(request.params.proposalId);
      if (proposal === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Rebalance proposal '${request.params.proposalId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      const timeline = await controlPlane.getRebalanceTimeline(request.params.proposalId);
      return reply.status(200).send({
        data: timeline,
        meta: {
          correlationId: request.id,
          count: timeline.length,
        },
      });
    },
  );

  app.get<{
    Params: { proposalId: string };
  }>(
    '/api/v1/allocator/rebalance-proposals/:proposalId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const proposal = await controlPlane.getRebalanceProposal(request.params.proposalId);
      if (proposal === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Rebalance proposal '${request.params.proposalId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: proposal,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post(
    '/api/v1/allocator/evaluate',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const command = await controlPlane.enqueueAllocatorEvaluation(operator.operatorId, {
        actorId: operator.operatorId,
        trigger: 'api_manual_allocator_evaluation',
      });
      return reply.status(202).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { proposalId: string };
  }>(
    '/api/v1/allocator/rebalance-proposals/:proposalId/approve',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const command = await controlPlane.approveRebalanceProposal(
          request.params.proposalId,
          operator.operatorId,
          operator.role,
        );
        if (command === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance proposal '${request.params.proposalId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(202).send({
          data: command,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rebalance approval failed.';
        const statusCode = message.includes('requires') ? 403 : 409;
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { proposalId: string };
    Body: { reason?: string };
  }>(
    '/api/v1/allocator/rebalance-proposals/:proposalId/reject',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const proposal = await controlPlane.rejectRebalanceProposal(
          request.params.proposalId,
          operator.operatorId,
          operator.role,
          request.body.reason ?? 'Rejected by operator.',
        );
        if (proposal === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance proposal '${request.params.proposalId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(200).send({
          data: proposal,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rebalance rejection failed.';
        const statusCode = message.includes('requires') ? 403 : 409;
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );
}
