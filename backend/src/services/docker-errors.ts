/**
 * @file docker-errors.ts
 * @description Custom error classes for Docker container execution
 * Provides structured error handling with detailed context
 */

/**
 * Base error class for Docker execution errors
 */
export class DockerExecutionError extends Error {
  constructor(
    message: string,
    public exitCode: number,
    public stdout: string,
    public stderr: string,
    public duration: number,
  ) {
    super(message);
    this.name = "DockerExecutionError";

    // Ensure prototype chain is maintained for instanceof checks
    Object.setPrototypeOf(this, DockerExecutionError.prototype);
  }

  /**
   * Get a summary of the error for logging
   */
  getSummary(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      exitCode: this.exitCode,
      duration: this.duration,
      stdoutLength: this.stdout.length,
      stderrLength: this.stderr.length,
      stderr: this.stderr.substring(0, 500), // Truncate for logging
    };
  }
}

/**
 * Error thrown when container execution times out
 */
export class DockerTimeoutError extends DockerExecutionError {
  constructor(
    stdout: string,
    stderr: string,
    duration: number,
    public timeoutMs: number,
  ) {
    super(
      `Execution timed out after ${timeoutMs}ms`,
      124, // Standard timeout exit code
      stdout,
      stderr,
      duration,
    );
    this.name = "DockerTimeoutError";

    Object.setPrototypeOf(this, DockerTimeoutError.prototype);
  }
}

/**
 * Error thrown when Docker daemon is not accessible
 */
export class DockerConnectionError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "DockerConnectionError";

    Object.setPrototypeOf(this, DockerConnectionError.prototype);
  }
}

/**
 * Error thrown when executor image is not found
 */
export class DockerImageNotFoundError extends Error {
  constructor(imageName: string) {
    super(
      `Docker image '${imageName}' not found. Run: docker-compose build executor`,
    );
    this.name = "DockerImageNotFoundError";

    Object.setPrototypeOf(this, DockerImageNotFoundError.prototype);
  }
}

/**
 * Error thrown when container output exceeds size limits
 */
export class DockerOutputLimitError extends DockerExecutionError {
  constructor(
    stdout: string,
    stderr: string,
    duration: number,
    public limitBytes: number,
  ) {
    super(
      `Output exceeded limit of ${limitBytes} bytes`,
      -1,
      stdout,
      stderr,
      duration,
    );
    this.name = "DockerOutputLimitError";

    Object.setPrototypeOf(this, DockerOutputLimitError.prototype);
  }
}

/**
 * Type guard to check if an error is a DockerExecutionError
 */
export function isDockerExecutionError(
  error: unknown,
): error is DockerExecutionError {
  return error instanceof DockerExecutionError;
}

/**
 * Type guard to check if an error is a DockerTimeoutError
 */
export function isDockerTimeoutError(
  error: unknown,
): error is DockerTimeoutError {
  return error instanceof DockerTimeoutError;
}

/**
 * Type guard to check if an error is a DockerConnectionError
 */
export function isDockerConnectionError(
  error: unknown,
): error is DockerConnectionError {
  return error instanceof DockerConnectionError;
}
