/**
 * @file asyncHandler.ts
 * @description Async error handling wrapper for Express routes
 * Catches promise rejections from async route handlers and passes them to error middleware
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => {
 *     const data = await fetchData();
 *     res.json(data);
 *   }));
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Type for async request handler functions
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void | Response>;

/**
 * Wraps an async route handler to catch errors and pass them to Express error middleware.
 * This eliminates the need for try-catch blocks in every async route.
 *
 * @param fn - Async route handler function
 * @returns Express middleware function that handles errors
 *
 * @example
 * router.post('/compile', asyncHandler(async (req, res) => {
 *   const result = await compileCode(req.body.code);
 *   res.json(result);
 * }));
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wraps an async middleware function to catch errors.
 * Useful for middleware that performs async operations.
 *
 * @param fn - Async middleware function
 * @returns Express middleware function that handles errors
 */
export const asyncMiddleware = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
