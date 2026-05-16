/**
 * components/Scrubber/TraceScrubber.tsx — Step slider + prev/next buttons.
 *
 * Keyboard navigation is handled by useTraceNavigation hook.
 * Shows: "Step 3 / 16 — bsearch() line 8"
 * Shows a truncation warning if the trace was cut.
 */

import { useRef } from "react";
import { useTraceNavigation } from "../../hooks/useTraceNavigation";
import { useUIStore } from "../../store/uiStore";

export function TraceScrubber() {
  const { totalSteps, currentStep, label, setStep, next, prev, canGoNext, canGoPrev } =
    useTraceNavigation();
  const truncated = useUIStore((s) => s.truncated);
  const sliderRef = useRef<HTMLInputElement>(null);

  if (totalSteps === 0) return null;

  return (
    <div className="flex flex-col gap-1 px-4 py-2 bg-zinc-900 border-t border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-mono">{label}</span>
        {truncated && (
          <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            ⚠ trace truncated at {totalSteps} steps
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={prev}
          disabled={!canGoPrev}
          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors text-lg leading-none"
          aria-label="Previous step"
        >
          ‹
        </button>

        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStep}
          onChange={(e) => setStep(Number(e.target.value))}
          className="flex-1 accent-amber-400 h-1"
          aria-label="Trace step"
        />

        <button
          onClick={next}
          disabled={!canGoNext}
          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors text-lg leading-none"
          aria-label="Next step"
        >
          ›
        </button>
      </div>
    </div>
  );
}
