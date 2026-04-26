/**
 * useTracePlayback Hook
 * 
 * Custom React hook for managing trace playback state and controls.
 * Provides navigation through execution steps, auto-play functionality,
 * and playback speed control for the Python Tutor-style visualization.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { TraceStep, FullTrace } from "../types/index.js";

/** Supported playback speed multipliers */
export type PlaybackSpeed = 0.5 | 1 | 2 | 4

/** Playback control functions */
export interface PlaybackControls {
    /** Jump to the first step */
    first: () => void
    /** Go to the previous step */
    prev: () => void
    /** Go to the next step */
    next: () => void
    /** Jump to the last step */
    last: () => void
    /** Jump to a specific step by index */
    jumpTo: (step: number) => void
    /** Start auto-playback */
    play: () => void
    /** Pause auto-playback */
    pause: () => void
    /** Toggle play/pause */
    toggle: () => void
    /** Set playback speed */
    setSpeed: (speed: PlaybackSpeed) => void
}

/** Return value from useTracePlayback hook */
export interface TracePlaybackState {
    /** Current step index (0-based) */
    currentStep: number
    /** Current step data, null if trace is empty */
    step: TraceStep | null
    /** Total number of steps */
    totalSteps: number
    /** Playback control functions */
    controls: PlaybackControls
    /** Whether auto-play is active */
    isPlaying: boolean
    /** Current playback speed multiplier */
    speed: PlaybackSpeed
    /** Whether at the beginning of trace */
    isAtStart: boolean
    /** Whether at the end of trace */
    isAtEnd: boolean
}

/** Base interval in ms for playback (adjusted by speed) */
const BASE_INTERVAL_MS = 1000

/**
 * Hook for managing trace playback state
 * 
 * Provides step navigation, auto-play with adjustable speed,
 * and derived state for UI rendering.
 * 
 * @param trace - Full execution trace to playback
 * @returns Playback state and controls
 * 
 * @example
 * const { currentStep, step, controls, isPlaying } = useTracePlayback(trace)
 * 
 * // Navigate manually
 * controls.next()
 * controls.prev()
 * 
 * // Auto-play
 * controls.play()
 * controls.setSpeed(2)
 */
interface UseTracePlaybackOptions {
  currentStep: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
  setStep: (n: number) => void;
  setPlaying: (b: boolean) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
}

export function useTracePlayback(
  trace: FullTrace | null,
  options: UseTracePlaybackOptions,
): TracePlaybackState {
  const intervalRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const steps = trace?.steps ?? [];
  const totalSteps = steps.length;
  const { currentStep, isPlaying, speed } = options;
  const isAtStart = currentStep === 0;
  const isAtEnd = totalSteps === 0 || currentStep >= totalSteps - 1;

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const next = useCallback(() => {
    options.setStep(Math.min(totalSteps - 1, currentStep + 1));
  }, [currentStep, options, totalSteps]);

  useEffect(() => {
    if (!isPlaying || isAtEnd || totalSteps === 0) {
      clearTimers();
      return;
    }

    const interval = BASE_INTERVAL_MS / speed;
    if (speed === 0.5) {
      const tick = (ts: number) => {
        if (!lastTsRef.current) lastTsRef.current = ts;
        const elapsed = ts - lastTsRef.current;
        if (elapsed >= interval) {
          options.setStep(Math.min(totalSteps - 1, options.currentStep + 1));
          lastTsRef.current = ts;
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
      return clearTimers;
    }

    intervalRef.current = window.setInterval(() => {
      options.setStep(Math.min(totalSteps - 1, options.currentStep + 1));
    }, interval);

    return clearTimers;
  }, [clearTimers, isAtEnd, isPlaying, options, speed, totalSteps]);

  useEffect(() => {
    if (isAtEnd && isPlaying) {
      options.setPlaying(false);
    }
  }, [isAtEnd, isPlaying, options]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const controls = useMemo<PlaybackControls>(
    () => ({
      first: () => options.setStep(0),
      prev: () => options.setStep(Math.max(0, currentStep - 1)),
      next,
      last: () => options.setStep(Math.max(0, totalSteps - 1)),
      jumpTo: (step) => options.setStep(Math.max(0, Math.min(totalSteps - 1, step))),
      play: () => !isAtEnd && options.setPlaying(true),
      pause: () => options.setPlaying(false),
      toggle: () => options.setPlaying(!isPlaying),
      setSpeed: options.setSpeed,
    }),
    [currentStep, isAtEnd, isPlaying, next, options, totalSteps],
  );

  return {
    currentStep,
    step: (steps[currentStep] as TraceStep | undefined) ?? null,
    totalSteps,
    controls,
    isPlaying,
    speed,
    isAtStart,
    isAtEnd,
  };
}
