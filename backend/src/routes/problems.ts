/**
 * @file problems.ts
 * @description API routes for fetching LeetCode problem data.
 * 
 * Provides endpoints to browse and retrieve problem information from LeetCode's
 * public GraphQL API. Supports filtering, pagination, and detailed problem views.
 * 
 * Endpoints:
 * - GET /api/problems - Paginated list with filters
 * - GET /api/problems/:slug - Detailed problem view with test cases and code snippets
 */

import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { generalRateLimiter } from '../middleware/rateLimiter.js';
import { fetchProblem, fetchProblemList, LeetCodeError } from '../services/leetcode/index.js';
import { logger } from '../utils/logger.js';

const router: RouterType = Router();

/** Schema for GET /api/problems query parameters */
const problemListQuerySchema = z.object({
  page: z.string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1, 'Page must be at least 1')),
  pageSize: z.string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(100, 'Page size cannot exceed 100')),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'])
    .optional(),
  tags: z.string()
    .optional()
    .transform((val) => val ? val.split(',') : undefined),
});

/**
 * GET /api/problems
 * Fetch paginated list of LeetCode problems with optional filters.
 * 
 * Query parameters:
 * - page (number, optional): Page number (1-based, default: 1)
 * - pageSize (number, optional): Problems per page (1-100, default: 20)
 * - difficulty (string, optional): Filter by difficulty (\"Easy\", \"Medium\", \"Hard\")
 * - tags (string, optional): Comma-separated topic tags (e.g., \"array,hash-table\")
 * 
 * Success response (200): Array of Problem objects
 * - Each object includes: id, title, titleSlug, difficulty, topicTags
 * - Premium problems are automatically filtered out
 * 
 * Error response (502): LeetCode API failure
 */
router.get(
  '/',
  generalRateLimiter,
  validate(problemListQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, pageSize, difficulty, tags } = req.query as unknown as {
        page: number;
        pageSize: number;
        difficulty?: 'Easy' | 'Medium' | 'Hard';
        tags?: string[];
      };

      logger.debug('Fetching problem list', { page, pageSize, difficulty, tags });

      const problems = await fetchProblemList(page, pageSize, difficulty, tags);

      // Return array directly to match frontend expectations
      res.json(problems);
    } catch (error) {
      if (error instanceof LeetCodeError) {
        logger.error('LeetCode API error', { error: error.message, statusCode: error.statusCode });
        return res.status(502).json({
          success: false,
          error: 'Failed to fetch problems from LeetCode',
          details: error.message,
        });
      }
      next(error);
    }
  }
);

/**
 * GET /api/problems/:slug
 * Fetch detailed information for a specific LeetCode problem.
 * 
 * Path parameters:
 * - slug (string): Problem's URL-friendly identifier (e.g., \"two-sum\", \"reverse-linked-list\")
 * 
 * Success response (200): Problem object with all details
 * - id, title, titleSlug, difficulty
 * - content: HTML problem description (includes constraints)
 * - sampleTestCase: First example input
 * - exampleTestcases: All test case inputs (newline-separated)
 * - hints: Array of hint strings
 * - topicTags: Array of topic slugs (e.g., [\"array\", \"hash-table\"])
 * - codeSnippets: Map of language to code template (e.g., { cpp: \"class Solution...\", python3: \"class Solution:...\" })
 * 
 * Error responses:
 * - 404: Problem not found
 * - 502: LeetCode API failure
 */
router.get(
  '/:slug',
  generalRateLimiter,
  async (req, res, next) => {
    try {
      const { slug } = req.params;

      logger.debug('Fetching problem details', { slug });

      const problem = await fetchProblem(slug);

      // Return problem directly to match frontend expectations
      res.json(problem);
    } catch (error) {
      if (error instanceof LeetCodeError) {
        logger.error('LeetCode API error', { error: error.message, slug: req.params.slug });

        // Return 404 if problem not found
        if (error.message.includes('not found') || error.statusCode === 404) {
          return res.status(404).json({
            success: false,
            error: 'Problem not found',
            details: `No problem found with slug: ${req.params.slug}`,
          });
        }

        return res.status(502).json({
          success: false,
          error: 'Failed to fetch problem from LeetCode',
          details: error.message,
        });
      }
      next(error);
    }
  }
);

export default router;
