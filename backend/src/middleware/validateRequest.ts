import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Generic validation middleware for Zod schemas
 * Validates request body, params, and query against provided schema
 * Uses safeParseAsync for Zod v4 compatibility
 */
export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await schema.safeParseAsync({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      // Format Zod errors for user-friendly response
      const errors = result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Replace request body with validated/sanitized data
    // Note: req.params and req.query are read-only in Express 5.x
    const validated = result.data as { body?: unknown; params?: unknown; query?: unknown };
    if (validated.body) {
      req.body = validated.body;
    }

    next();
  };
