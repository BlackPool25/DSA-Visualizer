/**
 * HeapView Component
 * 
 * Displays heap objects like arrays, linked lists, and trees.
 * Similar to Python Tutor's heap visualization with:
 * - Array boxes with indices
 * - Object fields for structs
 * - Visual distinction between different object types
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { HeapObject, Value } from "../../types/index.js";

/** Props for HeapView component */
interface HeapViewProps {
  heap: Record<string, HeapObject>;
  highlightedRef?: string | null;
  onObjectClick?: (ref: string) => void;
}

/**
 * Renders a single primitive or pointer value inline
 */
function valueText(value: Value): string {
  if (value.kind === "primitive") return String(value.value);
  if (value.kind === "pointer") {
    const raw = value as unknown as { address?: string | null; ref?: string | null };
    const address = raw.address ?? raw.ref ?? null;
    return address ? `→ ${address}` : "∅";
  }
  return `→ ${value.ref}`;
}

function getRef(value: Value): string | null {
  if (value.kind === "container") return value.ref;
  if (value.kind === "pointer") {
    const raw = value as unknown as { address?: string | null; ref?: string | null };
    return raw.address ?? raw.ref ?? null;
  }
  return null;
}

/**
 * Renders array elements as indexed boxes (Python Tutor style)
 */
function ArrayDisplay({ elements, highlighted }: { elements: Value[]; highlighted: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {elements.map((element, index) => (
          <div key={index} className="text-center">
            <div
              className={`min-w-9 rounded border px-2 py-1 font-mono text-xs ${
                highlighted ? "border-amber-500 bg-amber-900/40" : "border-zinc-600 bg-zinc-900"
              }`}
            >
              {valueText(element)}
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">{index}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders struct/object fields
 */
function FieldsDisplay({ fields }: { fields: Record<string, Value> }) {
  return (
    <div className="space-y-1 font-mono text-xs">
      {Object.entries(fields).map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <span className="text-[#9cdcfe]">{key}</span>
          <span className="text-zinc-300">{valueText(value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Single heap object card
 */
function isMapLike(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("map");
}

function isLinkedListObject(object: HeapObject): boolean {
  const t = object.type.toLowerCase();
  return (t.includes("listnode") || t.includes("node")) && Boolean(object.fields?.next);
}

function isTreeObject(object: HeapObject): boolean {
  const t = object.type.toLowerCase();
  return (t.includes("treenode") || t.includes("node")) && Boolean(object.fields?.left) && Boolean(object.fields?.right);
}

function nodeLabel(object: HeapObject): string {
  if (!object.fields) return object.type;
  if (object.fields.val?.kind === "primitive") return String(object.fields.val.value);
  if (object.fields.value?.kind === "primitive") return String(object.fields.value.value);
  return object.type;
}

function LinkedListDisplay({
  rootId,
  heap,
}: {
  rootId: string;
  heap: Record<string, HeapObject>;
}) {
  const chain: Array<{ id: string; label: string; next: string | null }> = [];
  const visited = new Set<string>();
  let current: string | null = rootId;
  let guard = 0;

  while (current && heap[current] && guard < 25 && !visited.has(current)) {
    visited.add(current);
    const obj: HeapObject = heap[current] as HeapObject;
    const next: string | null = obj.fields?.next ? getRef(obj.fields.next) : null;
    chain.push({ id: current, label: nodeLabel(obj), next });
    current = next;
    guard += 1;
  }

  return (
    <div className="overflow-auto py-1">
      <div className="mb-1 text-[11px] text-zinc-400">Head</div>
      <div className="flex items-center gap-2">
        {chain.map((node, idx) => (
          <div key={node.id} className="flex items-center gap-2">
            <div className="rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-center font-mono text-xs">
              <div>{node.label}</div>
              <div className="text-[10px] text-zinc-500">{node.id}</div>
            </div>
            <span className="text-amber-300">{idx === chain.length - 1 ? "→ ∅" : "→"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TreeNodeLayout {
  id: string;
  x: number;
  y: number;
  label: string;
  left?: string | null;
  right?: string | null;
}

function TreeDisplay({
  rootId,
  heap,
}: {
  rootId: string;
  heap: Record<string, HeapObject>;
}) {
  const nodes: TreeNodeLayout[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  let cursorX = 40;
  const levelHeight = 70;
  const visited = new Set<string>();

  function walk(nodeId: string | null, depth: number): number {
    if (!nodeId || !heap[nodeId] || visited.has(nodeId) || depth > 8) return cursorX;
    visited.add(nodeId);
    const obj = heap[nodeId];
    const left = obj.fields?.left ? getRef(obj.fields.left) : null;
    const right = obj.fields?.right ? getRef(obj.fields.right) : null;

    const leftX = walk(left, depth + 1);
    const ownX = cursorX;
    cursorX += 80;
    const rightX = walk(right, depth + 1);
    const x = left || right ? (leftX + rightX) / 2 : ownX;

    nodes.push({
      id: nodeId,
      x,
      y: depth * levelHeight + 30,
      label: nodeLabel(obj),
      left,
      right,
    });
    if (left) edges.push({ from: nodeId, to: left });
    if (right) edges.push({ from: nodeId, to: right });
    return x;
  }

  walk(rootId, 0);

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const width = Math.max(320, cursorX + 40);
  const height = Math.max(140, (Math.max(0, ...nodes.map((n) => n.y)) || 60) + 60);

  return (
    <div className="overflow-auto">
      <svg width={width} height={height} className="max-w-full">
        {edges.map((edge, idx) => {
          const from = byId[edge.from];
          const to = byId[edge.to];
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}-${idx}`}
              x1={from.x}
              y1={from.y + 16}
              x2={to.x}
              y2={to.y - 16}
              stroke="#71717a"
              strokeWidth="1.5"
            />
          );
        })}
        {nodes.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x - 20}
              y={node.y - 16}
              width={40}
              height={32}
              rx={6}
              fill="#18181b"
              stroke="#52525b"
            />
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fill="#e4e4e7"
              fontSize="12"
              fontFamily="monospace"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * HeapView - Displays heap memory objects
 * 
 * Features:
 * - Shows all heap-allocated objects
 * - Arrays displayed with indexed boxes
 * - Structs show fields with values
 * - Type-based color coding (lists, trees, arrays)
 * - Click to highlight object
 * 
 * @example
 * <HeapView 
 *   heap={step.heap}
 *   highlightedRef={selectedRef}
 *   onObjectClick={(ref) => setSelectedRef(ref)}
 * />
 */
export function HeapView({ heap, highlightedRef, onObjectClick }: HeapViewProps) {
  const objects = useMemo(() => Object.entries(heap), [heap]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!wrapRect) return;
    const nextPaths: string[] = [];
    for (const [key, obj] of objects) {
      const from = cardRefs.current[key]?.getBoundingClientRect();
      if (!from || !obj.fields) continue;
      for (const value of Object.values(obj.fields)) {
        const toKey =
          value.kind === "container"
            ? value.ref
            : value.kind === "pointer"
              ? ((value as unknown as { address?: string | null; ref?: string | null }).address ??
                (value as unknown as { address?: string | null; ref?: string | null }).ref ??
                null)
              : null;
        if (!toKey) continue;
        const to = cardRefs.current[toKey]?.getBoundingClientRect();
        if (!to) continue;
        const x1 = from.right - wrapRect.left;
        const y1 = from.top - wrapRect.top + from.height / 2;
        const x2 = to.left - wrapRect.left;
        const y2 = to.top - wrapRect.top + to.height / 2;
        nextPaths.push(`M ${x1} ${y1} C ${x1 + 32} ${y1}, ${x2 - 32} ${y2}, ${x2} ${y2}`);
      }
    }
    queueMicrotask(() => setPaths(nextPaths));
  }, [objects]);

  if (objects.length === 0) return <div className="p-4 text-sm text-zinc-500">No heap objects at this step.</div>;

  return (
    <div ref={wrapRef} className="relative h-full overflow-auto p-3">
      <div className="grid grid-cols-1 gap-3">
        {objects.map(([id, obj]) => {
          const highlighted = highlightedRef === id;
          return (
            <button
              key={id}
              type="button"
              ref={(el) => {
                cardRefs.current[id] = el;
              }}
              onClick={() => onObjectClick?.(id)}
              className={`rounded-md border bg-[#2d2d30] p-3 text-left ${
                highlighted ? "border-amber-500" : "border-zinc-700"
              }`}
            >
              <div className="mb-2 flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-100">{obj.type}</span>
                <span className="text-zinc-500">{id}</span>
              </div>
              {obj.elements?.length ? <ArrayDisplay elements={obj.elements} highlighted={highlighted} /> : null}
              {!obj.elements?.length && obj.fields ? (
                isMapLike(obj.type) ? (
                  <table className="w-full border-collapse text-xs font-mono">
                    <thead>
                      <tr>
                        <th className="border border-zinc-700 p-1 text-left text-zinc-400">Key</th>
                        <th className="border border-zinc-700 p-1 text-left text-zinc-400">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(obj.fields).map(([k, v]) => (
                        <tr key={k}>
                          <td className="border border-zinc-700 p-1 text-zinc-300">{k}</td>
                          <td className="border border-zinc-700 p-1 text-zinc-200">{valueText(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <FieldsDisplay fields={obj.fields} />
                )
              ) : null}
              {isLinkedListObject(obj) ? <LinkedListDisplay rootId={id} heap={heap} /> : null}
              {isTreeObject(obj) ? <TreeDisplay rootId={id} heap={heap} /> : null}
            </button>
          );
        })}
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <marker id="heapArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#fb923c" />
          </marker>
        </defs>
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="#fb923c" strokeWidth="1.5" fill="none" markerEnd="url(#heapArrow)" />
        ))}
      </svg>
    </div>
  );
}
