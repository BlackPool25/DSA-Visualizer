import type {
  CompileRequest,
  CompileResponse,
  RunRequest,
  RunResponse,
  TraceRequest,
  TraceResponse,
} from "../types/index.js";

export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status = 500, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, "");
}

async function apiFetch<T>(
  backendUrl: string,
  endpoint: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(backendUrl)}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || response.statusText, response.status, retryAfter);
  }

  const json = (await response.json()) as T & { success?: boolean; error?: string };
  if (typeof json === "object" && json && "success" in json && json.success === false) {
    throw new ApiError(json.error || "Request failed", response.status, retryAfter);
  }

  return json as T;
}

export function compileCode(
  backendUrl: string,
  request: CompileRequest,
): Promise<CompileResponse> {
  return apiFetch<CompileResponse>(backendUrl, "/api/compile", request);
}

export function runCode(
  backendUrl: string,
  request: RunRequest,
): Promise<RunResponse> {
  return apiFetch<RunResponse>(backendUrl, "/api/run", request);
}

export function traceCode(
  backendUrl: string,
  request: TraceRequest,
): Promise<TraceResponse> {
  return apiFetch<TraceResponse>(backendUrl, "/api/trace", request);
}
