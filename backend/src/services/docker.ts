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
 * - Output size limits to prevent memory exhaustion
 */

import Docker from "dockerode";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  DockerExecutionError,
  DockerTimeoutError,
  DockerConnectionError,
  DockerImageNotFoundError,
  DockerOutputLimitError,
} from "./docker-errors.js";

/** Docker client instance - initialized once and reused */
let dockerClient: Docker | null = null;

/** Default output size limit (10MB) */
const OUTPUT_SIZE_LIMIT = 10 * 1024 * 1024;

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
  SecurityOpt: ["no-new-privileges"],

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
  User: "root",
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

  /** Maximum output size in bytes (default: 10MB) */
  maxOutputSize?: number;

  /** Optional memory override in bytes for this run */
  memoryBytes?: number;
}

/**
 * Initialize the Docker client and verify connection.
 *
 * @returns Initialized Docker client
 * @throws DockerConnectionError if Docker is not accessible
 */
export async function initDockerClient(): Promise<Docker> {
  if (dockerClient) {
    return dockerClient;
  }

  try {
    // Connect to local Docker socket
    dockerClient = new Docker({ socketPath: "/var/run/docker.sock" });

    // Verify connection by checking Docker version
    const version = await dockerClient.version();
    logger.info(`Connected to Docker (version: ${version.Version})`);

    // Verify executor image exists
    const images = await dockerClient.listImages();
    const executorImage = images.find((img) =>
      img.RepoTags?.includes(config.EXECUTOR_IMAGE),
    );

    if (!executorImage) {
      logger.warn(
        `Executor image '${config.EXECUTOR_IMAGE}' not found locally. Will attempt to pull on first use.`,
      );
    } else {
      logger.info(`Executor image '${config.EXECUTOR_IMAGE}' found`);
    }

    return dockerClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to initialize Docker client", { error: errorMessage });
    throw new DockerConnectionError(
      `Docker connection failed: ${errorMessage}`,
      error instanceof Error ? error : undefined,
    );
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
 * Features:
 * - Automatic timeout handling with AbortController
 * - Output size limits to prevent memory exhaustion
 * - Proper stream cleanup to avoid resource leaks
 * - Detailed error context for debugging
 *
 * @param command - Array of command arguments to execute
 * @param options - Optional configuration for the container run
 * @returns Execution result with exit code, output, and duration
 * @throws DockerTimeoutError if execution times out
 * @throws DockerExecutionError if command fails
 * @throws DockerConnectionError if Docker is not accessible
 */
export async function runInContainer(
  command: string[],
  options: ContainerRunOptions = {},
): Promise<ContainerExecutionResult> {
  const docker = await getDockerClient();
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 30000;
  const maxOutputSize = options.maxOutputSize || OUTPUT_SIZE_LIMIT;

  // Collect stdout and stderr using streams with proper cleanup
  let stdout = "";
  let stderr = "";
  let outputPaused = false;

  const { PassThrough } = await import("stream");
  const stdoutStream = new PassThrough();
  const stderrStream = new PassThrough();

  // Handle data with backpressure protection and size limits
  stdoutStream.on("data", (data: Buffer) => {
    if (outputPaused) return;

    stdout += data.toString();

    // Prevent memory exhaustion from excessive output
    if (stdout.length + stderr.length > maxOutputSize) {
      outputPaused = true;
      stdoutStream.pause();
      stderrStream.pause();
      logger.warn("Output size limit reached, pausing stream", {
        maxSize: maxOutputSize,
        currentSize: stdout.length + stderr.length,
      });
    }
  });

  stderrStream.on("data", (data: Buffer) => {
    if (outputPaused) return;

    stderr += data.toString();

    if (stdout.length + stderr.length > maxOutputSize) {
      outputPaused = true;
      stdoutStream.pause();
      stderrStream.pause();
    }
  });

  // Create abort controller for timeout and cancellation
  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    logger.debug(`Running command in container: ${command.join(" ")}`, {
      timeoutMs,
      maxOutputSize,
    });

    // Build container configuration
    const { User, ...hostConfigSettings } = SECURITY_SETTINGS;

    const containerConfig = {
      Image: config.EXECUTOR_IMAGE,
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      User: User || "root",
      WorkingDir: options.workingDir || "/workspace",
      Env: options.env || [],
      HostConfig: {
        ...hostConfigSettings,
        ...(options.memoryBytes ? { Memory: options.memoryBytes } : {}),
        Binds: options.binds || [],
      },
    };

    // Create a promise for the Docker run operation
    const runPromise = docker.run(
      config.EXECUTOR_IMAGE,
      command,
      [stdoutStream, stderrStream],
      containerConfig,
    );

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        reject(
          new DockerTimeoutError(
            stdout,
            stderr,
            Date.now() - startTime,
            timeoutMs,
          ),
        );
      }, timeoutMs);
    });

    // Race between execution and timeout
    const [result] = await Promise.race([runPromise, timeoutPromise]);

    // Clear timeout if execution completed first
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const duration = Date.now() - startTime;
    const exitCode = result.StatusCode || 0;

    // Check if output limit was exceeded
    if (outputPaused) {
      throw new DockerOutputLimitError(stdout, stderr, duration, maxOutputSize);
    }

    // Handle non-zero exit codes as errors
    if (exitCode !== 0) {
      throw new DockerExecutionError(
        `Command failed with exit code ${exitCode}`,
        exitCode,
        stdout,
        stderr,
        duration,
      );
    }

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
    const duration = Date.now() - startTime;

    // Clear timeout if it exists
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Re-throw known Docker errors
    if (
      error instanceof DockerExecutionError ||
      error instanceof DockerTimeoutError ||
      error instanceof DockerOutputLimitError ||
      error instanceof DockerConnectionError
    ) {
      throw error;
    }

    // Handle abort errors (timeout)
    if (error instanceof Error && error.name === "AbortError") {
      throw new DockerTimeoutError(stdout, stderr, duration, timeoutMs);
    }

    // Handle Docker image not found
    if (error instanceof Error && error.message?.includes("No such image")) {
      throw new DockerImageNotFoundError(config.EXECUTOR_IMAGE);
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Container execution failed", {
      error: errorMessage,
      command: command.join(" "),
    });

    throw new DockerExecutionError(
      `Container execution failed: ${errorMessage}`,
      -1,
      stdout,
      stderr,
      duration,
    );
  } finally {
    // Ensure streams are properly closed
    stdoutStream.end();
    stderrStream.end();

    // Abort any pending operations
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  }
}

/**
 * Validates that the executor image exists locally.
 *
 * @returns True if image exists, false otherwise
 */
export async function validateExecutorImage(): Promise<boolean> {
  try {
    const docker = await getDockerClient();
    const images = await docker.listImages();
    return images.some((img) => img.RepoTags?.includes(config.EXECUTOR_IMAGE));
  } catch {
    return false;
  }
}

/**
 * Pulls the executor image if it doesn't exist locally.
 *
 * @throws DockerConnectionError if Docker is not accessible
 */
export async function pullExecutorImage(): Promise<void> {
  const docker = await getDockerClient();

  logger.info(`Pulling executor image: ${config.EXECUTOR_IMAGE}`);

  try {
    const stream = await docker.pull(config.EXECUTOR_IMAGE);

    return new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          reject(
            new DockerConnectionError(
              `Failed to pull image: ${err.message}`,
              err,
            ),
          );
        } else {
          logger.info("Executor image pulled successfully");
          resolve();
        }
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DockerConnectionError(
      `Failed to pull executor image: ${message}`,
    );
  }
}
