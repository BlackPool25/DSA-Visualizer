/**
 * hooks/useContainerType.ts — Determines which visual to render for a variable value.
 *
 * Heuristic: inspect the shape of the serialized value to guess the container type.
 * The backend serializes containers with distinctive shapes:
 *   - vector/deque/set: plain array
 *   - stack/queue/priority_queue: { top: ..., items: [...] } or { front: ..., items: [...] }
 *   - map: plain object with string keys
 *   - struct pointer: object with struct fields
 */

export type ContainerKind =
  | "vector"
  | "stack"
  | "queue"
  | "map"
  | "primitive"
  | "unknown";

export function useContainerType(value: unknown): ContainerKind {
  if (Array.isArray(value)) return "vector";
  if (value === null || value === undefined) return "primitive";
  if (typeof value !== "object") return "primitive";

  const obj = value as Record<string, unknown>;
  if ("top" in obj && "items" in obj) return "stack";
  if ("front" in obj && "items" in obj) return "queue";
  if (typeof obj === "object" && !Array.isArray(obj)) return "map";

  return "unknown";
}
