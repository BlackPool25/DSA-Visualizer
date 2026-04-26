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
  /** Compiler binary */
  compiler?: "g++" | "clang++";
  /** Additional compiler flags */
  flags?: string[];
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
  /** Compilation duration in milliseconds */
  duration?: number;
}

// ========== Run ==========

/** Request to run compiled code */
export interface RunRequest {
  /** Binary ID from compile response */
  binaryId: string;
  /** Standard input for the program */
  stdin?: string;
}

/** Response from run request */
export interface RunResponse {
  /** Whether execution succeeded */
  success?: boolean;
  /** Program stdout */
  stdout: string;
  /** Program stderr */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Whether execution timed out */
  timedOut?: boolean;
  /** Execution duration in milliseconds */
  duration?: number;
}

// ========== Trace ==========

/** Request to generate execution trace */
export interface TraceRequest {
  /** Source code to trace */
  code: string;
  /** Standard input for the program */
  stdin?: string;
  /** Maximum number of steps to capture */
  maxSteps?: number;
}

/** Successful trace response */
export interface TraceSuccessResponse {
  /** Whether request succeeded */
  success: true;
  /** Execution trace data */
  trace: FullTrace;
  /** Endpoint duration in milliseconds */
  duration?: number;
}

/** Error trace response */
export interface TraceErrorResponse {
  /** Whether request succeeded */
  success: false;
  /** Error message */
  error: string;
  /** Compilation errors if trace failed at compile stage */
  compileErrors?: CompileError[];
  /** Endpoint duration in milliseconds */
  duration?: number;
}

/** Response from trace request */
export type TraceResponse = TraceSuccessResponse | TraceErrorResponse;