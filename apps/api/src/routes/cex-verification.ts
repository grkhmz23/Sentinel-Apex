import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function cexVerificationRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  // Get all verification sessions for a sleeve
  app.get<{
    Querystring: { sleeveId?: string };
  }>(
    '/api/v1/cex-verification/sessions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { sleeveId } = request.query;
      try {
        const sessions = await controlPlane.listCexVerificationSessions(sleeveId);
        return reply.status(200).send({
          data: sessions,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list CEX verification sessions.';
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Get a specific verification session with trades
  app.get<{
    Params: { sessionId: string };
  }>(
    '/api/v1/cex-verification/sessions/:sessionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      try {
        const session = await controlPlane.getCexVerificationSession(sessionId);
        if (session === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `CEX verification session ${sessionId} not found.`,
              correlationId: request.id,
            },
          });
        }
        return reply.status(200).send({
          data: session,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get CEX verification session.';
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Create a new verification session and upload CSV
  app.post<{
    Body: {
      sleeveId: string;
      platform: 'binance' | 'okx' | 'bybit' | 'coinbase' | undefined;
      csvContent: string;
      fileName: string | undefined;
    };
  }>(
    '/api/v1/cex-verification/sessions',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const { sleeveId, platform, csvContent, fileName } = request.body;

      try {
        const result = await controlPlane.createCexVerificationSession({
          operatorId: operator.operatorId,
          sleeveId,
          platform,
          csvContent,
          fileName: fileName ?? 'upload.csv',
        });

        return reply.status(201).send({
          data: result,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'CEX verification session creation failed.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Validate CSV format without creating a session
  app.post<{
    Body: {
      csvContent: string;
      platform: 'binance' | 'okx' | 'bybit' | 'coinbase' | undefined;
    };
  }>(
    '/api/v1/cex-verification/validate-csv',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { csvContent, platform } = request.body;

      try {
        const result = await controlPlane.validateCexCsv({
          csvContent,
          platform,
        });

        return reply.status(200).send({
          data: result,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'CSV validation failed.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Calculate PnL for a session
  app.post<{
    Params: { sessionId: string };
    Body: {
      method?: 'fifo' | 'lifo' | 'avg';
      includeFees?: boolean;
    };
  }>(
    '/api/v1/cex-verification/sessions/:sessionId/calculate-pnl',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const { sessionId } = request.params;
      const { method = 'fifo', includeFees = true } = request.body;

      try {
        const result = await controlPlane.calculateCexPnl(sessionId, {
          method,
          includeFees,
        });

        return reply.status(200).send({
          data: result,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PnL calculation failed.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Generate hackathon submission report for a session
  app.get<{
    Params: { sessionId: string };
    Querystring: {
      method?: 'fifo' | 'lifo' | 'avg';
      includeFees?: string;
    };
  }>(
    '/api/v1/cex-verification/sessions/:sessionId/submission-report',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { method = 'fifo', includeFees = 'true' } = request.query;

      try {
        const result = await controlPlane.generateCexSubmissionReport(sessionId, {
          method,
          includeFees: includeFees === 'true',
        });

        return reply.status(200).send({
          data: result,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Submission report generation failed.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Update session status (validate/reject)
  app.patch<{
    Params: { sessionId: string };
    Body: {
      status: 'validated' | 'rejected';
      notes?: string;
    };
  }>(
    '/api/v1/cex-verification/sessions/:sessionId',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const { sessionId } = request.params;
      const { status, notes } = request.body;

      try {
        const result = await controlPlane.updateCexVerificationStatus(sessionId, {
          operatorId: operator.operatorId,
          status,
          notes: notes ?? undefined,
        });

        return reply.status(200).send({
          data: result,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Status update failed.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  // Delete a session
  app.delete<{
    Params: { sessionId: string };
  }>(
    '/api/v1/cex-verification/sessions/:sessionId',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        await controlPlane.deleteCexVerificationSession(sessionId);
        return reply.status(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete session.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );
}
