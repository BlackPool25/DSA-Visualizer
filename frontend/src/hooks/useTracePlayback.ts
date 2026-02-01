/**
 * useTracePlayback Hook
 * 
 * Custom React hook for managing trace playback state and controls.
 * Provides navigation through execution steps, auto-play functionality,
 * and playback speed control for the Python Tutor-style visualization.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { TraceStep, FullTrace } from '../types/index.js'

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
export function useTracePlayback(trace: FullTrace | null): TracePlaybackState {
    const [currentStep, setCurrentStep] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState<PlaybackSpeed>(1)

    // Extract steps array, handling null trace
    const steps = trace?.steps ?? []
    const totalSteps = steps.length

    // Reset to beginning when trace changes
    useEffect(() => {
        setCurrentStep(0)
        setIsPlaying(false)
    }, [trace])

    // Derived state for bounds checking
    const isAtStart = currentStep === 0
    const isAtEnd = currentStep >= totalSteps - 1

    // Current step data
    const step = useMemo(() => {
        if (totalSteps === 0) return null
        return steps[currentStep] ?? null
    }, [steps, currentStep, totalSteps])

    // Navigation control callbacks
    const first = useCallback(() => {
        setCurrentStep(0)
    }, [])

    const prev = useCallback(() => {
        setCurrentStep(s => Math.max(0, s - 1))
    }, [])

    const next = useCallback(() => {
        setCurrentStep(s => Math.min(totalSteps - 1, s + 1))
    }, [totalSteps])

    const last = useCallback(() => {
        setCurrentStep(Math.max(0, totalSteps - 1))
    }, [totalSteps])

    const jumpTo = useCallback((step: number) => {
        const clampedStep = Math.max(0, Math.min(totalSteps - 1, step))
        setCurrentStep(clampedStep)
    }, [totalSteps])

    // Playback control callbacks
    const play = useCallback(() => {
        if (!isAtEnd) {
            setIsPlaying(true)
        }
    }, [isAtEnd])

    const pause = useCallback(() => {
        setIsPlaying(false)
    }, [])

    const toggle = useCallback(() => {
        if (isPlaying) {
            pause()
        } else {
            play()
        }
    }, [isPlaying, play, pause])

    const handleSetSpeed = useCallback((newSpeed: PlaybackSpeed) => {
        setSpeed(newSpeed)
    }, [])

    // Auto-play timer effect
    useEffect(() => {
        if (!isPlaying || totalSteps === 0) return

        // Calculate interval based on speed
        const interval = BASE_INTERVAL_MS / speed

        const timerId = setInterval(() => {
            setCurrentStep(s => {
                const nextStep = s + 1
                if (nextStep >= totalSteps) {
                    setIsPlaying(false)
                    return s
                }
                return nextStep
            })
        }, interval)

        return () => clearInterval(timerId)
    }, [isPlaying, speed, totalSteps])

    // Pause when reaching end
    useEffect(() => {
        if (isAtEnd && isPlaying) {
            setIsPlaying(false)
        }
    }, [isAtEnd, isPlaying])

    // Memoize controls object to prevent unnecessary re-renders
    const controls: PlaybackControls = useMemo(() => ({
        first,
        prev,
        next,
        last,
        jumpTo,
        play,
        pause,
        toggle,
        setSpeed: handleSetSpeed,
    }), [first, prev, next, last, jumpTo, play, pause, toggle, handleSetSpeed])

    return {
        currentStep,
        step,
        totalSteps,
        controls,
        isPlaying,
        speed,
        isAtStart,
        isAtEnd,
    }
}
