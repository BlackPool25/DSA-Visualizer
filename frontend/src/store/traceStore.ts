/**
 * store/traceStore.ts — Zustand store for trace navigation.
 *
 * Owns: the flat trace array, current step index, and navigation actions.
 * Does NOT own CFG state or UI state — those are separate stores.
 */

import { create } from "zustand";
import type { TraceEvent } from "../types/trace";

interface TraceStore {
  trace: TraceEvent[];
  totalSteps: number;
  currentStep: number;
  currentEvent: TraceEvent | null;

  /** Load a new trace (resets step to 0). */
  loadTrace: (trace: TraceEvent[]) => void;
  /** Jump to a specific step. */
  setStep: (n: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

export const useTraceStore = create<TraceStore>((set, get) => ({
  trace: [],
  totalSteps: 0,
  currentStep: 0,
  currentEvent: null,

  loadTrace: (trace) =>
    set({
      trace,
      totalSteps: trace.length,
      currentStep: 0,
      currentEvent: trace[0] ?? null,
    }),

  setStep: (n) => {
    const { trace } = get();
    const clamped = Math.max(0, Math.min(n, trace.length - 1));
    set({ currentStep: clamped, currentEvent: trace[clamped] ?? null });
  },

  next: () => {
    const { currentStep, trace } = get();
    if (currentStep < trace.length - 1) {
      const next = currentStep + 1;
      set({ currentStep: next, currentEvent: trace[next] });
    }
  },

  prev: () => {
    const { currentStep, trace } = get();
    if (currentStep > 0) {
      const prev = currentStep - 1;
      set({ currentStep: prev, currentEvent: trace[prev] });
    }
  },

  reset: () => set({ trace: [], totalSteps: 0, currentStep: 0, currentEvent: null }),
}));
