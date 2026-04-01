import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

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
