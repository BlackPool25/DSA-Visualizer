/**
 * App.tsx — Root component. Wires stores, API calls, and layout.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Header: title + Run button                         │
 *   ├──────────────────────┬──────────────────────────────┤
 *   │  Left: CodeEditor    │  Right: CFG (TraceFlow)      │
 *   │        InputPanel    │         StatePanel           │
 *   ├──────────────────────┴──────────────────────────────┤
 *   │  Bottom: TraceScrubber                              │
 *   └─────────────────────────────────────────────────────┘
 *
 * User flow:
 *   1. User writes code + optional raw input.
 *   2. Clicks "Analyze" → POST /analyze → shows cleaned stdin for confirmation.
 *   3. User confirms → POST /execute → loads trace + CFG.
 *   4. User scrubs through the trace.
 */

import { useCFGStore } from "./store/cfgStore";
import { useTraceStore } from "./store/traceStore";
import { useUIStore } from "./store/uiStore";
import { api } from "./utils/api";
import { CodeEditor } from "./components/Editor/CodeEditor";
import { InputPanel } from "./components/Editor/InputPanel";
import { TraceScrubber } from "./components/Scrubber/TraceScrubber";
import { StatePanel } from "./components/StatePanel/StatePanel";
import { TraceFlow } from "./components/FlowChart/TraceFlow";

export default function App() {
  const { code, rawInput, cleanedStdin, structSchema, status, errorMessage, stdout, compileError } = useUIStore();
  const { setAnalyzeResult, setExecuteResult, setStatus, setError, reset } = useUIStore();
  const loadTrace = useTraceStore((s) => s.loadTrace);
  const loadCFG = useCFGStore((s) => s.loadCFG);

  async function handleAnalyze() {
    setStatus("analyzing");
    try {
      const result = await api.analyze({ code, raw_input: rawInput });
      setAnalyzeResult(result.cleaned_stdin, result.stdin_preview, result.struct_schema);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleExecute() {
    if (!structSchema) return;
    setStatus("executing");
    try {
      const result = await api.execute({
        code,
        cleaned_stdin: cleanedStdin ?? "",
        struct_schema: structSchema,
      });
      if (result.compile_error) {
        setExecuteResult("", result.compile_error);
        return;
      }
      loadTrace(result.trace);
      loadCFG(result.cfg_nodes, result.cfg_edges);
      setExecuteResult(result.stdout, null);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleConfirm() {
    handleExecute();
  }

  function handleEdit() {
    setStatus("idle");
  }

  const isLoading = status === "analyzing" || status === "executing";

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-zinc-100">DSA Visualiser</h1>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">C++ · libclang</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "done" && (
            <button
              onClick={() => { reset(); useTraceStore.getState().reset(); useCFGStore.getState().reset(); }}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || status === "confirming"}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded px-4 py-1.5 transition-colors"
          >
            {status === "analyzing" ? "Analyzing…" : status === "executing" ? "Running…" : "Analyze & Run"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: editor + input */}
        <div className="flex flex-col w-[45%] border-r border-zinc-800">
          <div className="flex-1 overflow-hidden">
            <CodeEditor />
          </div>
          <div className="h-[180px] border-t border-zinc-800 p-3">
            <InputPanel onConfirm={handleConfirm} onEdit={handleEdit} />
          </div>
        </div>

        {/* Right panel: CFG + state */}
        <div className="flex flex-1 overflow-hidden">
          {/* CFG */}
          <div className="flex-1 overflow-hidden">
            <TraceFlow />
          </div>
          {/* State panel */}
          <div className="w-[260px] border-l border-zinc-800 overflow-hidden">
            <StatePanel />
          </div>
        </div>
      </div>

      {/* Error / compile error banner */}
      {(errorMessage || compileError) && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800 text-xs text-red-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
          {compileError || errorMessage}
        </div>
      )}

      {/* Stdout banner */}
      {stdout && status === "done" && (
        <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-300 font-mono">
          <span className="text-zinc-500 mr-2">stdout:</span>{stdout.trim()}
        </div>
      )}

      {/* Scrubber */}
      <TraceScrubber />
    </div>
  );
}
