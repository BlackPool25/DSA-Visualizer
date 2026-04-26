/**
 * MainLayout Component
 *
 * Split-pane layout for the DSA Visualizer:
 * - Left panel: Problem picker, description, test cases
 * - Right panel: Monaco code editor with line highlighting
 * - Bottom: Trace visualization with Python Tutor-style display
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Settings, Waypoints } from "lucide-react";
import { compileCode, runCode, traceCode, ApiError } from "../../services/api.js";
import { useEditorStore } from "../../stores/editorStore.js";
import type { CompileError } from "../../types/index.js";
import { CodeEditor } from "../Editor/CodeEditor.js";
import { TracePlayback } from "../Visualizer/TracePlayback.js";

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
  const [leftPct, setLeftPct] = useState(50);
  const [editorPct, setEditorPct] = useState(70);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState({
    backendUrl: "",
    maxSteps: 1000,
    autoPlaySpeed: 1 as 0.5 | 1 | 2 | 4,
    theme: "dark" as "dark" | "light",
  });
  const [toast, setToast] = useState<{ message: string; retry?: () => void } | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<"run" | "trace" | null>(null);
  const [focusedErrorLine, setFocusedErrorLine] = useState<number | null>(null);
  const dragRef = useRef<"vertical" | "horizontal" | null>(null);

  const store = useEditorStore();

  const markers = useMemo(
    () =>
      store.compileErrors.map((err) => ({
        line: err.line,
        message: err.message,
        severity: "error" as const,
      })),
    [store.compileErrors],
  );

  useEffect(() => {
    if (retryIn === null || retryIn <= 0) return;
    const timer = window.setInterval(() => {
      setRetryIn((value) => (value && value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryIn]);

  function handleApiError(error: unknown): void {
    const message = error instanceof Error ? error.message : "Request failed";
    store.setStatus("error", `✗ ${message}`);
    const retry =
      lastAction === "run"
        ? () => void runProgram()
        : lastAction === "trace"
          ? () => void traceProgram()
          : undefined;
    if (error instanceof ApiError && error.status === 429) {
      const seconds = error.retryAfter ?? 30;
      setRetryIn(seconds);
      setToast({ message: `Rate limited — retry in ${seconds}s`, retry });
      return;
    }
    setToast({ message, retry });
  }

  async function runProgram(): Promise<void> {
    setLastAction("run");
    store.setStatus("compiling", "⟳ Compiling...");
    store.setCompileErrors([]);
    store.setRunOutput(null);
    try {
      const compile = await compileCode(store.backendUrl, { code: store.code });
      if (!compile.success || !compile.binaryId) {
        const errors = compile.errors ?? [];
        store.setCompileErrors(errors);
        store.setStatus("error", "✗ Compilation failed");
        return;
      }

      store.setStatus("running", "⟳ Running...");
      const run = await runCode(store.backendUrl, { binaryId: compile.binaryId, stdin: store.stdin });
      store.setRunOutput({ stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode });
      const duration = run.duration ?? compile.duration;
      const durationText = duration !== undefined ? `${duration.toFixed(0)}ms` : "done";
      store.setStatus("done", `✓ Compiled and ran in ${durationText}`);
      setToast({ message: `Exit code ${run.exitCode}` });
    } catch (error) {
      handleApiError(error);
    }
  }

  async function traceProgram(): Promise<void> {
    setLastAction("trace");
    store.setStatus("tracing", "⟳ Tracing...");
    store.setCompileErrors([]);
    try {
      const traceResponse = await traceCode(store.backendUrl, {
        code: store.code,
        stdin: store.stdin,
        maxSteps: store.maxSteps,
      });

      if (!traceResponse.success) {
        store.setCompileErrors(traceResponse.compileErrors ?? []);
        store.setTrace({
          steps: [],
          totalSteps: 0,
          executionTime: 0,
          error: traceResponse.error,
        });
        store.setStatus("error", `✗ ${traceResponse.error}`);
        return;
      }
      store.setTrace(traceResponse.trace);
      store.setStep(0);
      store.setPlaying(false);
      const durationText = traceResponse.duration ? `${traceResponse.duration.toFixed(0)}ms` : "ready";
      store.setStatus("done", `✓ Trace ${durationText}`);
    } catch (error) {
      handleApiError(error);
    }
  }

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (dragRef.current === "vertical") {
        setLeftPct(Math.min(75, Math.max(25, (event.clientX / window.innerWidth) * 100)));
      }
      if (dragRef.current === "horizontal") {
        const usableHeight = window.innerHeight - 120;
        setEditorPct(Math.min(85, Math.max(45, ((event.clientY - 56) / usableHeight) * 100)));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!store.trace || store.trace.steps.length === 0) return;
      if (event.key === "ArrowLeft") store.setStep(Math.max(0, store.currentStep - 1));
      if (event.key === "ArrowRight")
        store.setStep(Math.min(store.trace.steps.length - 1, store.currentStep + 1));
      if (event.code === "Space") {
        event.preventDefault();
        store.setPlaying(!store.isPlaying);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const openSettings = () => {
    setTempSettings({
      backendUrl: store.backendUrl,
      maxSteps: store.maxSteps,
      autoPlaySpeed: store.autoPlaySpeed,
      theme: store.theme,
    });
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    store.setSettings(tempSettings);
    store.setPlaySpeed(tempSettings.autoPlaySpeed);
    setSettingsOpen(false);
  };

  return (
    <div className="h-screen min-w-[1200px] overflow-hidden bg-[#1e1e1e] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-zinc-700 bg-[#252526] px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">DSA Visualizer</h1>
          <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300">C++ · GDB</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openSettings} className="rounded border border-zinc-600 p-2 hover:bg-zinc-700">
            <Settings size={16} />
          </button>
          <button
            type="button"
            onClick={runProgram}
            disabled={store.status === "compiling" || store.status === "running"}
            className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-70"
          >
            {store.status === "compiling" || store.status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run
          </button>
          <button
            type="button"
            onClick={traceProgram}
            disabled={store.status === "tracing"}
            className="flex items-center gap-2 rounded bg-[#007acc] px-3 py-1.5 text-sm font-medium hover:bg-sky-500 disabled:opacity-70"
          >
            {store.status === "tracing" ? <Loader2 size={14} className="animate-spin" /> : <Waypoints size={14} />}
            Trace
          </button>
        </div>
      </header>

      <main className="flex h-[calc(100vh-56px)]">
        <section className="flex h-full flex-col border-r border-zinc-700 bg-[#252526]" style={{ width: `${leftPct}%` }}>
          <div className="h-full" style={{ height: `${editorPct}%` }}>
            <div className="h-8 border-b border-zinc-700 px-3 py-1 text-xs font-medium uppercase text-zinc-400">C++ Code</div>
            <div className="h-[calc(100%-32px)] p-2">
              <CodeEditor
                value={store.code}
                onChange={store.setCode}
                highlightLine={store.lineFocus ?? undefined}
                focusLine={focusedErrorLine}
                markers={markers}
                theme={store.theme === "dark" ? "vs-dark" : "vs-light"}
              />
            </div>
          </div>
          <div
            className="h-1 cursor-row-resize bg-zinc-700 hover:bg-[#007acc]"
            onMouseDown={() => {
              dragRef.current = "horizontal";
            }}
          />
          <div className="flex-1 p-2">
            <div className="mb-2 text-xs font-medium uppercase text-zinc-400">stdin (optional)</div>
            <textarea
              value={store.stdin}
              onChange={(e) => store.setStdin(e.target.value)}
              placeholder="Enter program input here..."
              className="h-[calc(100%-24px)] w-full resize-none rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-sm text-zinc-200 outline-none focus:border-[#007acc]"
            />
          </div>
          <div className="border-t border-zinc-700 px-3 py-1 text-xs text-zinc-300">{store.statusMessage}</div>
          {store.compileErrors.length > 0 ? (
            <div className="max-h-36 overflow-auto border-t border-red-800/50 bg-red-950/30 p-2">
              {store.compileErrors.map((err: CompileError, idx) => (
                <button
                  key={`${err.line}-${err.column}-${idx}`}
                  type="button"
                  onClick={() => setFocusedErrorLine(err.line)}
                  className="block w-full rounded px-2 py-1 text-left text-xs text-red-200 hover:bg-red-900/40"
                >
                  {err.line}:{err.column} {err.message}
                </button>
              ))}
            </div>
          ) : null}
          {store.runOutput ? (
            <div className="max-h-40 overflow-auto border-t border-zinc-700 bg-zinc-900 p-2 font-mono text-xs">
              <div className="mb-1 text-zinc-400">stdout</div>
              <pre className="whitespace-pre-wrap text-zinc-100">{store.runOutput.stdout || "(empty)"}</pre>
              {store.runOutput.stderr ? (
                <>
                  <div className="mt-2 mb-1 text-red-300">stderr</div>
                  <pre className="whitespace-pre-wrap text-red-300">{store.runOutput.stderr}</pre>
                </>
              ) : null}
            </div>
          ) : null}
        </section>

        <div
          className="w-1 cursor-col-resize bg-zinc-700 hover:bg-[#007acc]"
          onMouseDown={() => {
            dragRef.current = "vertical";
          }}
        />

        <section className="flex h-full flex-1 flex-col bg-[#252526]">
          {store.trace?.error ? (
            <div className="border-b border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{store.trace.error}</div>
          ) : null}
          <TracePlayback
            trace={store.trace ?? { steps: [], totalSteps: 0, executionTime: 0 }}
            stderr={store.runOutput?.stderr}
            currentStep={store.currentStep}
            isPlaying={store.isPlaying}
            speed={store.playSpeed}
            selectedHeapAddress={store.selectedHeapAddress}
            onLineChange={store.setLineFocus}
            onStepChange={store.setStep}
            onPlayingChange={store.setPlaying}
            onSpeedChange={store.setPlaySpeed}
            onSelectHeapAddress={store.setSelectedHeapAddress}
          />
        </section>
      </main>

      {settingsOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[480px] rounded border border-zinc-700 bg-[#252526] p-4">
            <h2 className="mb-4 text-base font-semibold">Settings</h2>
            <div className="space-y-3 text-sm">
              <label className="block">
                <div className="mb-1 text-zinc-300">Backend URL</div>
                <input
                  value={tempSettings.backendUrl}
                  onChange={(e) => setTempSettings((s) => ({ ...s, backendUrl: e.target.value }))}
                  className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-zinc-300">Max Trace Steps</div>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={tempSettings.maxSteps}
                  onChange={(e) =>
                    setTempSettings((s) => ({ ...s, maxSteps: Math.max(1, Math.min(5000, Number(e.target.value))) }))
                  }
                  className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-zinc-300">Auto-play speed</div>
                <select
                  value={tempSettings.autoPlaySpeed}
                  onChange={(e) => setTempSettings((s) => ({ ...s, autoPlaySpeed: Number(e.target.value) as 0.5 | 1 | 2 | 4 }))}
                  className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1"
                >
                  {[0.5, 1, 2, 4].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}x
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-zinc-300">Theme</div>
                <select
                  value={tempSettings.theme}
                  onChange={(e) => setTempSettings((s) => ({ ...s, theme: e.target.value as "dark" | "light" }))}
                  className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSettingsOpen(false)} className="rounded border border-zinc-600 px-3 py-1 text-sm">
                Cancel
              </button>
              <button type="button" onClick={saveSettings} className="rounded bg-[#007acc] px-3 py-1 text-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="absolute bottom-4 right-4 z-50 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
          <div>{retryIn ? `Rate limited — retry in ${retryIn}s` : toast.message}</div>
          {toast.retry ? (
            <button type="button" onClick={toast.retry} className="mt-1 text-xs text-sky-400 hover:underline">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
