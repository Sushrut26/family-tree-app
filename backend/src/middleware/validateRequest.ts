import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Generic validation middleware for Zod schemas
 * Validates request body, params, and query against provided schema
 */
export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate and transform the request
      const validated = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      }) as any;

      // Replace request data with validated/sanitized data
      req.body = validated.body || req.body;
      req.params = validated.params || req.params;
      req.query = validated.query || req.query;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors for user-friendly response
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      // Unexpected error
      console.error('Validation middleware error:', error);
      res.status(500).json({ error: 'Internal server error during validation' });
    }
  };
