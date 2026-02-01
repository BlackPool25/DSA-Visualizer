/**
 * @file logger.ts
 * @description Structured logging utility using Winston.
 * Provides consistent log formatting across the application with support
 * for different log levels and environments.
 */

import winston from 'winston';
import { config } from '../config.js';

/**
 * Winston logger instance configured for the application.
 * Uses JSON format in production for structured logging,
 * and simple format in development for readability.
 */
export const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'dsa-visualizer-backend' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0 && metadata.service) {
              const { service, ...rest } = metadata;
              if (Object.keys(rest).length > 0) {
                msg += ` ${JSON.stringify(rest)}`;
              }
            }
            return msg;
          })
        )
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Log a compilation event with relevant metadata.
 *
 * @param binaryId - Unique identifier for the compilation
 * @param success - Whether compilation succeeded
 * @param duration - Compilation duration in milliseconds
 * @param error - Optional error message if compilation failed
 */
export function logCompilation(binaryId: string, success: boolean, duration: number, error?: string): void {
  logger.info('Compilation completed', {
    binaryId,
    success,
    duration,
    ...(error && { error }),
  });
}

/**
 * Log an execution event with relevant metadata.
 *
 * @param binaryId - Unique identifier for the binary
 * @param success - Whether execution succeeded
 * @param duration - Execution duration in milliseconds
 * @param exitCode - Process exit code
 */
export function logExecution(binaryId: string, success: boolean, duration: number, exitCode: number): void {
  logger.info('Execution completed', {
    binaryId,
    success,
    duration,
    exitCode,
  });
}

/**
 * Log a trace generation event with relevant metadata.
 *
 * @param binaryId - Unique identifier for the binary
 * @param steps - Number of trace steps captured
 * @param duration - Trace generation duration in milliseconds
 */
export function logTrace(binaryId: string, steps: number, duration: number): void {
  logger.info('Trace generation completed', {
    binaryId,
    steps,
    duration,
  });
}
