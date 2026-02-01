/**
 * LeetCode Problem Types
 * 
 * Defines types for representing LeetCode problems, test cases,
 * and function signatures.
 */

/** Difficulty level of a problem */
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

/** Represents a LeetCode problem */
export interface Problem {
  /** LeetCode problem ID */
  id: number;
  /** URL-friendly title slug */
  titleSlug: string;
  /** Display title */
  title: string;
  /** Difficulty level */
  difficulty: Difficulty;
  /** HTML problem description */
  content: string;
  /** Topic tags (e.g., "array", "dynamic-programming") */
  topicTags: string[];
  /** Code templates by language */
  codeSnippets: Record<string, string>;
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