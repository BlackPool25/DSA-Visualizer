/**
 * API Service
 * 
 * Provides functions to interact with the DSA Visualizer backend API.
 * Uses native fetch API with proper error handling and TypeScript types.
 */

import type {
  CompileRequest,
  CompileResponse,
  RunRequest,
  RunResponse,
  TraceRequest,
  TraceResponse,
  Problem,
} from '../types/index.js'

/** 
 * Base URL for API requests
 * In development with Docker, the Vite proxy handles /api requests
 * In production or local development, use the full backend URL
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Generic fetch wrapper with error handling
 * 
 * @param endpoint - API endpoint path (without base URL)
 * @param options - Fetch options
 * @returns Promise with parsed JSON response
 * @throws Error if request fails
 */
/** API response wrapper type */
interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

/**
 * Generic fetch wrapper with error handling
 * Automatically unwraps { success, data } responses from backend
 * 
 * @param endpoint - API endpoint path (without base URL)
 * @param options - Fetch options
 * @returns Promise with unwrapped data
 * @throws Error if request fails or response indicates failure
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`)
  }

  const json = await response.json()

  // Unwrap if wrapped in { success, data } format
  if (json && typeof json === 'object' && 'data' in json && 'success' in json) {
    const apiResponse = json as ApiResponse<T>
    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'API request failed')
    }
    return apiResponse.data
  }

  return json as T
}

/**
 * Fetch list of problems with optional filtering
 * 
 * @param page - Page number for pagination (default: 1)
 * @param difficulty - Filter by difficulty level
 * @param tags - Filter by topic tags
 * @returns Array of problems
 */
/**
 * Fetch list of problems with optional filtering
 * 
 * Note: Backend returns Problem[] directly, not wrapped in ProblemListResponse.
 * This is because the LeetCode GraphQL client returns a simple array.
 * 
 * @param page - Page number for pagination (default: 1)
 * @param difficulty - Filter by difficulty level
 * @param tags - Filter by topic tags
 * @returns Array of problems matching the filters
 */
export async function fetchProblems(
  page?: number,
  difficulty?: string,
  tags?: string[]
): Promise<Problem[]> {
  const params = new URLSearchParams()
  if (page) params.append('page', page.toString())
  if (difficulty) params.append('difficulty', difficulty)
  if (tags && tags.length > 0) params.append('tags', tags.join(','))

  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<Problem[]>(`/api/problems${query}`)
}

/**
 * Fetch a single problem by its slug
 * 
 * @param slug - Problem title slug
 * @returns Problem details
 */
export async function fetchProblem(slug: string): Promise<Problem> {
  return apiFetch<Problem>(`/api/problems/${encodeURIComponent(slug)}`)
}

/**
 * Compile C++ source code
 * 
 * @param code - Source code to compile
 * @returns Compilation result with binary ID or errors
 */
export async function compileCode(code: string): Promise<CompileResponse> {
  const request: CompileRequest = { code, language: 'cpp' }
  return apiFetch<CompileResponse>('/api/compile', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Run compiled code with input
 * 
 * @param binaryId - Binary ID from successful compilation
 * @param stdin - Standard input for the program
 * @returns Execution output
 */
export async function runCode(binaryId: string, stdin: string): Promise<RunResponse> {
  const request: RunRequest = { binaryId, stdin }
  return apiFetch<RunResponse>('/api/run', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Generate execution trace for code
 * 
 * @param code - Source code to trace
 * @param stdin - Standard input for the program
 * @param maxSteps - Maximum number of steps to capture
 * @returns Execution trace data
 */
export async function traceCode(
  code: string,
  stdin: string,
  maxSteps?: number
): Promise<TraceResponse> {
  const request: TraceRequest = { code, stdin, maxSteps }
  return apiFetch<TraceResponse>('/api/trace', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Generate test harness for problem
 * 
 * @param slug - Problem slug
 * @param code - User solution code
 * @param testInput - Test case input
 * @returns Response from harness generation
 */
export async function generateHarness(
  slug: string,
  code: string,
  testInput: string
): Promise<{ harnessedCode: string }> {
  return apiFetch<{ harnessedCode: string }>('/api/harness', {
    method: 'POST',
    body: JSON.stringify({ code, slug, testInput }),
  })
}
