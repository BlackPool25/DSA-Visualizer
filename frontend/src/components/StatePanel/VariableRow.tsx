/**
 * components/StatePanel/VariableRow.tsx — One variable with its value.
 *
 * Highlights changed values in amber.
 * Dispatches to the appropriate container visual based on value shape.
 * Falls back to plain text for primitives.
 */

import { useContainerType } from "../../hooks/useContainerType";
import { MapVisual } from "../ContainerVisuals/MapVisual";
import { PriorityQueueVisual } from "../ContainerVisuals/PriorityQueueVisual";
import { QueueVisual } from "../ContainerVisuals/QueueVisual";
import { StackVisual } from "../ContainerVisuals/StackVisual";
import { VectorVisual } from "../ContainerVisuals/VectorVisual";
import { useUIStore } from "../../store/uiStore";
import { detectStructSchema, schemaToVisualProps } from "../../utils/schemaRenderer";
import { StructGraphVisual } from "../ContainerVisuals/StructGraphVisual";

interface Props {
  name: string;
  value: unknown;
  changed: boolean;
}

export function VariableRow({ name, value, changed }: Props) {
  const containerKind = useContainerType(value);
  const structSchema = useUIStore((s) => s.structSchema);

  return (
    <div
      className={`flex flex-col gap-1 px-3 py-1.5 border-b border-zinc-800/50 ${
        changed ? "bg-amber-400/5" : ""
      }`}
    >
      {/* Name + changed badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-zinc-400 min-w-[80px] shrink-0">
          {name}
        </span>
        {changed && (
          <span className="text-xs text-amber-500 shrink-0 ml-auto">changed</span>
        )}
      </div>

      {/* Value visual */}
      <div className={`text-xs font-mono ${changed ? "text-amber-300" : "text-zinc-200"}`}>
        <ValueVisual
          name={name}
          value={value}
          kind={containerKind}
          structSchema={structSchema}
        />
      </div>
    </div>
  );
}

interface ValueVisualProps {
  name: string;
  value: unknown;
  kind: ReturnType<typeof useContainerType>;
  structSchema: ReturnType<typeof useUIStore.getState>["structSchema"];
}

function ValueVisual({ name, value, kind, structSchema }: ValueVisualProps) {
  switch (kind) {
    case "vector":
      return <VectorVisual value={value as unknown[]} name={name} />;

    case "stack": {
      const d = value as { top: unknown; items: unknown[] };
      return <StackVisual value={d} name={name} />;
    }

    case "queue": {
      const d = value as { front: unknown; items: unknown[] };
      return <QueueVisual value={d} />;
    }

    case "priority_queue": {
      const d = value as { top: unknown; items: unknown[] };
      return <PriorityQueueVisual value={d} />;
    }

    case "map":
      return <MapVisual value={value as Record<string, unknown>} name={name} />;

    case "struct": {
      // Try to match against known struct schemas
      if (structSchema) {
        const schema = detectStructSchema(value, structSchema);
        if (schema) {
          const props = schemaToVisualProps(schema);
          return (
            <StructGraphVisual
              value={value as Record<string, unknown>}
              {...props}
            />
          );
        }
      }
      // Fallback: show as JSON
      return <span className="break-all">{renderPrimitive(value)}</span>;
    }

    default:
      return <span className="break-all">{renderPrimitive(value)}</span>;
  }
}

function renderPrimitive(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length > 8) return `[${value.slice(0, 8).join(", ")}, …(${value.length})]`;
    return `[${value.join(", ")}]`;
  }
  return JSON.stringify(value, null, 0);
}
