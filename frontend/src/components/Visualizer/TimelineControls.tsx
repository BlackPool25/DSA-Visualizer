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

import {
    SkipBack,
    ChevronLeft,
    ChevronRight,
    SkipForward,
    Play,
    Pause,
} from 'lucide-react'
import type { PlaybackControls, PlaybackSpeed } from '../../hooks/useTracePlayback.js'

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
function NavButton({
    onClick,
    disabled,
    children,
    title
}: {
    onClick: () => void
    disabled: boolean
    children: React.ReactNode
    title: string
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`
        flex items-center gap-1 px-3 py-2 rounded-md font-medium text-sm
        transition-colors duration-150
        ${disabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                }
      `}
        >
            {children}
        </button>
    )
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
    if (totalSteps === 0) {
        return (
            <div className="flex items-center justify-center p-4 bg-gray-50 border-t border-gray-200">
                <span className="text-gray-500 text-sm">No trace data available</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-4 p-4 bg-gray-50 border-t border-gray-200">
            {/* Navigation buttons */}
            <div className="flex items-center gap-1">
                <NavButton
                    onClick={controls.first}
                    disabled={isAtStart}
                    title="First step"
                >
                    <SkipBack className="w-4 h-4" />
                    First
                </NavButton>

                <NavButton
                    onClick={controls.prev}
                    disabled={isAtStart}
                    title="Previous step"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                </NavButton>
            </div>

            {/* Play/Pause button */}
            <button
                onClick={controls.toggle}
                disabled={isAtEnd && !isPlaying}
                title={isPlaying ? 'Pause' : 'Play'}
                className={`
          flex items-center justify-center w-10 h-10 rounded-full
          transition-colors duration-150
          ${isPlaying
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : isAtEnd
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }
        `}
            >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* Timeline slider */}
            <div className="flex-1 flex items-center gap-3">
                <input
                    type="range"
                    min={0}
                    max={totalSteps - 1}
                    value={currentStep}
                    onChange={(e) => controls.jumpTo(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-blue-500
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:hover:bg-blue-600
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-blue-500
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:cursor-pointer
            [&::-moz-range-thumb]:border-0"
                />
            </div>

            {/* Navigation buttons (forward) */}
            <div className="flex items-center gap-1">
                <NavButton
                    onClick={controls.next}
                    disabled={isAtEnd}
                    title="Next step"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </NavButton>

                <NavButton
                    onClick={controls.last}
                    disabled={isAtEnd}
                    title="Last step"
                >
                    Last
                    <SkipForward className="w-4 h-4" />
                </NavButton>
            </div>

            {/* Step counter */}
            <div className="flex items-center gap-3 min-w-[140px]">
                <span className="text-sm font-medium text-gray-700 tabular-nums">
                    Step {currentStep + 1} of {totalSteps}
                </span>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Speed:</span>
                <select
                    value={speed}
                    onChange={(e) => controls.setSpeed(parseFloat(e.target.value) as PlaybackSpeed)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    {SPEED_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                            {s}x
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
