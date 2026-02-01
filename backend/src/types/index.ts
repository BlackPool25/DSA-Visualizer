/**
 * @file types/index.ts
 * @description Type definitions for the backend API.
 * Re-exports shared types and defines backend-specific types.
 *
 * Note: This file serves as a central location for type definitions.
 * When the shared package (@dsa-visualizer/shared) is fully set up,
 * types should be imported from there instead of defined here.
 */

/**
 * Compilation error with location information.
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
 * Single step in an execution trace.
 */
export interface TraceStep {
  /** Line number being executed */
  line: number;

  /** Variable values at this step */
  variables: Record<string, unknown>;

  /** Call stack at this step (optional) */
  callStack?: string[];

  /** Memory state for data structures (optional) */
  memory?: Record<string, unknown>;
}

/**
 * Complete execution trace.
 */
export interface FullTrace {
  /** All trace steps */
  steps: TraceStep[];

  /** Total number of steps captured */
  totalSteps: number;

  /** Total execution time in milliseconds */
  executionTime: number;
}

/**
 * Compile request body.
 */
export interface CompileRequest {
  /** C++ source code to compile */
  code: string;

  /** Compiler to use (default: 'g++') */
  compiler?: 'g++' | 'clang++';

  /** Additional compiler flags */
  flags?: string[];
}

/**
 * Compile response.
 */
export interface CompileResponse {
  /** Whether compilation succeeded */
  success: boolean;

  /** Binary ID on success */
  binaryId?: string;

  /** Compilation errors on failure */
  errors?: CompileError[];

  /** Compiler output (warnings, etc.) */
  output?: string;

  /** Compilation duration in milliseconds */
  duration: number;
}

/**
 * Run request body.
 */
export interface RunRequest {
  /** Binary ID to execute */
  binaryId: string;

  /** Input to provide via stdin */
  stdin?: string;
}

/**
 * Run response.
 */
export interface RunResponse {
  /** Whether execution succeeded (exit code 0) */
  success: boolean;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Process exit code */
  exitCode: number;

  /** Execution duration in milliseconds */
  duration: number;

  /** Whether execution timed out */
  timedOut: boolean;

  /** Error message if execution failed */
  error?: string;
}

/**
 * Trace request body.
 */
export interface TraceRequest {
  /** C++ source code to trace */
  code: string;

  /** Input to provide to the program */
  stdin?: string;

  /** Maximum number of steps to capture */
  maxSteps?: number;
}

/**
 * Trace response.
 */
export interface TraceResponse {
  /** Whether trace generation succeeded */
  success: boolean;

  /** Execution trace on success */
  trace?: FullTrace;

  /** Error message on failure */
  error?: string;

  /** Compilation errors if compilation failed */
  compileErrors?: CompileError[];

  /** Trace generation duration in milliseconds */
  duration: number;
}
