/**
 * components/Scrubber/TraceScrubber.tsx — Step slider + prev/next buttons.
 *
 * Keyboard: ArrowLeft = prev, ArrowRight = next (when scrubber is focused).
 * Shows: "Step 3 / 16 — bsearch() line 8"
 */

import { useEffect, useRef } from "react";
import { useTraceStore } from "../../store/traceStore";

export function TraceScrubber() {
  const { totalSteps, currentStep, currentEvent, setStep, next, prev } =
    useTraceStore();
  const sliderRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Only fire when not typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (totalSteps === 0) return null;

  const label = currentEvent
    ? `Step ${currentStep + 1} / ${totalSteps} — ${currentEvent.func}() line ${currentEvent.line}`
    : `Step ${currentStep + 1} / ${totalSteps}`;

  return (
    <div className="flex flex-col gap-1 px-4 py-2 bg-zinc-900 border-t border-zinc-800">
      <div className="text-xs text-zinc-400 font-mono">{label}</div>
      <div className="flex items-center gap-3">
        <button
          onClick={prev}
          disabled={currentStep === 0}
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
          disabled={currentStep === totalSteps - 1}
          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors text-lg leading-none"
          aria-label="Next step"
        >
          ›
        </button>
      </div>
    </div>
  );
}
