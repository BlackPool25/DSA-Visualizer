/**
 * @file notFound.ts
 * @description 404 Not Found handler middleware
 * Returns a standardized 404 response for undefined routes
 */

import { Request, Response } from "express";

/**
 * 404 handler for undefined routes
 * Should be registered after all other routes but before error handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.method} ${req.url} not found`,
  });
}
