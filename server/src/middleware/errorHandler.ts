/**
 * Centralized Express error handler.
 *
 * - Logs every error through the application logger.
 * - Returns a consistent ApiError shape to the client.
 * - Handles Zod validation errors with a friendly 422 response.
 * - Strips stack traces in production.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ApiError } from '@zfs-manager/shared';
import { config } from '../config/index.js';

/**
 * Application-level error with an HTTP status code and machine-readable code.
 * Throw this from route handlers / services for predictable error responses.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Format a ZodError into a human-readable + machine-readable structure.
 */
function formatZodError(err: ZodError): { message: string; details: unknown } {
  const issues = err.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return {
    message: `Validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
    details: issues,
  };
}

/**
 * Express error-handling middleware (4-argument signature).
 *
 * Mount as the LAST middleware in the stack:
 *   app.use(errorHandler);
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // --- Zod validation errors ---------------------------------------------------
  if (err instanceof ZodError) {
    const { message, details } = formatZodError(err);
    console.log(`[error] VALIDATION ${_req.method} ${_req.originalUrl} - ${message}`);
    const body: ApiError = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message, details },
    };
    res.status(422).json(body);
    return;
  }

  // --- Known application errors ------------------------------------------------
  if (err instanceof AppError) {
    console.log(`[error] APP ${_req.method} ${_req.originalUrl} - ${err.statusCode} ${err.code}: ${err.message}`);
    const body: ApiError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  // --- Unexpected errors -------------------------------------------------------
  console.error(`[error] UNEXPECTED ${_req.method} ${_req.originalUrl}`, err);

  const body: ApiError = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.nodeEnv === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      details: config.nodeEnv === 'production' ? undefined : err.stack,
    },
  };
  res.status(500).json(body);
}
