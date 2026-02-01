/**
 * @file compile.ts
 * @description API route handler for POST /api/compile.
 * Compiles C++ source code and returns the binary ID on success,
 * or detailed compilation errors on failure.
 *
 * Request body: { code: string, compiler?: 'g++' | 'clang++', flags?: string[] }
 * Response: { success: true, binaryId: string, duration: number, output: string }
 *          or { success: false, errors: Array<{message, line?, column?}>, duration: number }
 */

import { Router, type Request, type Response } from 'express';
import { compileCode, type CompileResult } from '../services/compiler.js';
import { validate, schemas, type CompileRequest } from '../middleware/validation.js';
import { compileRateLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/compile
 *
 * Compiles C++ source code in a secure Docker container.
 *
 * Request body:
 * - code (string, required): C++ source code to compile (max 50KB)
 * - compiler (string, optional): 'g++' or 'clang++' (default: 'g++')
 * - flags (string[], optional): Additional compiler flags
 *
 * Success response (200):
 * - success: true
 * - binaryId: UUID identifier for the compiled binary
 * - duration: Compilation time in milliseconds
 * - output: Compiler warnings/output (stderr)
 *
 * Error response (200 with success: false, or 400/500):
 * - success: false
 * - errors: Array of compilation errors with line/column info
 * - duration: Compilation time before failure
 */
router.post(
  '/',
  compileRateLimiter,
  validate(schemas.compile),
  asyncHandler(async (req: Request, res: Response) => {
    const { code, compiler, flags } = req.body as CompileRequest;

    logger.info('Compile request received', {
      compiler: compiler || 'g++',
      codeLength: code.length,
    });

    // Compile the code
    const result: CompileResult = await compileCode(code, {
      compiler,
      flags,
    });

    // Build response based on success/failure
    if (result.success) {
      logger.info('Compilation successful', {
        binaryId: result.binaryId,
        duration: result.duration,
      });

      res.status(200).json({
        success: true,
        binaryId: result.binaryId,
        duration: result.duration,
        output: result.output,
      });
    } else {
      logger.info('Compilation failed', {
        errorCount: result.errors?.length || 0,
        duration: result.duration,
      });

      res.status(200).json({
        success: false,
        errors: result.errors || [{ message: result.output }],
        duration: result.duration,
      });
    }
  })
);

export default router;
