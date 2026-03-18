import type { FastifyInstance } from 'fastify';

// Read the package version at startup so we don't hit the filesystem on every request.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const APP_VERSION: string = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
})();

/**
 * GET /health — unauthenticated liveness / readiness probe.
 *
 * Returns:
 *   200 { status: 'ok' | 'degraded', version, timestamp, mode }
 *
 * 'degraded' is reserved for future use (e.g. DB connectivity check).
 * Currently always returns 'ok'.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded'] },
              version: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              mode: { type: 'string' },
            },
            required: ['status', 'version', 'timestamp', 'mode'],
          },
        },
      },
    },
    async (_request, reply) => {
      const mode = process.env['EXECUTION_MODE'] ?? 'dry-run';
      return reply.status(200).send({
        status: 'ok',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        mode,
      });
    },
  );
}
