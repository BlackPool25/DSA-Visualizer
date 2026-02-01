/**
 * @file harness.ts
 * @description API routes for C++ harness code generation.
 * 
 * This endpoint generates executable C++ code from user's Solution class,
 * enabling LeetCode-style problem solving where users write only the solution
 * method without needing to handle I/O, deserialization, or main() function.
 * 
 * Flow:
 * 1. Fetch problem details from LeetCode (to get original code snippet)
 * 2. Parse function signature from code (return type, parameters)
 * 3. Generate complete harness with main(), deserializers, serializers
 * 4. Return ready-to-compile C++ code
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { generalRateLimiter } from '../middleware/rateLimiter.js';
import { fetchProblem, LeetCodeError } from '../services/leetcode/index.js';
import { parseSignature, generateHarness } from '../services/harness/index.js';
import { logger } from '../utils/logger.js';

const router: RouterType = Router();

/**
 * Schema for POST /api/harness request body.
 * Accepts both naming conventions for frontend compatibility:
 * - problemSlug OR slug: LeetCode problem identifier
 * - userCode OR code: User's C++ Solution class
 */
const harnessRequestSchema = z.object({
  // Accept both 'problemSlug' and 'slug' for backwards compatibility
  problemSlug: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  // Accept both 'userCode' and 'code' for backwards compatibility  
  userCode: z.string().optional(),
  code: z.string().optional(),
  // Test input as JSON array string
  testInput: z.string()
    .min(1, 'Test input is required')
    .max(10 * 1024, 'Test input too large'),
}).refine(
  // Require at least one of problemSlug or slug
  (data) => data.problemSlug || data.slug,
  { message: 'Either problemSlug or slug is required', path: ['slug'] }
);

type HarnessRequest = z.infer<typeof harnessRequestSchema>;

/**
 * POST /api/harness
 * Generate complete executable C++ code from user's Solution class.
 * 
 * This endpoint implements the core of LeetCode-style execution:
 * - Fetches problem metadata from LeetCode GraphQL API
 * - Parses the function signature to understand input/output types
 * - Wraps user code with complete I/O handling infrastructure
 * - Returns ready-to-compile C++ code with all necessary headers
 * 
 * Request body:
 * - problemSlug or slug (string): LeetCode problem identifier (e.g., "two-sum")
 * - userCode or code (string, optional): User's Solution class code. If not provided, uses LeetCode's C++ template
 * - testInput (string): JSON array of test inputs (e.g., "[[2,7,11,15], 9]")
 * 
 * Success response (200):
 * - success: true
 * - data: {
 *     harnessedCode: Complete C++ source code
 *     code: Same as harnessedCode (backward compatibility)
 *     problem: { title, titleSlug, difficulty }
 *     signature: { returnType, functionName, parameters }
 *   }
 * 
 * Error responses:
 * - 404: Problem not found on LeetCode
 * - 400: Invalid code, signature parsing failed, or generation failed
 * - 502: LeetCode API error
 */
router.post(
  '/',
  generalRateLimiter,
  validate(harnessRequestSchema),
  async (req, res, next) => {
    try {
      const body = req.body as HarnessRequest;
      // Support both naming conventions
      const problemSlug = body.problemSlug || body.slug!;
      const userCode = body.userCode || body.code;
      const { testInput } = body;

      logger.debug('Generating harness', { problemSlug });

      // Fetch problem details from LeetCode
      let problem;
      try {
        problem = await fetchProblem(problemSlug);
      } catch (error) {
        if (error instanceof LeetCodeError) {
          logger.error('Failed to fetch problem', { error: error.message, slug: problemSlug });

          if (error.message.includes('not found') || error.statusCode === 404) {
            return res.status(404).json({
              success: false,
              error: 'Problem not found',
              details: `No problem found with slug: ${problemSlug}`,
            });
          }

          return res.status(502).json({
            success: false,
            error: 'Failed to fetch problem from LeetCode',
            details: error.message,
          });
        }
        throw error;
      }

      // Get C++ code snippet from Record<string, string>
      const cppSnippet = problem.codeSnippets['cpp'];
      const cppCode = userCode || cppSnippet;
      if (!cppCode) {
        return res.status(400).json({
          success: false,
          error: 'No C++ code available',
          details: userCode
            ? 'No user code provided and no C++ snippet available for this problem'
            : 'No C++ code snippet found for this problem',
        });
      }

      // Parse function signature from code
      let signature;
      try {
        signature = parseSignature(cppCode);
      } catch (error) {
        logger.error('Failed to parse signature', { error, code: cppCode.slice(0, 200) });
        return res.status(400).json({
          success: false,
          error: 'Failed to parse function signature',
          details: error instanceof Error ? error.message : String(error),
        });
      }

      // Generate harness code
      const result = generateHarness({
        userCode: cppCode,
        signature,
        testInput,
      });

      if (!result.success) {
        logger.error('Harness generation failed', { error: result.error });
        return res.status(400).json({
          success: false,
          error: 'Harness generation failed',
          details: result.error,
        });
      }

      // Return response matching frontend ApiResponse<{ harnessedCode }> expectation
      res.json({
        success: true,
        data: {
          harnessedCode: result.code,
          code: result.code, // Also include raw code for backward compatibility
          problem: {
            title: problem.title,
            titleSlug: problem.titleSlug,
            difficulty: problem.difficulty,
          },
          signature: {
            returnType: signature.returnType,
            functionName: signature.functionName,
            parameters: signature.parameters,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
