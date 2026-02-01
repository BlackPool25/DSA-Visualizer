/**
 * @file run.ts
 * @description API route handler for POST /api/run.
 * Executes a previously compiled binary with optional input and returns
 * the output, exit code, and execution details.
 *
 * Request body: { binaryId: string, stdin?: string }
 * Response: { success: true, stdout: string, stderr: string, exitCode: number, duration: number, timedOut: boolean }
 *          or { success: false, error: string }
 */

import { Router, type Request, type Response } from 'express';
import { runBinary, type RunResult } from '../services/executor.js';
import { validate, schemas, type RunRequest } from '../middleware/validation.js';
import { compileRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/run
 *
 * Executes a compiled binary in a secure Docker container.
 *
 * Request body:
 * - binaryId (string, required): UUID of the compiled binary
 * - stdin (string, optional): Input to provide via stdin (max 1MB)
 *
 * Success response (200):
 * - success: true
 * - stdout: Program standard output
 * - stderr: Program standard error
 * - exitCode: Process exit code (0 = success)
 * - duration: Execution time in milliseconds
 * - timedOut: Whether execution was terminated due to timeout
 *
 * Error response (400/404/500):
 * - success: false
 * - error: Error message explaining what went wrong
 */
router.post(
  '/',
  compileRateLimiter,
  validate(schemas.run),
  asyncHandler(async (req: Request, res: Response) => {
    const { binaryId, stdin } = req.body as RunRequest;

    logger.info('Run request received', {
      binaryId,
      hasInput: !!stdin,
      inputLength: stdin?.length || 0,
    });

    // Run the binary
    const result: RunResult = await runBinary(binaryId, {
      stdin,
    });

    // Log the result
    logger.info('Execution completed', {
      binaryId,
      success: result.success,
      exitCode: result.exitCode,
      duration: result.duration,
      timedOut: result.timedOut,
    });

    // Build response
    if (result.success) {
      res.status(200).json({
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        timedOut: result.timedOut,
      });
    } else {
      // Execution failed (but request was valid)
      res.status(200).json({
        success: false,
        error: result.stderr || 'Execution failed',
        exitCode: result.exitCode,
        duration: result.duration,
        timedOut: result.timedOut,
      });
    }
  })
);

export default router;
