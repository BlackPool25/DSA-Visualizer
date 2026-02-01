/**
 * @file compiler.ts
 * @description C++ code compilation service that manages the compilation lifecycle.
 * Handles writing source files to temporary storage, invoking g++ with appropriate
 * flags, parsing compilation errors, and cleaning up temporary files.
 *
 * Compilation uses g++ with the following flags:
 * - -g: Include debug symbols for GDB tracing
 * - -O0: Disable optimizations for accurate debugging
 * - -std=c++17: C++17 standard
 * - -Wall: Enable all warnings
 * - -Wextra: Enable extra warnings
 */

import { config } from '../config.js';
import { logger, logCompilation } from '../utils/logger.js';
import {
  createTempDirectory,
  writeSourceFile,
  cleanupTempDirectory,
  getBinaryPath,
  getSourcePath,
  isValidBinaryId,
} from '../utils/tempFiles.js';
import { runInContainer } from './docker.js';

/**
 * Options for compilation.
 */
export interface CompileOptions {
  /** Compiler to use (currently only 'g++' is supported) */
  compiler?: 'g++' | 'clang++';

  /** Additional compiler flags */
  flags?: string[];

  /** Compilation timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Information about a compilation error.
 */
export interface CompileError {
  /** Error message */
  message: string;

  /** Line number where error occurred (1-indexed) */
  line?: number;

  /** Column number where error occurred (1-indexed) */
  column?: number;
}

/**
 * Result of a compilation attempt.
 */
export interface CompileResult {
  /** Whether compilation succeeded */
  success: boolean;

  /** Unique identifier for the compiled binary (only present on success) */
  binaryId?: string;

  /** List of compilation errors (only present on failure) */
  errors?: CompileError[];

  /** Compiler output (stdout + stderr) */
  output: string;

  /** Compilation duration in milliseconds */
  duration: number;
}

/** Default compiler flags for debug builds */
const DEFAULT_FLAGS = ['-g', '-O0', '-std=c++17', '-Wall', '-Wextra'];

/**
 * Compiles C++ source code inside the executor container.
 *
 * @param code - The C++ source code to compile
 * @param options - Compilation options (compiler, flags, timeout)
 * @returns CompileResult with success status, binary ID, or error details
 *
 * @example
 * const result = await compileCode('#include <iostream>...', { compiler: 'g++' });
 * if (result.success) {
 *   console.log('Binary ready:', result.binaryId);
 * }
 */
export async function compileCode(
  code: string,
  options: CompileOptions = {}
): Promise<CompileResult> {
  const startTime = Date.now();

  try {
    // Create temporary directory for this compilation
    const { id: binaryId, dirPath } = await createTempDirectory();

    // Write source file to temp directory
    await writeSourceFile(dirPath, 'solution.cpp', code);

    // Build compilation command
    const compiler = options.compiler || 'g++';
    const flags = options.flags || DEFAULT_FLAGS;
    const outputFile = '/workspace/solution';
    const sourceFile = '/workspace/solution.cpp';

    const command = [
      compiler,
      ...flags,
      '-o', outputFile,
      sourceFile,
    ];

    logger.debug(`Starting compilation`, { binaryId, command: command.join(' ') });

    // Run compilation in container
    const result = await runInContainer(command, {
      workingDir: '/workspace',
      binds: [`${dirPath}:/workspace`],
      timeoutMs: options.timeoutMs || config.MAX_COMPILE_TIMEOUT_MS,
    });

    const duration = Date.now() - startTime;

    // Check if compilation succeeded
    if (result.exitCode === 0) {
      logCompilation(binaryId, true, duration);

      return {
        success: true,
        binaryId,
        output: result.stderr, // Compiler warnings go to stderr
        duration,
      };
    } else {
      // Compilation failed - parse errors
      const errors = parseCompilerErrors(result.stderr);

      logCompilation(binaryId, false, duration, result.stderr);

      // Clean up failed compilation files
      await cleanupTempDirectory(binaryId);

      return {
        success: false,
        errors,
        output: result.stderr,
        duration,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Compilation service error', { error });

    return {
      success: false,
      errors: [{ message: `Compilation failed: ${error}` }],
      output: String(error),
      duration,
    };
  }
}

/**
 * Parses compiler error output (GCC/Clang) to extract structured error information.
 *
 * Parses error messages in the format:
 * solution.cpp:10:5: error: 'x' was not declared in this scope
 *
 * @param stderr - Standard error output from the compiler
 * @returns Array of parsed compilation errors
 */
export function parseCompilerErrors(stderr: string): CompileError[] {
  const errors: CompileError[] = [];

  // GCC/Clang error pattern: filename:line:column: error: message
  // Example: solution.cpp:10:5: error: 'x' was not declared in this scope
  const errorPattern = /^solution\.cpp:(\d+):(\d+):\s*(error|warning):\s*(.+)$/gm;

  let match;
  while ((match = errorPattern.exec(stderr)) !== null) {
    const [, lineStr, colStr, , message] = match;

    errors.push({
      message: message.trim(),
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
    });
  }

  // If no structured errors found, return the entire output as a single error
  if (errors.length === 0 && stderr.trim()) {
    errors.push({
      message: stderr.trim(),
    });
  }

  return errors;
}

/**
 * Cleans up temporary files for a compilation.
 *
 * @param binaryId - Unique identifier for the compilation to clean up
 */
export async function cleanupCompilation(binaryId: string): Promise<void> {
  // Validate binaryId to prevent path traversal
  if (!isValidBinaryId(binaryId)) {
    logger.warn(`Invalid binaryId format in cleanup attempt: ${binaryId}`);
    return;
  }

  await cleanupTempDirectory(binaryId);
  logger.debug(`Cleaned up compilation: ${binaryId}`);
}

/**
 * Checks if a compiled binary exists.
 *
 * @param binaryId - Unique identifier for the binary
 * @returns True if binary exists and is ready to run
 */
export async function isBinaryReady(binaryId: string): Promise<boolean> {
  // Validate binaryId format
  if (!isValidBinaryId(binaryId)) {
    return false;
  }

  try {
    const binaryPath = getBinaryPath(binaryId);
    const { access } = await import('fs/promises');
    await access(binaryPath);
    return true;
  } catch {
    return false;
  }
}
