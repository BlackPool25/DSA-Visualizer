/**
 * @file client.ts
 * @description LeetCode GraphQL client using native fetch API.
 * Queries LeetCode's public GraphQL endpoint for problem data.
 */

import type { Problem, Difficulty } from '@dsa-visualizer/shared';
import { logger } from '../../utils/logger.js';

/** LeetCode API response types (internal) */
interface TopicTag {
  name: string;
  slug: string;
}

interface CodeSnippet {
  lang: string;
  langSlug: string;
  code: string;
}

/** LeetCode GraphQL endpoint */
const LEETCODE_API = 'https://leetcode.com/graphql';

/** Standard headers for LeetCode API requests */
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

/** Represents a test case */
export interface TestCase {
  /** Raw input string */
  input: string;
  /** Expected output */
  expectedOutput: string;
}

/** Error types for LeetCode API failures */
export class LeetCodeError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = 'LeetCodeError';
  }
}

/** Rate limit error */
export class RateLimitError extends LeetCodeError {
  constructor(message = 'Rate limited by LeetCode API') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Makes a GraphQL request to LeetCode's API.
 *
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @returns Parsed response data
 * @throws LeetCodeError on API failures
 */
async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  try {
    const response = await fetch(LEETCODE_API, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ query, variables }),
    });

    // Handle rate limiting
    if (response.status === 429) {
      logger.warn('LeetCode API rate limit hit');
      throw new RateLimitError();
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const body = await response.text();
      logger.error('LeetCode API HTTP error', {
        status: response.status,
        body: body.slice(0, 500),
      });
      throw new LeetCodeError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        body
      );
    }

    const data = await response.json() as { errors?: Array<{ message: string }>; data: T };

    // Handle GraphQL errors
    if (data.errors) {
      const errorMessages = data.errors.map((e) => e.message).join(', ');
      logger.error('LeetCode GraphQL errors', { errors: data.errors });
      throw new LeetCodeError(`GraphQL errors: ${errorMessages}`);
    }

    return data.data;
  } catch (error) {
    if (error instanceof LeetCodeError) {
      throw error;
    }

    logger.error('LeetCode API request failed', { error });
    throw new LeetCodeError(
      `Request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Fetches a paginated list of problems from LeetCode.
 *
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of problems per page (max 100)
 * @param difficulty - Optional difficulty filter
 * @param tags - Optional topic tags filter
 * @returns Array of problems matching shared types
 */
export async function fetchProblemList(
  page: number,
  pageSize: number,
  difficulty?: Difficulty,
  tags?: string[]
): Promise<Problem[]> {
  const skip = (page - 1) * pageSize;

  const query = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          frontendQuestionId: questionFrontendId
          titleSlug
          title
          difficulty
          paidOnly: isPaidOnly
          topicTags {
            name
            slug
          }
        }
      }
    }
  `;

  const filters: Record<string, unknown> = {};
  if (difficulty) {
    filters.difficulty = difficulty.toUpperCase(); // LeetCode expects EASY, MEDIUM, HARD
  }
  if (tags && tags.length > 0) {
    filters.tags = tags;
  }

  const variables = {
    categorySlug: '', // Empty string for all problems
    limit: Math.min(pageSize, 100),
    skip,
    filters, // LeetCode expects filters object even if empty
  };

  logger.debug('Fetching problem list', { page, pageSize, difficulty, tags, variables });

  const data = await fetchGraphQL<{
    problemsetQuestionList: {
      questions: Array<{
        frontendQuestionId: string;
        titleSlug: string;
        title: string;
        difficulty: string;
        paidOnly: boolean;
        topicTags: TopicTag[];
      }>;
    };
  }>(query, variables);

  logger.debug('LeetCode API response', {
    hasData: !!data,
    hasProblemsetQuestionList: !!data?.problemsetQuestionList,
    questionCount: data?.problemsetQuestionList?.questions?.length || 0
  });

  if (!data?.problemsetQuestionList?.questions) {
    logger.warn('No questions returned from LeetCode API', { data });
    return [];
  }

  return data.problemsetQuestionList.questions
    .filter(q => !q.paidOnly) // Filter out premium problems
    .map((q) => ({
      id: parseInt(q.frontendQuestionId, 10),
      titleSlug: q.titleSlug,
      title: q.title,
      difficulty: q.difficulty as Difficulty,
      content: '', // Not available in list query
      topicTags: q.topicTags.map(tag => tag.slug), // Convert to string[]
      codeSnippets: {}, // Not available in list query
    }));
}

/**
 * Fetches detailed information for a specific problem from LeetCode's GraphQL API.
 * 
 * This function retrieves all necessary data for LeetCode-style problem execution:
 * - Problem metadata (ID, title, difficulty, description)
 * - Test case examples and sample inputs
 * - Code snippets for all supported languages
 * - Constraints, hints, and topic tags
 *
 * @param titleSlug - Problem's URL-friendly title (e.g., 'two-sum')
 * @returns Complete problem details with all fields needed for code execution
 * @throws LeetCodeError if problem not found or API request fails
 */
export async function fetchProblem(titleSlug: string): Promise<Problem> {
  // Comprehensive GraphQL query for LeetCode-style problem fetching:
  // - Basic info: questionFrontendId, titleSlug, title, difficulty
  // - Content: problem description HTML (includes constraints inline)
  // - Test cases: sampleTestCase (first example input), exampleTestcases (all test inputs)
  // - Metadata: topicTags (for categorization), hints (for assistance)
  // - Code templates: codeSnippets for all languages (C++, Python, Java, etc.)
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionFrontendId
        titleSlug
        title
        difficulty
        content
        sampleTestCase
        exampleTestcases
        hints
        topicTags {
          name
          slug
        }
        codeSnippets {
          lang
          langSlug
          code
        }
      }
    }
  `;

  logger.debug('Fetching problem details', { titleSlug });

  const data = await fetchGraphQL<{
    question: {
      questionFrontendId: string;
      titleSlug: string;
      title: string;
      difficulty: string;
      content: string;
      sampleTestCase: string;
      exampleTestcases: string;
      hints: string[];
      topicTags: TopicTag[];
      codeSnippets: CodeSnippet[];
    };
  }>(query, { titleSlug });

  const q = data.question;

  // Check if problem exists (returns null for invalid slugs or premium problems without access)
  if (!q) {
    logger.error('Problem not found or inaccessible', { titleSlug });
    throw new LeetCodeError(
      `Problem not found: "${titleSlug}". Check the slug is correct or the problem may be premium-only.`,
      404
    );
  }

  // Convert code snippets array to language-keyed map for easier lookup
  // Example: { 'cpp': 'class Solution {...}', 'python3': 'class Solution:...' }
  const codeSnippetsMap: Record<string, string> = {};
  for (const snippet of q.codeSnippets) {
    codeSnippetsMap[snippet.langSlug] = snippet.code;
  }

  return {
    id: parseInt(q.questionFrontendId, 10),
    titleSlug: q.titleSlug,
    title: q.title,
    difficulty: q.difficulty as Difficulty,
    content: q.content,
    sampleTestCase: q.sampleTestCase || '',
    exampleTestcases: q.exampleTestcases || '',
    hints: q.hints || [],
    topicTags: q.topicTags.map(tag => tag.slug),
    codeSnippets: codeSnippetsMap,
  };
}
