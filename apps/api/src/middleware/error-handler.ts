import { createLogger } from '@sentinel-apex/observability';

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

const logger = createLogger('api:error-handler');

// ---------------------------------------------------------------------------
// Known error codes and their HTTP status mappings
// ---------------------------------------------------------------------------

interface StructuredError {
  code: string;
  message: string;
  correlationId: string;
}

function mapStatusCode(err: FastifyError): number {
  // Fastify validation errors
  if (err.validation !== undefined) return 400;

  const statusCode = err.statusCode ?? 500;

  // Pass through HTTP errors that Fastify or route handlers set explicitly
  if (statusCode >= 100 && statusCode < 600) return statusCode;

  return 500;
}

function mapErrorCode(statusCode: number, err: FastifyError): string {
  if (err.validation !== undefined) return 'VALIDATION_ERROR';

  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'TOO_MANY_REQUESTS';
    default:  return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Fastify error handler.
 *
 * - Logs the error with correlation ID (request.id).
 * - Returns a structured JSON envelope: { error: { code, message, correlationId } }
 * - Never exposes stack traces in production.
 * - Maps known error types to appropriate HTTP status codes.
 */
export function errorHandler(
  err: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = mapStatusCode(err);
  const code = mapErrorCode(statusCode, err);
  const correlationId = request.id;

  const isProduction = process.env['NODE_ENV'] === 'production';

  // Log with appropriate severity
  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      correlationId,
      statusCode,
      errorCode: code,
      errorMessage: err.message,
      // Include stack only in non-production logs
      ...(isProduction ? {} : { stack: err.stack }),
    });
  } else {
    logger.warn('Request error', {
      correlationId,
      statusCode,
      errorCode: code,
      errorMessage: err.message,
    });
  }

  // Build safe client-facing message
  let clientMessage: string;
  if (statusCode >= 500 && isProduction) {
    clientMessage = 'An unexpected error occurred. Please try again later.';
  } else if (err.validation !== undefined) {
    // Fastify provides human-readable validation summaries
    clientMessage = `Validation error: ${err.message}`;
  } else {
    clientMessage = err.message;
  }

  const body: { error: StructuredError } = {
    error: {
      code,
      message: clientMessage,
      correlationId,
    },
  };

  void reply.status(statusCode).send(body);
}
