/**
 * @file index.ts
 * @description Main entry point for the DSA Visualizer backend API.
 * Initializes Express server with all middleware, routes, and services.
 * Handles graceful shutdown on SIGTERM/SIGINT signals.
 *
 * Middleware order (important):
 * 1. helmet() - Security headers
 * 2. cors() - Cross-origin requests
 * 3. express.json() - Body parsing
 * 4. Rate limiters - Request throttling
 * 5. API routes - Business logic
 * 6. Error handler - Must be last
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';
import { initDockerClient } from './services/docker.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

/**
 * Creates and configures the Express application.
 *
 * @returns Configured Express app
 */
function createApp(): express.Application {
  const app = express();

  // 1. Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // 2. CORS
  app.use(cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // 3. Body parsing with size limit
  app.use(express.json({
    limit: config.MAX_REQUEST_SIZE,
  }));

  // 4. General rate limiting
  app.use(generalRateLimiter);

  // 5. API routes
  app.use('/api', routes);

  // 6. 404 handler for undefined routes
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // 7. Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

/**
 * Main server startup function.
 * Validates configuration, initializes services, and starts the HTTP server.
 */
async function main(): Promise<void> {
  try {
    // Validate configuration
    logger.info('Starting DSA Visualizer Backend...');
    validateConfig();
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Port: ${config.PORT}`);
    logger.info(`Executor Image: ${config.EXECUTOR_IMAGE}`);

    // Initialize Docker client
    logger.info('Initializing Docker client...');
    await initDockerClient();
    logger.info('Docker client initialized successfully');

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.PORT, () => {
      logger.info(`Server running on http://localhost:${config.PORT}`);
      logger.info(`API endpoints:`);
      logger.info(`  POST /api/compile - Compile C++ code`);
      logger.info(`  POST /api/run - Run compiled binary`);
      logger.info(`  POST /api/trace - Generate execution trace`);
      logger.info(`  GET  /api/health - Health check`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
main();
