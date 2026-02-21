/**
 * Zod-based request validation middleware factories.
 *
 * Usage:
 *   import { z } from 'zod';
 *   import { validate, validateQuery } from '../middleware/validate.js';
 *
 *   const CreatePoolSchema = z.object({ name: z.string().min(1), ... });
 *
 *   router.post('/', validate(CreatePoolSchema), handler);
 *   router.get('/', validateQuery(ListQuerySchema), handler);
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Validate `req.body` against the provided Zod schema.
 *
 * On success the parsed (and potentially transformed) data replaces req.body.
 * On failure the ZodError is forwarded to the error handler via `next(err)`.
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(result.error);
      return;
    }

    // Replace body with the parsed (cleaned) output
    req.body = result.data;
    next();
  };
}

/**
 * Validate `req.query` against the provided Zod schema.
 *
 * Useful for list endpoints with pagination / filter parameters.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(result.error);
      return;
    }

    // Attach parsed query as a typed property for downstream handlers.
    // We avoid overwriting req.query because Express types it as
    // ParsedQs which would lose our Zod-inferred type.
    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}

/**
 * Validate `req.params` against the provided Zod schema.
 *
 * Useful when route params need more than simple string validation
 * (e.g. UUID format, enum constraints).
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(result.error);
      return;
    }

    (req as Request & { validatedParams: T }).validatedParams = result.data;
    next();
  };
}
