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
    Querystring: {
      status?: 'open' | 'acknowledged' | 'in_review' | 'resolved';
      ownerId?: string;
      openState?: 'open' | 'closed';
      queueState?: 'overdue' | 'due_soon' | 'unassigned';
      sortBy?: 'due_at' | 'latest_activity' | 'created_at' | 'updated_at';
      sortDirection?: 'asc' | 'desc';
      limit?: string;
    };
  }>(
    '/api/v1/allocator/escalations',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 200);
      const filters: Parameters<typeof controlPlane.listRebalanceEscalations>[0] = { limit };
      if (request.query.status !== undefined) {
        filters.status = request.query.status;
      }
      if (request.query.ownerId !== undefined) {
        filters.ownerId = request.query.ownerId;
      }
      if (request.query.openState !== undefined) {
        filters.openState = request.query.openState;
      }
      if (request.query.queueState !== undefined) {
        filters.queueState = request.query.queueState;
      }
      if (request.query.sortBy !== undefined) {
        filters.sortBy = request.query.sortBy;
      }
      if (request.query.sortDirection !== undefined) {
        filters.sortDirection = request.query.sortDirection;
      }

      const items = await controlPlane.listRebalanceEscalations(filters);
      return reply.status(200).send({
        data: items,
        meta: {
          correlationId: request.id,
          count: items.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/allocator/escalations/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getRebalanceEscalationSummary(request.operator?.operatorId ?? null);
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get(
    '/api/v1/allocator/escalations/mine',
    {
      preHandler: [authenticate, requireOperatorRole('viewer')],
    },
    async (request, reply) => {
      const operatorId = request.operator?.operatorId;
      if (operatorId === undefined) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Operator session is required for the mine query.',
            correlationId: request.id,
          },
        });
      }

      const items = await controlPlane.listRebalanceEscalations({
        ownerId: operatorId,
        openState: 'open',
        sortBy: 'due_at',
        sortDirection: 'asc',
        limit: 100,
      });
      return reply.status(200).send({
        data: items,
        meta: {
          correlationId: request.id,
          count: items.length,
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
    '/api/v1/allocator/rebalance-bundles/:bundleId/resolution-actions',
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

      const actions = await controlPlane.listRebalanceBundleResolutionActions(request.params.bundleId);
      return reply.status(200).send({
        data: actions,
        meta: {
          correlationId: request.id,
          count: actions.length,
        },
      });
    },
  );

  app.get<{
    Params: { bundleId: string; resolutionActionId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/resolution-actions/:resolutionActionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const action = await controlPlane.getRebalanceBundleResolutionAction(
        request.params.bundleId,
        request.params.resolutionActionId,
      );
      if (action === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Resolution action '${request.params.resolutionActionId}' was not found for bundle '${request.params.bundleId}'.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: action,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/resolution-options',
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

      const options = await controlPlane.listRebalanceBundleResolutionOptions(request.params.bundleId);
      return reply.status(200).send({
        data: options,
        meta: {
          correlationId: request.id,
          count: options.length,
        },
      });
    },
  );

  app.post<{
    Params: { bundleId: string };
    Body: {
      resolutionActionType:
        | 'accept_partial_application'
        | 'mark_bundle_manually_resolved'
        | 'escalate_bundle_for_review';
      note: string;
    };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/resolution-actions',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const action = await controlPlane.requestRebalanceBundleResolutionAction(
          request.params.bundleId,
          {
            resolutionActionType: request.body.resolutionActionType,
            note: request.body.note,
          },
          operator.operatorId,
          operator.role,
        );
        if (action === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(action.status === 'completed' ? 200 : 409).send({
          data: action,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bundle manual resolution failed.';
        const statusCode = message.includes('requires')
          ? 403
          : message.includes('not found')
            ? 404
            : 409;
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/escalation',
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
        data: {
          escalation: bundle.escalation,
          transitions: bundle.escalationTransitions,
        },
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/escalation/history',
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

      const history = await controlPlane.listRebalanceBundleEscalationHistory(request.params.bundleId);
      return reply.status(200).send({
        data: history,
        meta: {
          correlationId: request.id,
          count: history.length,
        },
      });
    },
  );

  app.post<{
    Params: { bundleId: string };
    Body: {
      ownerId: string;
      note: string;
      dueAt?: string | null;
    };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/escalation/assign',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const escalation = await controlPlane.assignRebalanceBundleEscalation(
          request.params.bundleId,
          request.body,
          operator.operatorId,
          operator.role,
        );
        if (escalation === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
              correlationId: request.id,
            },
          });
        }
        return reply.status(200).send({
          data: escalation,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bundle escalation assignment failed.';
        return reply.status(message.includes('requires') ? 403 : message.includes('not found') ? 404 : 409).send({
          error: {
            code: message.includes('requires') ? 'FORBIDDEN' : message.includes('not found') ? 'NOT_FOUND' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { bundleId: string };
    Body: {
      note?: string | null;
    };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/escalation/acknowledge',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const escalation = await controlPlane.acknowledgeRebalanceBundleEscalation(
          request.params.bundleId,
          request.body,
          operator.operatorId,
          operator.role,
        );
        if (escalation === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
              correlationId: request.id,
            },
          });
        }
        return reply.status(200).send({
          data: escalation,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bundle escalation acknowledgement failed.';
        return reply.status(message.includes('requires') ? 403 : message.includes('not found') ? 404 : 409).send({
          error: {
            code: message.includes('requires') ? 'FORBIDDEN' : message.includes('not found') ? 'NOT_FOUND' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { bundleId: string };
    Body: {
      note?: string | null;
    };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/escalation/start-review',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const escalation = await controlPlane.startRebalanceBundleEscalationReview(
          request.params.bundleId,
          request.body,
          operator.operatorId,
          operator.role,
        );
        if (escalation === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
              correlationId: request.id,
            },
          });
        }
        return reply.status(200).send({
          data: escalation,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bundle escalation review transition failed.';
        return reply.status(message.includes('requires') ? 403 : message.includes('not found') ? 404 : 409).send({
          error: {
            code: message.includes('requires') ? 'FORBIDDEN' : message.includes('not found') ? 'NOT_FOUND' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { bundleId: string };
    Body: {
      note: string;
    };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/escalation/close',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const escalation = await controlPlane.closeRebalanceBundleEscalation(
          request.params.bundleId,
          request.body,
          operator.operatorId,
          operator.role,
        );
        if (escalation === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
              correlationId: request.id,
            },
          });
        }
        return reply.status(200).send({
          data: escalation,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bundle escalation close failed.';
        return reply.status(message.includes('requires') ? 403 : message.includes('not found') ? 404 : 409).send({
          error: {
            code: message.includes('requires') ? 'FORBIDDEN' : message.includes('not found') ? 'NOT_FOUND' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/recovery-actions',
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

      const actions = await controlPlane.listRebalanceBundleRecoveryActions(request.params.bundleId);
      return reply.status(200).send({
        data: actions,
        meta: {
          correlationId: request.id,
          count: actions.length,
        },
      });
    },
  );

  app.get<{
    Params: { bundleId: string; recoveryActionId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/recovery-actions/:recoveryActionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const action = await controlPlane.getRebalanceBundleRecoveryAction(
        request.params.bundleId,
        request.params.recoveryActionId,
      );
      if (action === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Recovery action '${request.params.recoveryActionId}' was not found for bundle '${request.params.bundleId}'.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: action,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { bundleId: string };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/recovery-candidates',
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

      const candidates = await controlPlane.listRebalanceBundleRecoveryCandidates(request.params.bundleId);
      return reply.status(200).send({
        data: candidates,
        meta: {
          correlationId: request.id,
          count: candidates.length,
        },
      });
    },
  );

  app.post<{
    Params: { bundleId: string };
    Body: {
      recoveryActionType: 'requeue_child_execution';
      targetChildType: 'carry_action' | 'treasury_action' | 'rebalance_proposal';
      targetChildId: string;
      note?: string;
    };
  }>(
    '/api/v1/allocator/rebalance-bundles/:bundleId/recovery-actions',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const action = await controlPlane.requestRebalanceBundleRecoveryAction(
          request.params.bundleId,
          {
            recoveryActionType: request.body.recoveryActionType,
            targetChildType: request.body.targetChildType,
            targetChildId: request.body.targetChildId,
            ...(request.body.note !== undefined ? { note: request.body.note } : {}),
          },
          operator.operatorId,
          operator.role,
        );
        if (action === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Rebalance bundle '${request.params.bundleId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(action.status === 'queued' ? 202 : 200).send({
          data: action,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bundle recovery request failed.';
        const statusCode = message.includes('requires')
          ? 403
          : message.includes('not found')
            ? 404
            : 409;
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
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
