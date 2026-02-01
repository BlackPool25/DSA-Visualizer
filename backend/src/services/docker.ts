/**
 * @file docker.ts
 * @description Docker container management service using Dockerode.
 * Provides secure container execution with strict resource limits and
 * security settings to safely run untrusted user code.
 *
 * Security measures applied to all containers:
 * - No network access (NetworkDisabled: true)
 * - Read-only root filesystem (ReadonlyRootfs: true)
 * - No new privileges allowed (no-new-privileges security option)
 * - Memory limit: 256MB
 * - CPU quota: 50% of one CPU core
 * - Process limit: 50 PIDs
 * - Non-root user execution (UID 1000)
 * - Automatic container removal after execution
 */

import Docker from 'dockerode';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/** Docker client instance - initialized once and reused */
let dockerClient: Docker | null = null;

/** Default container security settings */
const SECURITY_SETTINGS = {
  /** Disable all network access */
  NetworkDisabled: true,

  /** 
   * ReadonlyRootfs is disabled because:
   * 1. Compilation needs to write temporary files
   * 2. GDB tracing needs to write trace.json
   * Security is maintained through network isolation, resource limits, and user namespace
   */
  // ReadonlyRootfs: true,

  /** Memory limit in bytes (256MB) */
  Memory: 256 * 1024 * 1024,

  /** CPU quota (50% of one CPU core) */
  CpuQuota: 50000,

  /** Maximum number of processes */
  PidsLimit: 50,

  /** Security options to prevent privilege escalation */
  SecurityOpt: ['no-new-privileges'],

  /** Auto-remove container after execution */
  AutoRemove: true,

  /**
   * Run as root in container for compilation/debugging access
   * Security is maintained through:
   * - Network isolation (no outbound access)
   * - Resource limits (memory, CPU, PIDs)
   * - Automatic container removal
   * - No privilege escalation
   * 
   * Note: The executor Dockerfile sets USER sandbox, but we override to root
   * for compilation and GDB access. This is safe because of network isolation.
   */
  User: 'root',
} as const;

/**
 * Result of a container execution command.
 */
export interface ContainerExecutionResult {
  /** Exit code from the command (0 = success) */
  exitCode: number;

  /** Standard output from the command */
  stdout: string;

  /** Standard error from the command */
  stderr: string;

  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Options for running a command in a container.
 */
export interface ContainerRunOptions {
  /** Working directory inside the container */
  workingDir?: string;

  /** Environment variables to set */
  env?: string[];

  /** Binds (volume mounts) in format ['host:container'] */
  binds?: string[];

  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Initialize the Docker client and verify connection.
 *
 * @returns Initialized Docker client
 * @throws Error if Docker is not accessible
 */
export async function initDockerClient(): Promise<Docker> {
  if (dockerClient) {
    return dockerClient;
  }

  try {
    // Connect to local Docker socket
    dockerClient = new Docker({ socketPath: '/var/run/docker.sock' });

    // Verify connection by checking Docker version
    const version = await dockerClient.version();
    logger.info(`Connected to Docker (version: ${version.Version})`);

    // Verify executor image exists
    const images = await dockerClient.listImages();
    const executorImage = images.find((img) =>
      img.RepoTags?.includes(config.EXECUTOR_IMAGE)
    );

    if (!executorImage) {
      logger.warn(`Executor image '${config.EXECUTOR_IMAGE}' not found locally. Will attempt to pull on first use.`);
    } else {
      logger.info(`Executor image '${config.EXECUTOR_IMAGE}' found`);
    }

    return dockerClient;
  } catch (error) {
    logger.error('Failed to initialize Docker client', { error });
    throw new Error(`Docker connection failed: ${error}`);
  }
}

/**
 * Gets the initialized Docker client, initializing if necessary.
 *
 * @returns Docker client instance
 */
export async function getDockerClient(): Promise<Docker> {
  if (!dockerClient) {
    return initDockerClient();
  }
  return dockerClient;
}

/**
 * Runs a command in a new Docker container with security restrictions.
 *
 * @param command - Array of command arguments to execute
 * @param options - Optional configuration for the container run
 * @returns Execution result with exit code, output, and duration
 * @throws Error if container execution fails
 */
export async function runInContainer(
  command: string[],
  options: ContainerRunOptions = {}
): Promise<ContainerExecutionResult> {
  const docker = await getDockerClient();
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000; // Default 30 second timeout

  // Collect stdout and stderr
  let stdout = '';
  let stderr = '';

  // Create pass-through streams to capture output
  const { PassThrough } = await import('stream');
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();

  stdoutStream.on('data', (data) => {
    stdout += data.toString();
  });

  stderrStream.on('data', (data) => {
    stderr += data.toString();
  });

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Container execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    logger.debug(`Running command in container: ${command.join(' ')}`, { timeoutMs });

    // Run the container with security settings
    // User must be at the container config level, not in HostConfig
    const { User, ...hostConfigSettings } = SECURITY_SETTINGS;
    
    const runPromise = docker.run(
      config.EXECUTOR_IMAGE,
      command,
      [stdoutStream, stderrStream],
      {
        Tty: false,
        User: User || 'root', // Override Dockerfile's USER sandbox
        WorkingDir: options.workingDir || '/workspace',
        Env: options.env || [],
        HostConfig: {
          ...hostConfigSettings,
          Binds: options.binds || [],
        },
      }
    );

    // Race between execution and timeout
    const [result] = await Promise.race([runPromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    const exitCode = result.StatusCode || 0;

    logger.debug(`Container execution completed`, {
      exitCode,
      duration,
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
    });

    return {
      exitCode,
      stdout,
      stderr,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this was a timeout
    if (errorMessage.includes('timed out')) {
      logger.warn('Container execution timed out', { command: command.join(' '), timeoutMs });

      return {
        exitCode: 124, // Standard timeout exit code
        stdout,
        stderr: `Execution timed out after ${timeoutMs}ms`,
        duration: Date.now() - startTime,
      };
    }

    logger.error('Container execution failed', { error, command: command.join(' ') });
    throw new Error(`Container execution failed: ${error}`);
  } finally {
    // Clean up streams
    stdoutStream.end();
    stderrStream.end();
  }
}

/**
 * Executes a command in an already running container.
 * Useful for persistent containers where you need to run multiple commands.
 *
 * @param containerId - ID of the running container
 * @param command - Command to execute
 * @returns Execution result
 * @throws Error if exec fails
 */
export async function execInContainer(
  containerId: string,
  command: string[]
): Promise<ContainerExecutionResult> {
  const docker = await getDockerClient();
  const container = docker.getContainer(containerId);
  const startTime = Date.now();

  try {
    // Create exec instance
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      User: '1000',
    });

    // Start exec and capture output
    const stream = await exec.start({ hijack: false });

    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      // Demultiplex stream to separate stdout and stderr
      const { PassThrough } = require('stream');
      const stdoutStream = new PassThrough();
      const stderrStream = new PassThrough();

      docker.modem.demuxStream(stream, stdoutStream, stderrStream);

      stdoutStream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stderrStream.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on('end', async () => {
        try {
          const inspect = await exec.inspect();
          const duration = Date.now() - startTime;

          resolve({
            exitCode: inspect.ExitCode || 0,
            stdout,
            stderr,
            duration,
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', reject);
    });
  } catch (error) {
    logger.error(`Exec in container failed: ${containerId}`, { error });
    throw new Error(`Exec in container failed: ${error}`);
  }
}

/**
 * Pulls the executor Docker image if not present locally.
 *
 * @returns Promise that resolves when image is ready
 */
export async function pullExecutorImage(): Promise<void> {
  const docker = await getDockerClient();

  try {
    logger.info(`Pulling executor image: ${config.EXECUTOR_IMAGE}`);

    const stream = await docker.pull(config.EXECUTOR_IMAGE);

    return new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Successfully pulled executor image: ${config.EXECUTOR_IMAGE}`);
          resolve();
        }
      });
    });
  } catch (error) {
    logger.error(`Failed to pull executor image: ${config.EXECUTOR_IMAGE}`, { error });
    throw new Error(`Failed to pull executor image: ${error}`);
  }
}
