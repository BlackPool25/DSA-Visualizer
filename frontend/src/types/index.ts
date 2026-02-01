/**
 * Type re-exports from shared types
 * 
 * Provides convenient access to shared TypeScript definitions
 * for problems, test cases, API contracts, and execution traces.
 */

export type {
  // Problem types
  Problem,
  TestCase,
  Difficulty,
  Parameter,
  FunctionSignature,
  ProblemListResponse,
  
  // API types
  CompileRequest,
  CompileResponse,
  CompileError,
  RunRequest,
  RunResponse,
  TraceRequest,
  TraceResponse,
  TraceSuccessResponse,
  TraceErrorResponse,
  
  // Trace types
  FullTrace,
  TraceStep,
  StackFrame,
  HeapObject,
  Value,
  PrimitiveValue,
  PointerValue,
  ContainerValue,
} from '../../../shared/types/index.js'
