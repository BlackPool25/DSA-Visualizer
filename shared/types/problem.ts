/**
 * LeetCode Problem Types
 * 
 * Defines types for representing LeetCode problems, test cases,
 * and function signatures.
 */

/** Difficulty level of a problem */
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** 
 * Represents a LeetCode problem with all necessary data for execution.
 * Includes problem metadata, test cases, code templates, and hints.
 * 
 * Note: Constraints are embedded in the content HTML, not a separate field.
 */
export interface Problem {
  /** LeetCode problem ID */
  id: number;
  /** URL-friendly title slug (e.g., "two-sum") */
  titleSlug: string;
  /** Display title (e.g., "Two Sum") */
  title: string;
  /** Difficulty level */
  difficulty: Difficulty;
  /** HTML problem description with examples and constraints */
  content: string;
  /** Topic tags (e.g., "array", "dynamic-programming") - simple string array format */
  topicTags: string[];
  /** Code templates by language - map from language slug to code (e.g., { cpp: "class Solution {...}", python3: "class Solution:..." }) */
  codeSnippets: Record<string, string>;
  /** Sample test case input (first example) */
  sampleTestCase?: string;
  /** All example test cases (newline-separated inputs) */
  exampleTestcases?: string;
  /** Problem hints array for assistance */
  hints?: string[];
  /** Whether the problem is a paid/premium problem */
  isPaidOnly?: boolean;
  /** Number of likes (for popularity sorting) */
  likes?: number;
  /** Number of dislikes */
  dislikes?: number;
}

/** Represents a test case for a problem */
export interface TestCase {
  /** Raw input string */
  input: string;
  /** Expected output */
  expectedOutput: string;
  /** Whether this is a custom user test case */
  isCustom: boolean;
}

/** Represents a parsed function parameter */
export interface Parameter {
  /** Parameter type (e.g., "int", "ListNode*") */
  type: string;
  /** Parameter name */
  name: string;
}

/** Represents a parsed function signature from code snippet */
export interface FunctionSignature {
  /** Return type */
  returnType: string;
  /** Function name */
  functionName: string;
  /** Function parameters */
  parameters: Parameter[];
}

// ========== Phase 3 Support Types ==========

/** Response for paginated problem list requests */
export interface ProblemListResponse {
  /** List of problems on current page */
  problems: Problem[];
  /** Total number of problems available */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of problems per page */
  pageSize: number;
  /** Whether there are more pages */
  hasMore: boolean;
}

/** Generic wrapper for LeetCode GraphQL responses */
export interface LeetCodeGraphQLResponse<T> {
  /** Response data */
  data?: T;
  /** Errors if the query failed */
  errors?: Array<{
    message: string;
    path?: string[];
  }>;
}

/** Problem data from LeetCode GraphQL API */
export interface LeetCodeProblemData {
  /** The problem question data */
  question: Problem | null;
}

/** Problem list data from LeetCode GraphQL API */
export interface LeetCodeProblemListData {
  /** List of problems */
  problemsetQuestionList: {
    /** Total count of problems */
    total: number;
    /** Array of problems */
    data: Problem[];
  };
}