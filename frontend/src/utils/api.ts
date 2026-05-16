/**
 * utils/api.ts — Typed API client for the DSA Visualiser backend.
 *
 * Two endpoints:
 *   POST /analyze  — struct schema + cleaned stdin
 *   POST /execute  — trace + CFG
 */

import type { CFGEdge, CFGNode } from "../types/cfg";
import type { ProgramSchema } from "../types/schema";
import type { TraceEvent } from "../types/trace";

// Empty string = same origin, routed through Vite proxy to the backend.
// Set VITE_API_URL to override (e.g. in production).
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

export interface AnalyzeRequest {
  code: string;
  raw_input: string;
}

export interface AnalyzeResponse {
  struct_schema: ProgramSchema;
  cleaned_stdin: string;
  stdin_preview: string;
}

export interface ExecuteRequest {
  code: string;
  cleaned_stdin: string;
  struct_schema: ProgramSchema;
}

export interface ExecuteResponse {
  stdout: string;
  compile_error: string | null;
  runtime_error: string | null;
  timed_out: boolean;
  truncated: boolean;
  trace: TraceEvent[];
  cfg_nodes: CFGNode[];
  cfg_edges: CFGEdge[];
  total_steps: number;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  analyze: (req: AnalyzeRequest) =>
    post<AnalyzeResponse>("/analyze", req),

  execute: (req: ExecuteRequest) =>
    post<ExecuteResponse>("/execute", req),
};
