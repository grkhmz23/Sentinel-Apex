import type { ZodError } from 'zod';

// =============================================================================
// ConfigValidationError
// =============================================================================
// Thrown when environment variable parsing fails. Carries the full ZodError
// so callers can inspect individual field failures.
// =============================================================================

export class ConfigValidationError extends Error {
  public readonly zodError: ZodError;

  constructor(zodError: ZodError) {
    const issues = zodError.issues
      .map((issue) => `  • ${issue.path.join('.')} — ${issue.message}`)
      .join('\n');

    super(
      `Environment configuration validation failed:\n${issues}\n\n` +
        `Ensure all required environment variables are set correctly before starting the application.`,
    );

    this.name = 'ConfigValidationError';
    this.zodError = zodError;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
