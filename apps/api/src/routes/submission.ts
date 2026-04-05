import type {
  RecordSubmissionEvidenceInput,
  RuntimeControlPlane,
  UpsertSubmissionDossierInput,
} from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function submissionRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/submission',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const dossier = await controlPlane.getSubmissionDossier();
      return reply.status(200).send({
        data: dossier,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: UpsertSubmissionDossierInput;
  }>(
    '/api/v1/submission',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const dossier = await controlPlane.upsertSubmissionDossier(operator.operatorId, request.body);
        return reply.status(200).send({
          data: dossier,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Submission dossier update failed.';
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

  app.get(
    '/api/v1/submission/evidence',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const evidence = await controlPlane.listSubmissionEvidence();
      return reply.status(200).send({
        data: evidence,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: RecordSubmissionEvidenceInput;
  }>(
    '/api/v1/submission/evidence',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const evidence = await controlPlane.recordSubmissionEvidence(operator.operatorId, request.body);
        return reply.status(200).send({
          data: evidence,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Submission evidence update failed.';
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

  app.get(
    '/api/v1/submission/export',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const bundle = await controlPlane.getSubmissionExportBundle();
      return reply.status(200).send({
        data: bundle,
        meta: { correlationId: request.id },
      });
    },
  );
}
