/**
 * Execution Trace Types
 *
 * Defines the schema for GDB execution traces used to visualize
 * algorithm execution step-by-step.
 */

/** Represents one execution step in the trace */
export interface TraceStep {
  /** 0-based step counter */
  stepIndex: number;
  /** Source line number being executed */
  line: number;
  /** Type of execution event */
  event: "step" | "call" | "return" | "exception";
  /** Current call stack */
  callStack: StackFrame[];
  /** Heap state (object ID -> object data) */
  heap: Record<string, HeapObject>;
  /** Accumulated stdout up to this point */
  stdout: string;
}

/** Represents a single function call frame */
export interface StackFrame {
  /** Unique frame identifier */
  frameId: string;
  /** Function name */
  function: string;
  /** Source file path */
  file: string;
  /** Current line in the function */
  line: number;
  /** Local variables (name -> value) */
  locals: Record<string, Value>;
}

/** Represents an object allocated on the heap */
export interface HeapObject {
  /** Type name (e.g., "ListNode", "TreeNode", "std::vector") */
  type: string;
  /** Memory address for debugging */
  address: string;
  /** Object fields (for structs) */
  fields?: Record<string, Value>;
  /** Array elements (for containers) */
  elements?: Value[];
  /** Container size */
  size?: number;
  /** Container capacity */
  capacity?: number;
}

/** Discriminated union for variable values */
export type Value = PrimitiveValue | PointerValue | ContainerValue;

/** Primitive value (number, string, boolean) */
export interface PrimitiveValue {
  kind: "primitive";
  value: number | string | boolean;
  type: string;
}

/** Pointer/reference value */
export interface PointerValue {
  kind: "pointer";
  /** Address of referenced object, null for nullptr */
  address: string | null;
}

/** Container value (arrays, vectors, etc.) */
export interface ContainerValue {
  kind: "container";
  /** Object ID in heap */
  ref: string;
  type: string;
}

/** Complete execution trace */
export interface FullTrace {
  /** Execution steps */
  steps: TraceStep[];
  /** Total number of steps */
  totalSteps: number;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error message if execution failed */
  error?: string;
}
