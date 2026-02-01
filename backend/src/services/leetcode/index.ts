/**
 * @file index.ts
 * @description LeetCode service exports.
 * Re-exports the GraphQL client functions and types.
 */

export {
  fetchProblem,
  fetchProblemList,
  LeetCodeError,
  RateLimitError,
} from './client.js';

export type {
  TestCase,
} from './client.js';
