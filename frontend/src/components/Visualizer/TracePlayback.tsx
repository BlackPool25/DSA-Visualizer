/**
 * TracePlayback Component
 *
 * Main container for the Python Tutor-style visualization.
 * Integrates all visualization components:
 * - StackView for call stack and local variables
 * - HeapView for heap objects
 * - TimelineControls for step navigation
 * - TabView for switching between Stack/Heap views
 */

import { useEffect, useState } from "react";
import type { FullTrace } from "../../types/index.js";
import { useTracePlayback } from "../../hooks/useTracePlayback.js";
import { HeapView } from "./HeapView.js";
import { StackView } from "./StackView.js";
import { TimelineControls } from "./TimelineControls.js";

/** Props for TracePlayback component */
interface TracePlaybackProps {
  trace: FullTrace;
  stderr?: string;
  currentStep: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  selectedHeapAddress: string | null;
  onLineChange?: (line: number) => void;
  onStepChange: (step: number) => void;
  onPlayingChange: (isPlaying: boolean) => void;
  onSpeedChange: (speed: 0.5 | 1 | 2 | 4) => void;
  onSelectHeapAddress: (address: string | null) => void;
}

/** Tab options for visualization */
type TabType = "stack" | "heap" | "output";

/**
 * Tab button component
 */
function OutputView({ stdout, stderr }: { stdout: string; stderr?: string }) {
  return (
    <div className="h-full space-y-3 overflow-auto p-3">
      <div className="rounded border border-zinc-700 bg-zinc-900 p-3">
        <div className="mb-2 text-xs text-zinc-400">stdout</div>
        <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-200">{stdout || "No output yet."}</pre>
      </div>
      {stderr ? (
        <div className="rounded border border-red-900/50 bg-red-950/20 p-3">
          <div className="mb-2 text-xs text-red-300">stderr</div>
          <pre className="whitespace-pre-wrap font-mono text-sm text-red-300">{stderr}</pre>
        </div>
      ) : null}
    </div>
  );
}

/**
 * TracePlayback - Main trace visualization container
 *
 * Features:
 * - Tabbed interface for Stack, Heap, and Output views
 * - Synchronized playback controls at bottom
 * - Reports current line number for editor highlighting
 * - Handles empty traces gracefully
 *
 * @example
 * <TracePlayback
 *   trace={traceResult.trace}
 *   onLineChange={(line) => setHighlightLine(line)}
 * />
 */
export function TracePlayback({
  trace,
  stderr,
  currentStep,
  isPlaying,
  speed,
  selectedHeapAddress,
  onLineChange,
  onStepChange,
  onPlayingChange,
  onSpeedChange,
  onSelectHeapAddress,
}: TracePlaybackProps) {
  const [activeTab, setActiveTab] = useState<TabType>("stack");

  const { step, totalSteps, controls, isAtStart, isAtEnd } = useTracePlayback(trace, {
    currentStep,
    isPlaying,
    speed,
    setStep: onStepChange,
    setPlaying: onPlayingChange,
    setSpeed: onSpeedChange,
  });

  // Notify parent of line changes for editor highlighting
  useEffect(() => {
    if (onLineChange && step?.line) {
      onLineChange(step.line);
    }
  }, [onLineChange, step?.line]);

  if (totalSteps === 0) {
    return <div className="p-4 text-sm text-zinc-500">No trace steps — check your code compiles and runs without infinite loops.</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#252526]">
      <div className="flex border-b border-zinc-700 px-2">
        {(["stack", "heap", "output"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm capitalize ${
              activeTab === tab ? "border-b-2 border-[#007acc] text-zinc-100" : "text-zinc-400"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto py-2 text-xs text-zinc-500">
          event: {step?.event ?? "step"} • line {step?.line ?? "-"}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "stack" && step && (
          <StackView
            callStack={step.callStack}
            onPointerClick={(address) => {
              setActiveTab("heap");
              onSelectHeapAddress(address);
            }}
          />
        )}
        {activeTab === "heap" && step && (
          <HeapView
            heap={step.heap}
            highlightedRef={selectedHeapAddress}
            onObjectClick={onSelectHeapAddress}
          />
        )}
        {activeTab === "output" && step && <OutputView stdout={step.stdout} stderr={stderr} />}
      </div>
      <TimelineControls
        currentStep={currentStep}
        totalSteps={totalSteps}
        controls={controls}
        isPlaying={isPlaying}
        speed={speed}
        isAtStart={isAtStart}
        isAtEnd={isAtEnd}
      />
    </div>
  );
}
