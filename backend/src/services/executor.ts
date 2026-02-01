/**
 * @file executor.ts
 * @description Binary execution service that runs compiled C++ programs.
 * Handles stdin input, captures stdout/stderr, enforces timeouts, and
 * manages the execution lifecycle securely within Docker containers.
 */

import { config } from '../config.js';
import { logger, logExecution } from '../utils/logger.js';
import {
  getBinaryPath,
  writeInputFile,
  cleanupTempDirectory,
  isValidBinaryId,
} from '../utils/tempFiles.js';
import { runInContainer } from './docker.js';

/**
 * Result of a binary execution.
 */
export interface RunResult {
  /** Whether execution succeeded (process exited with code 0) */
  success: boolean;

  /** Standard output from the program */
  stdout: string;

  /** Standard error from the program */
  stderr: string;

  /** Process exit code */
  exitCode: number;

  /** Execution duration in milliseconds */
  duration: number;

  /** Whether execution was terminated due to timeout */
  timedOut: boolean;
}

/**
 * Options for binary execution.
 */
export interface RunOptions {
  /** Input to provide via stdin */
  stdin?: string;

  /** Maximum execution time in milliseconds */
  timeoutMs?: number;
}

/**
 * Validates that a binary ID is a valid UUID format.
 * This prevents path traversal attacks by ensuring the ID follows
 * the expected UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * @param id - The ID to validate
 * @returns True if valid UUID format, false otherwise
 */
export function validateBinaryId(id: string): boolean {
  return isValidBinaryId(id);
}

/**
 * Executes a compiled binary with optional input.
 *
 * @param binaryId - Unique identifier for the compiled binary
 * @param options - Execution options (stdin, timeout)
 * @returns RunResult with outputs, exit code, and timing information
 *
 * @example
 * const result = await runBinary('uuid-here', { stdin: '5\n1 2 3 4 5\n' });
 * if (result.success) {
 *   console.log('Output:', result.stdout);
 * }
 */
export async function runBinary(
  binaryId: string,
  options: RunOptions = {}
): Promise<RunResult> {
  const startTime = Date.now();

  // Validate binaryId format for security
  if (!validateBinaryId(binaryId)) {
    return {
      success: false,
      stdout: '',
      stderr: 'Invalid binary ID format',
      exitCode: -1,
      duration: 0,
      timedOut: false,
    };
  }

  const binaryPath = getBinaryPath(binaryId);
  const timeoutMs = options.timeoutMs || config.MAX_RUN_TIMEOUT_MS;

  try {
    // Prepare command
    const command = ['/workspace/solution'];

    // Prepare binds
    const binaryDir = binaryPath.substring(0, binaryPath.lastIndexOf('/'));
    const binds = [`${binaryDir}:/workspace`];

    // Write input file if stdin provided
    let inputFilePath: string | undefined;
    if (options.stdin) {
      inputFilePath = await writeInputFile(binaryDir, options.stdin);
      // Redirect input from file
      command.push('<', '/workspace/input.txt');
    }

    logger.debug(`Starting binary execution`, {
      binaryId,
      hasInput: !!options.stdin,
      timeoutMs,
    });

    // Run the binary in container
    // Note: Dockerode doesn't directly support stdin redirection with <,
    // so we use a shell to handle it
    const shellCommand = ['/bin/sh', '-c', command.join(' ')];

    const result = await runInContainer(shellCommand, {
      workingDir: '/workspace',
      binds,
      timeoutMs,
    });

    const duration = Date.now() - startTime;

    // Determine if timed out (exit code 137 = SIGKILL, likely from timeout)
    const timedOut = result.exitCode === 137 || result.exitCode === 124;

    // Determine success (exit code 0 = success)
    const success = result.exitCode === 0 && !timedOut;

    logExecution(binaryId, success, duration, result.exitCode);

    logger.debug(`Binary execution completed`, {
      binaryId,
      exitCode: result.exitCode,
      duration,
      timedOut,
      success,
    });

    return {
      success,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration,
      timedOut,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Binary execution failed', { binaryId, error });

    return {
      success: false,
      stdout: '',
      stderr: `Execution failed: ${error}`,
      exitCode: -1,
      duration,
      timedOut: false,
    };
  }
}

/**
 * Runs a binary and automatically cleans up temporary files afterward.
 * This is useful for one-off executions where you don't need to keep the binary.
 *
 * @param binaryId - Unique identifier for the compiled binary
 * @param options - Execution options
 * @returns RunResult with execution details
 */
export async function runAndCleanup(
  binaryId: string,
  options: RunOptions = {}
): Promise<RunResult> {
  try {
    const result = await runBinary(binaryId, options);
    return result;
  } finally {
    // Always cleanup, even if execution fails
    await cleanupTempDirectory(binaryId);
  }
}

/**
 * Validates that a binary exists and is executable.
 *
 * @param binaryId - Unique identifier for the binary
 * @returns Object with valid flag and optional error message
 */
export async function validateBinary(binaryId: string): Promise<{ valid: boolean; error?: string }> {
  // Check format
  if (!validateBinaryId(binaryId)) {
    return { valid: false, error: 'Invalid binary ID format' };
  }

  // Check existence
  try {
    const binaryPath = getBinaryPath(binaryId);
    const { access, constants } = await import('fs/promises');
    await access(binaryPath, constants.X_OK);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Binary not found or not executable' };
  }
}
