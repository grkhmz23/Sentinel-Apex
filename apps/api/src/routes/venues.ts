import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

function mutationErrorStatus(message: string): number {
  if (message.includes('requires') || message.includes('access')) {
    return 403;
  }
  if (message.includes('not found')) {
    return 404;
  }
  if (message.includes('required')) {
    return 400;
  }

  return 409;
}

export async function venueRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/venues',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 200);
      const venues = await controlPlane.listVenues(limit);
      return reply.status(200).send({
        data: venues,
        meta: {
          correlationId: request.id,
          count: venues.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/venues/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getVenueSummary();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get(
    '/api/v1/venues/promotion-summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getConnectorPromotionOverview();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get(
    '/api/v1/venues/truth-summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getVenueTruthSummary();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/venues/readiness',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 200);
      const venues = await controlPlane.listVenueReadiness(limit);
      return reply.status(200).send({
        data: venues,
        meta: {
          correlationId: request.id,
          count: venues.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId/promotion',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const promotion = await controlPlane.getConnectorPromotion(request.params.venueId);
      if (promotion === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Connector promotion state for venue '${request.params.venueId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: promotion,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId/promotion/history',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const history = await controlPlane.listConnectorPromotionHistory(request.params.venueId);
      return reply.status(200).send({
        data: history,
        meta: {
          correlationId: request.id,
          count: history.length,
        },
      });
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId/promotion/eligibility',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const eligibility = await controlPlane.getConnectorPromotionEligibility(request.params.venueId);
      if (eligibility === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Connector promotion eligibility for venue '${request.params.venueId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: eligibility,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { venueId: string };
    Body: { note?: string };
  }>(
    '/api/v1/venues/:venueId/promotion/request',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);

      try {
        const promotion = await controlPlane.requestConnectorPromotion(
          request.params.venueId,
          operator.operatorId,
          operator.role,
          request.body.note,
        );
        if (promotion === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Venue '${request.params.venueId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(202).send({
          data: promotion,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connector promotion request failed.';
        const statusCode = mutationErrorStatus(message);
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'BAD_REQUEST' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { venueId: string };
    Body: { note?: string };
  }>(
    '/api/v1/venues/:venueId/promotion/approve',
    {
      preHandler: [authenticate, requireOperatorRole('admin')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);

      try {
        const promotion = await controlPlane.approveConnectorPromotion(
          request.params.venueId,
          operator.operatorId,
          operator.role,
          request.body.note,
        );
        if (promotion === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Venue '${request.params.venueId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(200).send({
          data: promotion,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connector promotion approval failed.';
        const statusCode = mutationErrorStatus(message);
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'BAD_REQUEST' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { venueId: string };
    Body: { note?: string };
  }>(
    '/api/v1/venues/:venueId/promotion/reject',
    {
      preHandler: [authenticate, requireOperatorRole('admin')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const note = request.body.note?.trim();
      if (note === undefined || note.length === 0) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'A rejection note is required.',
            correlationId: request.id,
          },
        });
      }

      try {
        const promotion = await controlPlane.rejectConnectorPromotion(
          request.params.venueId,
          operator.operatorId,
          operator.role,
          note,
        );
        if (promotion === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Venue '${request.params.venueId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(200).send({
          data: promotion,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connector promotion rejection failed.';
        const statusCode = mutationErrorStatus(message);
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'BAD_REQUEST' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { venueId: string };
    Body: { note?: string };
  }>(
    '/api/v1/venues/:venueId/promotion/suspend',
    {
      preHandler: [authenticate, requireOperatorRole('admin')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const note = request.body.note?.trim();
      if (note === undefined || note.length === 0) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'A suspension note is required.',
            correlationId: request.id,
          },
        });
      }

      try {
        const promotion = await controlPlane.suspendConnectorPromotion(
          request.params.venueId,
          operator.operatorId,
          operator.role,
          note,
        );
        if (promotion === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Venue '${request.params.venueId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(200).send({
          data: promotion,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connector promotion suspension failed.';
        const statusCode = mutationErrorStatus(message);
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'BAD_REQUEST' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const venue = await controlPlane.getVenue(request.params.venueId);
      if (venue === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Venue '${request.params.venueId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: venue,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId/internal-state',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const state = await controlPlane.getVenueInternalState(request.params.venueId);
      if (state === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Internal derivative state for venue '${request.params.venueId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: state,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId/comparison-summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getVenueComparisonSummary(request.params.venueId);
      if (summary === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Comparison summary for venue '${request.params.venueId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { venueId: string };
  }>(
    '/api/v1/venues/:venueId/comparison-detail',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const detail = await controlPlane.getVenueComparisonDetail(request.params.venueId);
      if (detail === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Comparison detail for venue '${request.params.venueId}' was not found.`,
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

  app.get<{
    Params: { venueId: string };
    Querystring: { limit?: string };
  }>(
    '/api/v1/venues/:venueId/snapshots',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '20', 10), 100);
      const snapshots = await controlPlane.listVenueSnapshots(request.params.venueId, limit);
      return reply.status(200).send({
        data: snapshots,
        meta: {
          correlationId: request.id,
          count: snapshots.length,
          limit,
        },
      });
    },
  );
}
