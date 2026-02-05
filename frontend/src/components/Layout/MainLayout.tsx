/**
 * MainLayout Component
 *
 * Split-pane layout for the DSA Visualizer:
 * - Left panel: Problem picker, description, test cases
 * - Right panel: Monaco code editor with line highlighting
 * - Bottom: Trace visualization with Python Tutor-style display
 */

import { useState, useCallback } from "react";
import { Play, Activity, RotateCcw } from "lucide-react";
import { CodeEditor } from "../Editor/CodeEditor.js";
import { ProblemPicker } from "../Problem/ProblemPicker.js";
import { TestCases } from "../Problem/TestCases.js";
import { TracePlayback } from "../Visualizer/TracePlayback.js";
import { useEditorStore } from "../../stores/editorStore.js";

/**
 * MainLayout component with split-pane design
 *
 * Layout structure:
 * - Top bar with problem picker and action buttons
 * - Left column: Problem description and test cases
 * - Right column: Code editor with trace visualization
 * - Status bar at bottom
 */
export function MainLayout() {
  // Track the current line for editor highlighting during trace playback
  const [highlightLine, setHighlightLine] = useState<number | undefined>(
    undefined,
  );

  const {
    code,
    setCode,
    problem,
    isLoading,
    error,
    traceResult,
    runAllTestCases,
    traceExecution,
    reset,
  } = useEditorStore();

  // Handle line changes from trace playback
  const handleLineChange = useCallback((line: number) => {
    setHighlightLine(line);
  }, []);

  // Clear highlight when not tracing
  const handleReset = useCallback(() => {
    setHighlightLine(undefined);
    reset();
  }, [reset]);

  // Check if we have a valid trace to display
  const hasValidTrace =
    traceResult &&
    !("error" in traceResult) &&
    traceResult.trace?.steps?.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">DSA Visualizer</h1>
            <div className="w-px h-6 bg-gray-300" />
            <div className="w-80">
              <ProblemPicker />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>

            <button
              onClick={() => {
                setHighlightLine(undefined);
                traceExecution(100);
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Activity className="w-4 h-4" />
              Trace
            </button>

            <button
              onClick={() => runAllTestCases()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              Run
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left panel - Problem & Test Cases */}
        <div className="w-[45%] min-w-[400px] max-w-[600px] flex flex-col border-r border-gray-200 bg-white">
          {/* Problem description - Enhanced with LeetCode-style formatting */}
          <div className="flex-1 overflow-auto p-6">
            {problem ? (
              <div className="space-y-4">
                {/* Problem title with number and difficulty badge */}
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {problem.id}. {problem.title}
                  </h2>
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-full ${
                      problem.difficulty === "Easy"
                        ? "bg-green-100 text-green-800"
                        : problem.difficulty === "Medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {problem.difficulty}
                  </span>
                </div>

                {/* Topic tags */}
                <div className="flex flex-wrap gap-2">
                  {problem.topicTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Problem content with enhanced prose styling */}
                {/* The HTML includes examples, constraints, and problem description */}
                <div
                  className="prose prose-sm max-w-none mt-6"
                  dangerouslySetInnerHTML={{ __html: problem.content }}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">
                    Select a problem to get started
                  </p>
                  <p className="text-sm">
                    Use the problem picker above to choose a coding challenge
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Test cases panel */}
          <div className="h-[40%] min-h-[250px] border-t border-gray-200">
            <TestCases />
          </div>
        </div>

        {/* Right panel - Editor + Visualization */}
        <div className="flex-1 flex flex-col bg-gray-900">
          {/* Code editor with line highlighting */}
          <div
            className={`${hasValidTrace ? "h-[50%]" : "flex-1"} p-4 transition-all duration-300`}
          >
            <CodeEditor
              value={code}
              onChange={setCode}
              language="cpp"
              highlightLine={highlightLine}
            />
          </div>

          {/* Trace visualization panel */}
          {traceResult && (
            <div className="flex-1 min-h-[300px] border-t border-gray-700">
              {"error" in traceResult ? (
                <div className="h-full flex items-center justify-center bg-gray-800">
                  <div className="text-center p-6">
                    <div className="text-red-400 text-lg font-medium mb-2">
                      Trace Error
                    </div>
                    <div className="text-red-300 text-sm max-w-md">
                      {traceResult.error}
                    </div>
                  </div>
                </div>
              ) : (
                <TracePlayback
                  trace={traceResult.trace}
                  onLineChange={handleLineChange}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Status bar */}
      <footer className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {isLoading && (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Processing...
              </span>
            )}

            {error && <span className="text-red-600">Error: {error}</span>}

            {!isLoading && !error && problem && (
              <span>
                Problem #{problem.id} • {problem.titleSlug}
              </span>
            )}

            {highlightLine && (
              <span className="text-blue-600">• Line {highlightLine}</span>
            )}
          </div>

          <div className="text-sm text-gray-500">DSA Visualizer v1.0</div>
        </div>
      </footer>
    </div>
  );
}
