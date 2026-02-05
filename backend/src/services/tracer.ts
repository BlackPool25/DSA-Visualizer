/**
 * @file tracer.ts
 * @description GDB trace orchestration service that captures step-by-step
 * execution traces of C++ programs. Compiles code, runs it under GDB with
 * a Python collector script, and parses the resulting trace data.
 *
 * This service depends on:
 * - compiler.ts: For compiling code before tracing
 * - executor/scripts/trace_collector.py: GDB Python script (created by Agent 3)
 *
 * The trace captures:
 * - Line-by-line execution flow
 * - Variable values at each step
 * - Call stack information
 * - Memory state for data structures
 */

import { z } from "zod";
import { config } from "../config.js";
import { logger, logTrace } from "../utils/logger.js";
import {
  cleanupTempDirectory,
  getBinaryPath,
  isValidBinaryId,
} from "../utils/tempFiles.js";
import { compileCode } from "./compiler.js";
import { runInContainer } from "./docker.js";

/**
 * Zod schema for a call stack frame (matches GDB Python output).
 */
const CallStackFrameSchema = z
  .object({
    frameId: z.string().optional(),
    function: z.string(),
    file: z.string(),
    line: z.number().int().positive(),
    locals: z.record(z.unknown()).optional(),
  })
  .passthrough();

/**
 * Zod schema for validating trace step data.
 * Matches the format output by Agent 3's GDB trace_collector.py script.
 */
const TraceStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  file: z.string(),
  event: z.string(),
  callStack: z.array(CallStackFrameSchema),
  heap: z.record(z.unknown()).optional(),
  stdout: z.string(),
});

/**
 * Zod schema for validating full trace data.
 */
const FullTraceSchema = z.object({
  steps: z.array(TraceStepSchema),
  totalSteps: z.number().int().nonnegative(),
  executionTime: z.number().nonnegative(),
});

/**
 * Call stack frame structure.
 */
export interface CallStackFrame {
  /** Unique frame identifier */
  frameId?: string;

  /** Function name */
  function: string;

  /** Source file */
  file: string;

  /** Line number */
  line: number;

  /** Local variables in this frame */
  locals?: Record<string, unknown>;
}

/**
 * Single step in an execution trace.
 * Matches the format output by Agent 3's GDB trace_collector.py script.
 */
export interface TraceStep {
  /** Step index in the trace */
  stepIndex: number;

  /** Line number being executed */
  line: number;

  /** Source file */
  file: string;

  /** Type of event (line, breakpoint, etc.) */
  event: string;

  /** Call stack at this step (array of frame objects) */
  callStack: CallStackFrame[];

  /** Heap memory state (if any) */
  heap?: Record<string, unknown>;

  /** Stdout captured at this step */
  stdout: string;
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
 * Result of a trace operation.
 */
export interface TraceResult {
  /** Whether tracing succeeded */
  success: boolean;

  /** The execution trace (only on success) */
  trace?: FullTrace;

  /** Error message (only on failure) */
  error?: string;

  /** Compilation errors if compilation failed */
  compileErrors?: Array<{ message: string; line?: number; column?: number }>;

  /** Trace generation duration in milliseconds */
  duration: number;
}

/**
 * Options for trace generation.
 */
export interface TraceOptions {
  /** Input to provide to the program */
  stdin?: string;

  /** Maximum number of steps to capture */
  maxSteps?: number;

  /** Timeout for trace generation in milliseconds */
  timeoutMs?: number;
}

/**
 * Generates an execution trace for C++ code.
 * This involves compiling the code, running it under GDB with a Python
 * trace collector script, and parsing the resulting JSON trace data.
 *
 * @param code - The C++ source code to trace
 * @param options - Trace options (stdin, maxSteps, timeout)
 * @returns TraceResult with success status and trace data or error details
 *
 * @example
 * const result = await traceExecution(code, { stdin: '5\n', maxSteps: 100 });
 * if (result.success) {
 *   console.log(`Captured ${result.trace?.totalSteps} steps`);
 * }
 */
export async function traceExecution(
  code: string,
  options: TraceOptions = {},
): Promise<TraceResult> {
  const startTime = Date.now();
  const maxSteps = options.maxSteps || config.MAX_TRACE_STEPS;

  try {
    // Step 1: Compile the code
    logger.debug("Starting trace execution - compiling code");
    const compileResult = await compileCode(code);

    if (!compileResult.success || !compileResult.binaryId) {
      return {
        success: false,
        error: "Compilation failed",
        compileErrors: compileResult.errors,
        duration: Date.now() - startTime,
      };
    }

    const binaryId = compileResult.binaryId;

    try {
      // Step 2: Run the binary under GDB with trace collector
      logger.debug("Running GDB trace collection", { binaryId, maxSteps });
      const traceResult = await runTraceCollection(binaryId, maxSteps, options);

      const duration = Date.now() - startTime;

      if (traceResult.success && traceResult.trace) {
        logTrace(binaryId, traceResult.trace.totalSteps, duration);

        return {
          success: true,
          trace: traceResult.trace,
          duration,
        };
      } else {
        return {
          success: false,
          error: traceResult.error || "Trace collection failed",
          duration,
        };
      }
    } finally {
      // Step 3: Cleanup
      await cleanupTempDirectory(binaryId);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Trace execution failed", { error });

    return {
      success: false,
      error: `Trace execution failed: ${error}`,
      duration,
    };
  }
}

/**
 * Runs the binary under GDB with the trace collector script.
 *
 * @param binaryId - ID of the compiled binary
 * @param maxSteps - Maximum steps to capture
 * @param options - Trace options
 * @returns Object with success status and trace data
 */
async function runTraceCollection(
  binaryId: string,
  maxSteps: number,
  options: TraceOptions,
): Promise<{ success: boolean; trace?: FullTrace; error?: string }> {
  const binaryPath = getBinaryPath(binaryId);
  const binaryDir = binaryPath.substring(0, binaryPath.lastIndexOf("/"));

  // Build GDB command with trace collector script
  // Using -batch mode to automatically exit after script completes
  // The trace collector script controls GDB execution via gdb.execute()
  const gdbCommand = [
    "gdb",
    "-batch", // Exit after script completes
    "-silent", // Suppress copyright message
    "-x",
    "/scripts/trace_collector.py", // Execute trace collector script
    "--args",
    "/workspace/solution", // The binary to debug
  ];

  // Set environment variables for the trace collector
  // TRACE_MAX_STEPS and TRACE_OUTPUT are read by trace_collector.py
  const env = [
    `TRACE_MAX_STEPS=${maxSteps}`,
    `TRACE_OUTPUT=/workspace/trace.json`,
  ];

  // Write input file if stdin provided
  // The trace collector reads stdin from STDIN_INPUT_FILE
  if (options.stdin) {
    const { writeFile } = await import("fs/promises");
    const path = await import("path");
    const inputPath = path.join(binaryDir, "input.txt");
    await writeFile(inputPath, options.stdin);
    env.push(`STDIN_INPUT_FILE=/workspace/input.txt`);
  }

  try {
    const result = await runInContainer(gdbCommand, {
      workingDir: "/workspace",
      binds: [
        `${binaryDir}:/workspace`,
        // Note: The executor image should have trace_collector.py in /scripts
      ],
      env,
      timeoutMs: options.timeoutMs || config.MAX_COMPILE_TIMEOUT_MS,
    });

    // Check if GDB execution succeeded
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `GDB execution failed (exit code ${result.exitCode}): ${result.stderr}`,
      };
    }

    // Read and parse the trace output
    const traceJson = await readTraceOutput(binaryId);
    if (!traceJson) {
      return {
        success: false,
        error: "No trace output generated",
      };
    }

    // Validate and parse the trace
    const trace = await validateTrace(traceJson);
    if (!trace) {
      return {
        success: false,
        error: "Invalid trace format",
      };
    }

    return {
      success: true,
      trace,
    };
  } catch (error) {
    return {
      success: false,
      error: `Trace collection error: ${error}`,
    };
  }
}

/**
 * Reads the trace output file generated by the GDB collector script.
 *
 * @param binaryId - ID of the binary that was traced
 * @returns Raw trace JSON string or null if not found
 */
async function readTraceOutput(binaryId: string): Promise<string | null> {
  if (!isValidBinaryId(binaryId)) {
    return null;
  }

  try {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    // Get the directory containing the binary (not the binary file itself)
    const binaryDir = path.dirname(getBinaryPath(binaryId));
    const tracePath = path.join(binaryDir, "trace.json");
    const content = await readFile(tracePath, "utf8");
    return content;
  } catch {
    return null;
  }
}

/**
 * Validates and parses raw trace JSON data using Zod schema validation.
 *
 * @param rawTrace - Raw trace JSON string
 * @returns Parsed and validated FullTrace or null if invalid
 */
export function validateTrace(rawTrace: string): FullTrace | null {
  try {
    const parsed = JSON.parse(rawTrace);
    const validated = FullTraceSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    } else {
      logger.warn("Trace validation failed", {
        errors: validated.error.errors,
      });
      return null;
    }
  } catch (error) {
    logger.error("Failed to parse trace JSON", { error });
    return null;
  }
}
