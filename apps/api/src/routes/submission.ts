import type {
  GeneratePerformanceReportInput,
  RecordMultiLegEvidenceInput,
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

  // ============================================================================
  // Phase R3 Part 5 - Completeness and Performance Reports
  // ============================================================================

  app.get(
    '/api/v1/submission/completeness',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const completeness = await controlPlane.getSubmissionCompleteness();
      return reply.status(200).send({
        data: completeness,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: GeneratePerformanceReportInput;
  }>(
    '/api/v1/submission/report',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const report = await controlPlane.generatePerformanceReport(operator.operatorId, request.body);
        return reply.status(201).send({
          data: report,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Performance report generation failed.';
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
    '/api/v1/submission/reports',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt((request.query as { limit?: string }).limit ?? '50', 10), 200);
      const reports = await controlPlane.listPerformanceReports(limit);
      return reply.status(200).send({
        data: reports,
        meta: { correlationId: request.id, count: reports.length, limit },
      });
    },
  );

  app.get<{
    Params: { reportId: string };
  }>(
    '/api/v1/submission/report/:reportId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const report = await controlPlane.getPerformanceReport(request.params.reportId);
      if (report === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Performance report "${request.params.reportId}" not found.`,
            correlationId: request.id,
          },
        });
      }
      return reply.status(200).send({
        data: report,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: RecordMultiLegEvidenceInput;
  }>(
    '/api/v1/submission/multi-leg-evidence',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const evidence = await controlPlane.recordMultiLegEvidence(operator.operatorId, request.body);
        return reply.status(201).send({
          data: evidence,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Multi-leg evidence recording failed.';
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
