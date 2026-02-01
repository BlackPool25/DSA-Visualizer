/**
 * @file trace.ts
 * @description API route handler for POST /api/trace.
 * Generates a step-by-step execution trace of C++ code using GDB.
 * This involves compiling the code, running it under GDB with a trace
 * collector script, and returning the structured trace data.
 *
 * Request body: { code: string, stdin?: string, maxSteps?: number }
 * Response: { success: true, trace: FullTrace, duration: number }
 *          or { success: false, error: string, compileErrors?: CompileError[] }
 */

import { Router, type Router as RouterType, type Request, type Response } from 'express';
import { traceExecution, type TraceResult } from '../services/tracer.js';
import { validate, schemas, type TraceRequest } from '../middleware/validation.js';
import { traceRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router: RouterType = Router();

/**
 * POST /api/trace
 *
 * Generates an execution trace for C++ code using GDB.
 * This is an expensive operation involving compilation and GDB debugging.
 *
 * Request body:
 * - code (string, required): C++ source code to trace (max 50KB)
 * - stdin (string, optional): Input to provide to the program (max 1MB)
 * - maxSteps (number, optional): Maximum trace steps to capture (1-5000, default: 1000)
 *
 * Success response (200):
 * - success: true
 * - trace: {
 *     steps: Array of { line, variables, callStack?, memory? },
 *     totalSteps: Total number of steps captured,
 *     executionTime: Total execution time in milliseconds
 *   }
 * - duration: Total time for trace generation
 *
 * Error response (200 with success: false, or 400/500):
 * - success: false
 * - error: Error message
 * - compileErrors: Array of compilation errors (if compilation failed)
 */
router.post(
  '/',
  traceRateLimiter,
  validate(schemas.trace),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, stdin, maxSteps } = req.body as TraceRequest;

    logger.info('Trace request received', {
      codeLength: code.length,
      hasInput: !!stdin,
      maxSteps,
    });

    // Generate trace
    const result: TraceResult = await traceExecution(code, {
      stdin,
      maxSteps,
    });

    // Log the result
    if (result.success) {
      logger.info('Trace generation successful', {
        totalSteps: result.trace?.totalSteps,
        duration: result.duration,
      });
    } else {
      logger.info('Trace generation failed', {
        error: result.error,
        hasCompileErrors: !!result.compileErrors,
        duration: result.duration,
      });
    }

    // Build response
    if (result.success && result.trace) {
      res.status(200).json({
        success: true,
        trace: result.trace,
        duration: result.duration,
      });
    } else {
      res.status(200).json({
        success: false,
        error: result.error || 'Trace generation failed',
        ...(result.compileErrors && { compileErrors: result.compileErrors }),
        duration: result.duration,
      });
    }
  })
);

export default router;
