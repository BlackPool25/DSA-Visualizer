/**
 * TimelineControls Component
 * 
 * Playback controls for stepping through execution trace.
 * Similar to Python Tutor's bottom control bar with:
 * - First/Prev/Next/Last navigation buttons
 * - Timeline slider for jumping to any step
 * - Play/Pause button with speed selector
 * - Step counter display
 */

import { Pause, Play } from "lucide-react";
import type { PlaybackControls, PlaybackSpeed } from "../../hooks/useTracePlayback.js";

/** Props for TimelineControls component */
interface TimelineControlsProps {
    /** Current step index (0-based) */
    currentStep: number
    /** Total number of steps */
    totalSteps: number
    /** Playback control functions */
    controls: PlaybackControls
    /** Whether auto-play is active */
    isPlaying: boolean
    /** Current playback speed */
    speed: PlaybackSpeed
    /** Whether at the start of trace */
    isAtStart: boolean
    /** Whether at the end of trace */
    isAtEnd: boolean
}

/** Available speed options */
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 4]

/**
 * Navigation button component with consistent styling
 */
function NavButton({ onClick, disabled, label, title }: { onClick: () => void; disabled: boolean; label: string; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded border px-2 py-1 font-mono text-xs ${disabled ? "border-zinc-700 text-zinc-600" : "border-zinc-500 text-zinc-100 hover:bg-zinc-700"}`}
    >
      {label}
    </button>
  );
}

/**
 * TimelineControls - Navigation bar for trace playback
 * 
 * Features:
 * - First/Prev/Next/Last buttons for step navigation
 * - Slider for random access to any step
 * - Play/Pause toggle for auto-playback
 * - Speed selector (0.5x, 1x, 2x, 4x)
 * - Step counter showing "Step X of Y"
 * 
 * @example
 * <TimelineControls
 *   currentStep={5}
 *   totalSteps={20}
 *   controls={controls}
 *   isPlaying={false}
 *   speed={1}
 *   isAtStart={false}
 *   isAtEnd={false}
 * />
 */
export function TimelineControls({
    currentStep,
    totalSteps,
    controls,
    isPlaying,
    speed,
    isAtStart,
    isAtEnd,
}: TimelineControlsProps) {
    // Handle empty trace
  if (totalSteps === 0) return null;

  return (
    <div className="border-t border-zinc-700 bg-[#252526] p-3">
      <div className="mb-2 flex items-center gap-2">
        <NavButton onClick={controls.first} disabled={isAtStart} title="First step" label="|◀" />
        <NavButton onClick={controls.prev} disabled={isAtStart} title="Previous step" label="◀" />
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStep}
          onChange={(e) => controls.jumpTo(Number(e.target.value))}
          className="h-2 flex-1 accent-[#007acc]"
        />
        <NavButton onClick={controls.next} disabled={isAtEnd} title="Next step" label="▶" />
        <NavButton onClick={controls.last} disabled={isAtEnd} title="Last step" label="▶|" />
        <span className="min-w-28 text-xs font-mono text-zinc-300">
          Step {currentStep + 1} / {totalSteps}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={controls.toggle}
          className="flex items-center gap-1 rounded border border-zinc-500 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-700"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          Speed
          <select
            value={speed}
            onChange={(e) => controls.setSpeed(Number(e.target.value) as PlaybackSpeed)}
            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs"
          >
            {SPEED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
