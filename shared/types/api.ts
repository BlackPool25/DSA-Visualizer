/**
 * API Request/Response Types
 * 
 * Defines REST API contracts for the DSA Visualizer backend.
 */

import type { FullTrace } from './trace.js';

// ========== Compile ==========

/** Request to compile user code */
export interface CompileRequest {
  /** Source code to compile */
  code: string;
  /** Programming language (only C++ supported for now) */
  language: 'cpp';
}

/** Single compilation error */
export interface CompileError {
  /** Error message */
  message: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
}

/** Response from compile request */
export interface CompileResponse {
  /** Whether compilation succeeded */
  success: boolean;
  /** Compilation errors if failed */
  errors?: CompileError[];
  /** Binary ID for execution (random UUID, not a file path) */
  binaryId?: string;
}

// ========== Run ==========

/** Request to run compiled code */
export interface RunRequest {
  /** Binary ID from compile response */
  binaryId: string;
  /** Standard input for the program */
  stdin: string;
}

/** Response from run request */
export interface RunResponse {
  /** Program stdout */
  stdout: string;
  /** Program stderr */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Whether execution timed out */
  timedOut: boolean;
}

// ========== Trace ==========

/** Request to generate execution trace */
export interface TraceRequest {
  /** Source code to trace */
  code: string;
  /** Standard input for the program */
  stdin: string;
  /** Maximum number of steps to capture */
  maxSteps?: number;
}

/** Successful trace response */
export interface TraceSuccessResponse {
  /** Execution trace data */
  trace: FullTrace;
}

/** Error trace response */
export interface TraceErrorResponse {
  /** Error message */
  error: string;
}

/** Response from trace request */
export type TraceResponse = TraceSuccessResponse | TraceErrorResponse;