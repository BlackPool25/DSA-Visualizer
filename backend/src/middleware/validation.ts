/**
 * @file validation.ts
 * @description Request validation middleware using Zod schemas.
 * Provides a factory function to create validation middleware for any Zod schema,
 * ensuring type safety and consistent error handling across all routes.
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a validation middleware for a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @param source - Which request property to validate ('body', 'query', 'params')
 * @returns Express middleware that validates requests
 *
 * @example
 * const bodySchema = z.object({ code: z.string().min(1) });
 * router.post('/compile', validate(bodySchema), compileHandler);
 */
export function validate<T extends z.ZodType>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Validate the request data against the schema
      const validated = schema.parse(req[source]);

      // Replace the original data with validated/parsed data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a readable message
        const messages = error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        logger.debug('Validation failed', {
          source,
          errors: messages,
          path: req.path,
        });

        next(new AppError(`Validation failed: ${messages.join(', ')}`, 400));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Request body schemas for API endpoints.
 */
export const schemas = {
  /**
   * Schema for POST /api/compile
   * Validates C++ code submission.
   */
  compile: z.object({
    code: z.string()
      .min(1, 'Code cannot be empty')
      .max(50 * 1024, 'Code exceeds maximum size of 50KB'),
    compiler: z.enum(['g++', 'clang++']).optional().default('g++'),
    flags: z.array(z.string()).optional(),
  }),

  /**
   * Schema for POST /api/run
   * Validates binary execution request.
   */
  run: z.object({
    binaryId: z.string()
      .uuid('Invalid binary ID format'),
    stdin: z.string()
      .max(1024 * 1024, 'Input exceeds maximum size of 1MB')
      .optional()
      .default(''),
  }),

  /**
   * Schema for POST /api/trace
   * Validates trace generation request.
   */
  trace: z.object({
    code: z.string()
      .min(1, 'Code cannot be empty')
      .max(50 * 1024, 'Code exceeds maximum size of 50KB'),
    stdin: z.string()
      .max(1024 * 1024, 'Input exceeds maximum size of 1MB')
      .optional()
      .default(''),
    maxSteps: z.number()
      .int('maxSteps must be an integer')
      .min(1, 'maxSteps must be at least 1')
      .max(5000, 'maxSteps cannot exceed 5000')
      .optional()
      .default(1000),
  }),
} as const;

/** Type inference helpers */
export type CompileRequest = z.infer<typeof schemas.compile>;
export type RunRequest = z.infer<typeof schemas.run>;
export type TraceRequest = z.infer<typeof schemas.trace>;
