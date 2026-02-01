/**
 * @file errorHandler.ts
 * @description Global error handling middleware for Express.
 * Catches all errors thrown during request processing and returns
 * appropriate HTTP responses. Never exposes stack traces in production.
 *
 * This middleware must have exactly 4 parameters to be recognized
 * by Express as an error-handling middleware.
 *
 * @see https://expressjs.com/en/guide/error-handling.html
 */

import type { ErrorRequestHandler } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Custom application error class that distinguishes between
 * operational errors (expected) and programming errors (bugs).
 */
export class AppError extends Error {
  /** HTTP status code to return */
  statusCode: number;

  /** Whether this is an expected operational error */
  isOperational: boolean;

  /**
   * Creates a new application error.
   *
   * @param message - Error message to display
   * @param statusCode - HTTP status code (default: 500)
   * @param isOperational - Whether this is an expected error (default: true)
   */
  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'AppError';

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standard error response format.
 */
interface ErrorResponse {
  /** Whether the request was successful */
  success: false;

  /** Error message */
  error: string;

  /** HTTP status code */
  statusCode: number;

  /** Stack trace (only in development) */
  stack?: string;
}

/**
 * Global error handling middleware.
 * Must be registered last in the Express app to catch all errors.
 *
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function (required for signature)
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req,
  res,
  _next
): void => {
  // Log the error with context
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  });

  // Determine status code
  let statusCode = 500;
  if (err instanceof AppError) {
    statusCode = err.statusCode;
  } else if ('statusCode' in err && typeof err.statusCode === 'number') {
    statusCode = err.statusCode;
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: err instanceof AppError && err.isOperational
      ? err.message
      : 'Internal Server Error',
    statusCode,
  };

  // Only include stack trace in development
  if (config.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers.
 * Catches rejected promises and passes them to the error handler.
 *
 * @param fn - Async route handler function
 * @returns Wrapped function that catches errors
 *
 * @example
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   res.json(data);
 * }));
 */
export function asyncHandler(
  fn: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>
) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
