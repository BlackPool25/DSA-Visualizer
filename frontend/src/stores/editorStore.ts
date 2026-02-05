/**
 * Editor Store
 *
 * Zustand store for managing editor state including:
 * - Current code in the editor
 * - Selected problem
 * - Test cases
 * - Loading and error states
 * - Code execution actions
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Problem,
  TestCase,
  RunResponse,
  TraceResponse,
} from "../types/index.js";
import {
  compileCode,
  runCode,
  traceCode,
  fetchProblem,
  generateHarness,
} from "../services/api.js";

/** Editor state interface */
interface EditorState {
  // State
  code: string;
  problem: Problem | null;
  testCases: TestCase[];
  isLoading: boolean;
  error: string | null;
  binaryId: string | null;
  runResults: Map<number, RunResponse>;
  traceResult: TraceResponse | null;

  // Actions
  setCode: (code: string) => void;
  setProblem: (problem: Problem | null) => void;
  setTestCases: (testCases: TestCase[]) => void;
  addTestCase: (testCase: TestCase) => void;
  setError: (error: string | null) => void;
  loadProblem: (slug: string) => Promise<void>;
  runTestCase: (index: number) => Promise<void>;
  runAllTestCases: () => Promise<void>;
  traceExecution: (maxSteps?: number) => Promise<void>;
  reset: () => void;
}

/** Default code template for new problems */
const DEFAULT_CODE_TEMPLATE = `// Write your solution here

#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    // Your code here
    return 0;
}`;

/**
 * Parse sample test cases from a LeetCode problem's exampleTestcases field.
 *
 * LeetCode stores example test cases as newline-separated input values.
 * For problems with multiple inputs per test case, each input is on its own line.
 * We try to detect multi-input problems by counting parameters in the code snippet.
 *
 * @param problem - The problem with optional exampleTestcases field
 * @returns Array of TestCase objects parsed from the examples
 */
function parseSampleTestCases(problem: Problem): TestCase[] {
  // Use exampleTestcases if available, otherwise fall back to sampleTestCase
  const testCasesStr = problem.exampleTestcases || problem.sampleTestCase || "";

  if (!testCasesStr.trim()) {
    console.warn("No test cases found for problem:", problem.titleSlug);
    return [];
  }

  // Split by newlines and filter empty lines
  const lines = testCasesStr.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  console.log(`Parsing test cases for ${problem.titleSlug}:`, {
    totalLines: lines.length,
    lines: lines.slice(0, 10), // Show first 10 lines
  });

  // Try to detect number of inputs per test case from the code snippet.
  // Look for function parameters in the C++ code snippet.
  const cppCode =
    problem.codeSnippets?.["cpp"] || problem.codeSnippets?.["c++"] || "";
  const paramCount = detectParameterCount(cppCode);

  console.log(`Detected ${paramCount} parameters for ${problem.titleSlug}`);

  // Extract expected outputs from problem content HTML if available
  const expectedOutputs = extractExpectedOutputsFromContent(problem.content);

  const testCases: TestCase[] = [];

  console.log(
    `Grouping test cases - paramCount: ${paramCount}, lines: ${lines.length}`,
  );

  if (paramCount > 1 && lines.length >= paramCount) {
    // Multi-input problem: group lines by parameter count
    let testCaseIndex = 0;
    for (let i = 0; i + paramCount <= lines.length; i += paramCount) {
      const input = lines.slice(i, i + paramCount).join("\n");
      console.log(
        `Creating test case ${testCaseIndex + 1} with ${paramCount} parameters:`,
        input,
      );
      testCases.push({
        input,
        expectedOutput: expectedOutputs[testCaseIndex] || "",
        isCustom: false,
      });
      testCaseIndex++;
    }
  } else {
    // Single-input problem or fallback: each line is a separate test case
    console.log("Creating individual test cases (single parameter)");
    for (let idx = 0; idx < lines.length; idx++) {
      testCases.push({
        input: lines[idx],
        expectedOutput: expectedOutputs[idx] || "",
        isCustom: false,
      });
    }
  }

  console.log(`Parsed ${testCases.length} test cases for ${problem.titleSlug}`);
  return testCases;
}

/**
 * Extract expected outputs from problem content HTML.
 * LeetCode includes expected outputs in example sections of the problem description.
 *
 * @param content - HTML content of the problem
 * @returns Array of expected output strings
 */
function extractExpectedOutputsFromContent(content: string): string[] {
  if (!content) return [];

  const outputs: string[] = [];

  // Look for patterns like "Output: [0,1]" or "Output: 2" in the HTML
  // LeetCode typically uses <strong>Output:</strong> followed by the value
  const outputRegex = /<strong>Output:<\/strong>\s*([^\n<]+)/gi;
  let match;

  while ((match = outputRegex.exec(content)) !== null) {
    const output = match[1].trim();
    outputs.push(output);
  }

  return outputs;
}

/**
 * Detect the number of parameters in a C++ function signature.
 * Used to determine how many input lines constitute one test case.
 *
 * @param code - C++ code snippet with function signature
 * @returns Number of parameters detected (minimum 1)
 */
function detectParameterCount(code: string): number {
  console.log("=== Detecting parameter count ===");
  console.log("Code snippet:", code.substring(0, 200));

  // First, try to find the function signature directly
  // Pattern: returnType functionName(params)
  // This handles cases like: vector<int> twoSum(vector<int>& nums, int target)
  const directMatch = code.match(
    /(\w+(?:<[^>]+>)?(?:\s*\*)?)\s+(\w+)\s*\(([^)]*)\)/,
  );

  if (directMatch && directMatch[3] !== undefined) {
    const paramsStr = directMatch[3].trim();
    console.log("Found function signature directly:", directMatch[0]);
    console.log("Parameters string:", paramsStr);

    if (!paramsStr) {
      console.log("No parameters detected");
      return 0;
    }

    // Count commas to determine parameter count
    // Handle nested angle brackets in templates like vector<int>
    let depth = 0;
    let commaCount = 0;

    for (const char of paramsStr) {
      if (char === "<") depth++;
      else if (char === ">") depth--;
      else if (char === "," && depth === 0) commaCount++;
    }

    const paramCount = commaCount + 1;
    console.log(`Detected ${paramCount} parameters`);
    return paramCount;
  }

  console.warn("Could not parse function signature, defaulting to 1 parameter");
  return 1;
}

/**
 * Extract parameter names from C++ function signature for display.
 * Returns parameter names like ["nums", "target"] for better UI labeling.
 *
 * @param code - C++ code snippet with function signature
 * @returns Array of parameter names
 */
export function extractParameterNames(code: string): string[] {
  // Look for the Solution class and its public method
  const classMatch = code.match(
    /class\s+Solution\s*\{[^}]*public:\s*([^}]+)\}/s,
  );

  if (!classMatch) {
    return [];
  }

  const publicSection = classMatch[1];
  const funcMatch = publicSection.match(/\w+\s+\w+\s*\(([^)]*)\)/);

  if (!funcMatch || !funcMatch[1]) {
    return [];
  }

  const paramsStr = funcMatch[1].trim();
  if (!paramsStr) {
    return [];
  }

  // Split parameters respecting template brackets
  const params: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of paramsStr) {
    if (char === "<") {
      depth++;
      current += char;
    } else if (char === ">") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      params.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  // Extract just the parameter name (last word) from each parameter
  // e.g., "vector<int>& nums" -> "nums"
  return params.map((param) => {
    const words = param.trim().split(/\s+/);
    return words[words.length - 1].replace(/[&*]/g, ""); // Remove & and *
  });
}
/**
 * Format test case input into a JSON array string for harness generation.
 * Handles both single-line and multi-line inputs (multi-parameter problems).
 *
 * @param input - Test case input (single line or newline-separated parameters)
 * @returns JSON array string like "[param1, param2, ...]"
 *
 * @example
 * formatTestInput('[2,7,11,15]') => '[[2,7,11,15]]'
 * formatTestInput('[2,7,11,15]\n9') => '[[2,7,11,15], 9]'
 */
function formatTestInput(input: string): string {
  if (!input.includes("\n")) {
    // Single parameter: wrap in array
    return `[${input}]`;
  }

  // Multiple parameters: split by newline and create array
  const params = input
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p);
  return `[${params.join(", ")}]`;
}

/**
 * Zustand store for editor state management with persistence
 *
 * Only persists user preferences and problem selection.
 * Runtime state (loading, errors, results) is not persisted.
 */
export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      code: DEFAULT_CODE_TEMPLATE,
      problem: null,
      testCases: [],
      isLoading: false,
      error: null,
      binaryId: null,
      runResults: new Map(),
      traceResult: null,

      // Actions

      /**
       * Set the code in the editor.
       * Guards against undefined/empty values to prevent accidental code clearing.
       * This fixes a bug where the Run button could inadvertently reset the code.
       */
      setCode: (code) => {
        // Only update if we receive a valid non-empty string
        // This prevents accidental code clearing from re-renders or Monaco events
        if (code !== undefined && code !== null) {
          set({ code });
        }
      },

      setProblem: (problem) => set({ problem }),

      setTestCases: (testCases) => set({ testCases }),

      addTestCase: (testCase) =>
        set((state) => ({
          testCases: [...state.testCases, testCase],
        })),

      setError: (error) => set({ error }),

      /**
       * Load a problem by slug and set up initial state.
       * Automatically parses sample test cases from the problem's exampleTestcases field.
       */
      loadProblem: async (slug) => {
        set({ isLoading: true, error: null });

        try {
          const problem = await fetchProblem(slug);

          // Get C++ code snippet from the Record (map)
          const codeTemplate =
            problem.codeSnippets?.["cpp"] ||
            problem.codeSnippets?.["c++"] ||
            DEFAULT_CODE_TEMPLATE;

          // Parse sample test cases from the problem's exampleTestcases field.
          // LeetCode provides test cases as newline-separated input values.
          // For problems with multiple inputs per test case, they're separated by newlines.
          const sampleTestCases = parseSampleTestCases(problem);

          set({
            problem,
            code: codeTemplate,
            testCases: sampleTestCases,
            binaryId: null,
            runResults: new Map(),
            traceResult: null,
            isLoading: false,
          });
        } catch (err) {
          set({
            error:
              err instanceof Error ? err.message : "Failed to load problem",
            isLoading: false,
          });
        }
      },

      /**
       * Compile and run a single test case.
       * This function implements the LeetCode-style execution flow:
       * 1. Generate harness from user's Solution class
       * 2. Compile the complete harnessed code
       * 3. Run with test input
       */
      runTestCase: async (index) => {
        const { code, testCases, problem } = get();
        const testCase = testCases[index];

        if (!testCase) return;
        if (!problem) {
          set({ error: "No problem selected" });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Step 1: Generate harness from Solution class
          // This wraps the user's code with main(), includes, deserializers, etc.
          // Format multi-line inputs as proper JSON array: [[2,7,11,15], 9]
          const testInput = formatTestInput(testCase.input);

          const harnessResult = await generateHarness(
            problem.titleSlug,
            code,
            testInput,
          );

          // Step 2: Compile the complete harnessed code
          const compileResult = await compileCode(harnessResult.harnessedCode);

          if (!compileResult.success || !compileResult.binaryId) {
            set({
              error:
                compileResult.errors?.map((e) => e.message).join("\n") ||
                "Compilation failed",
              isLoading: false,
            });
            return;
          }

          // Step 3: Run with test case input
          const runResult = await runCode(
            compileResult.binaryId,
            testCase.input,
          );

          set((state) => {
            const newResults = new Map(state.runResults);
            newResults.set(index, runResult);
            return { runResults: newResults, isLoading: false };
          });
        } catch (err) {
          set({
            error:
              err instanceof Error ? err.message : "Failed to run test case",
            isLoading: false,
          });
        }
      },

      /**
       * Compile once and run all test cases.
       * Uses LeetCode-style execution: generates harness, compiles, then runs all tests.
       */
      runAllTestCases: async () => {
        const { code, testCases, problem } = get();

        if (testCases.length === 0) {
          set({ error: "No test cases to run" });
          return;
        }

        if (!problem) {
          set({ error: "No problem selected" });
          return;
        }

        set({ isLoading: true, error: null });

        try {
          // Step 1: Generate harness from Solution class with first test case
          // Format multi-line inputs as proper JSON array
          const firstTestInput = formatTestInput(testCases[0].input);
          const harnessResult = await generateHarness(
            problem.titleSlug,
            code,
            firstTestInput,
          );

          // Step 2: Compile the harnessed code once
          const compileResult = await compileCode(harnessResult.harnessedCode);

          if (!compileResult.success || !compileResult.binaryId) {
            set({
              error:
                compileResult.errors?.map((e) => e.message).join("\n") ||
                "Compilation failed",
              isLoading: false,
            });
            return;
          }

          // Step 3: Run all test cases with the compiled binary
          const newResults = new Map<number, RunResponse>();

          for (let i = 0; i < testCases.length; i++) {
            const runResult = await runCode(
              compileResult.binaryId,
              testCases[i].input,
            );
            newResults.set(i, runResult);
          }

          set({
            runResults: newResults,
            binaryId: compileResult.binaryId,
            isLoading: false,
          });
        } catch (err) {
          set({
            error:
              err instanceof Error ? err.message : "Failed to run test cases",
            isLoading: false,
          });
        }
      },

      /**
       * Generate execution trace for the current code.
       * Uses LeetCode-style execution: generates harness, then traces with GDB.
       */
      traceExecution: async (maxSteps = 1000) => {
        const { code, testCases, problem } = get();

        if (!problem) {
          set({ error: "No problem selected" });
          return;
        }

        // Use first test case input or empty string
        const stdin = testCases[0]?.input || "";

        set({ isLoading: true, error: null, traceResult: null });

        try {
          // Step 1: Generate harness from Solution class
          // Format multi-line inputs as proper JSON array
          const testInput = formatTestInput(stdin);
          const harnessResult = await generateHarness(
            problem.titleSlug,
            code,
            testInput,
          );

          // Step 2: Generate trace with harnessed code
          const traceResult = await traceCode(
            harnessResult.harnessedCode,
            stdin,
            maxSteps,
          );
          set({ traceResult, isLoading: false });
        } catch (err) {
          set({
            error:
              err instanceof Error ? err.message : "Failed to generate trace",
            isLoading: false,
          });
        }
      },

      /**
       * Reset store to initial state
       */
      reset: () =>
        set({
          code: DEFAULT_CODE_TEMPLATE,
          problem: null,
          testCases: [],
          isLoading: false,
          error: null,
          binaryId: null,
          runResults: new Map(),
          traceResult: null,
        }),
    }),
    {
      name: "dsa-visualizer-storage",
      // Only persist user preferences, not runtime state
      partialize: (state) => ({
        code: state.code,
        problem: state.problem,
        testCases: state.testCases,
      }),
    },
  ),
);
