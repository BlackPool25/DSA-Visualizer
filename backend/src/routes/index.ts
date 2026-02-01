/**
 * @file index.ts
 * @description Route aggregator that combines all API routes.
 * Mounts compile, run, and trace routes under /api/* prefix.
 */

import { Router } from 'express';
import { getDockerClient } from '../services/docker.js';
import compileRouter from './compile.js';
import runRouter from './run.js';
import traceRouter from './trace.js';

const router = Router();

/**
 * Mount route handlers:
 * - POST /api/compile - Compile C++ code
 * - POST /api/run - Execute compiled binary
 * - POST /api/trace - Generate execution trace
 */
router.use('/compile', compileRouter);
router.use('/run', runRouter);
router.use('/trace', traceRouter);

/**
 * Health check endpoint at /api/health
 * Returns 200 OK with status information and Docker connectivity check
 */
router.get('/health', async (_req, res) => {
  try {
    // Verify Docker is accessible
    const docker = await getDockerClient();
    const dockerInfo = await docker.info();

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      docker: {
        connected: true,
        version: dockerInfo.ServerVersion,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: 'Docker connectivity failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
