/**
 * hooks/useContainerType.ts — Determines which visual to render for a variable value.
 *
 * Heuristic: inspect the shape of the serialized value to guess the container type.
 * The backend serializes containers with distinctive shapes:
 *   - vector/deque/set/multiset: plain array
 *   - stack: { top: ..., items: [...] }
 *   - queue: { front: ..., items: [...] }
 *   - priority_queue: { top: ..., items: [...] } (same as stack — disambiguate by context)
 *   - map/unordered_map: plain object with string keys, no "top"/"front"/"items"
 *   - struct pointer: object with struct fields (detected by schemaRenderer)
 */

export type ContainerKind =
  | "vector"
  | "stack"
  | "queue"
  | "priority_queue"
  | "map"
  | "set"
  | "struct"
  | "primitive"
  | "unknown";

export function useContainerType(value: unknown): ContainerKind {
  if (value === null || value === undefined) return "primitive";
  if (typeof value !== "object") return "primitive";

  if (Array.isArray(value)) return "vector";

  const obj = value as Record<string, unknown>;

  // Stack: { top, items } — items ordered top-first
  if ("top" in obj && "items" in obj && Array.isArray(obj.items)) return "stack";

  // Queue: { front, items }
  if ("front" in obj && "items" in obj && Array.isArray(obj.items)) return "queue";

  // Opaque pointer address
  if ("$addr" in obj) return "struct";

  // Cycle/depth limit markers
  if ("$cycle" in obj || "$depth_limit" in obj) return "struct";

  // Object with string keys and no special markers → map
  return "map";
}
