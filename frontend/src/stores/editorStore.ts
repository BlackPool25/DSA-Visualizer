import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CompileError, FullTrace } from "../types/index.js";

type Status = "idle" | "compiling" | "running" | "tracing" | "error" | "done";
type ThemeMode = "dark" | "light";

interface Settings {
  backendUrl: string;
  maxSteps: number;
  autoPlaySpeed: 0.5 | 1 | 2 | 4;
  theme: ThemeMode;
}

interface RunOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DSAStore extends Settings {
  code: string;
  stdin: string;
  status: Status;
  statusMessage: string;
  compileErrors: CompileError[];
  runOutput: RunOutput | null;
  trace: FullTrace | null;
  currentStep: number;
  isPlaying: boolean;
  playSpeed: 0.5 | 1 | 2 | 4;
  lineFocus: number | null;
  selectedHeapAddress: string | null;

  setCode: (code: string) => void;
  setStdin: (stdin: string) => void;
  setSettings: (settings: Partial<Settings>) => void;
  setStatus: (status: Status, message: string) => void;
  setCompileErrors: (errors: CompileError[]) => void;
  setRunOutput: (output: RunOutput | null) => void;
  setTrace: (trace: FullTrace | null) => void;
  setStep: (step: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setPlaySpeed: (speed: 0.5 | 1 | 2 | 4) => void;
  setLineFocus: (line: number | null) => void;
  setSelectedHeapAddress: (address: string | null) => void;
}

const DEFAULT_CODE = `#include <iostream>
#include <vector>

int main() {
  std::cout << "Hello, DSA Visualizer!" << std::endl;
  return 0;
}
`;

export const useEditorStore = create<DSAStore>()(
  persist(
    (set) => ({
      code: DEFAULT_CODE,
      stdin: "",
      backendUrl: "http://localhost:4000",
      maxSteps: 1000,
      autoPlaySpeed: 1,
      theme: "dark",
      status: "idle",
      statusMessage: "Ready",
      compileErrors: [],
      runOutput: null,
      trace: null,
      currentStep: 0,
      isPlaying: false,
      playSpeed: 1,
      lineFocus: null,
      selectedHeapAddress: null,

      setCode: (code) => set({ code }),
      setStdin: (stdin) => set({ stdin }),
      setSettings: (settings) => set(settings),
      setStatus: (status, statusMessage) => set({ status, statusMessage }),
      setCompileErrors: (compileErrors) => set({ compileErrors }),
      setRunOutput: (runOutput) => set({ runOutput }),
      setTrace: (trace) =>
        set({
          trace,
          currentStep: 0,
          isPlaying: false,
          selectedHeapAddress: null,
          lineFocus: trace?.steps[0]?.line ?? null,
        }),
      setStep: (currentStep) => set({ currentStep }),
      setPlaying: (isPlaying) => set({ isPlaying }),
      setPlaySpeed: (playSpeed) => set({ playSpeed }),
      setLineFocus: (lineFocus) => set({ lineFocus }),
      setSelectedHeapAddress: (selectedHeapAddress) => set({ selectedHeapAddress }),
    }),
    {
      name: "dsa-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        code: state.code,
        stdin: state.stdin,
        backendUrl: state.backendUrl,
        maxSteps: state.maxSteps,
        autoPlaySpeed: state.autoPlaySpeed,
        theme: state.theme,
      }),
    },
  ),
);
