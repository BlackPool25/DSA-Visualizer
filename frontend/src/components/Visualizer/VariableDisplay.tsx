import type { Value } from "../../types/index.js";

interface VariableDisplayProps {
  name: string;
  value: Value;
  onPointerClick?: (address: string) => void;
}

function primitiveClass(value: unknown): string {
  if (typeof value === "number") return "text-[#60a5fa]";
  if (typeof value === "boolean") return "text-purple-300";
  if (typeof value === "string") return "text-[#4ec9b0]";
  return "text-[#ce9178]";
}

function isLegacyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function legacyPreview(value: Record<string, unknown>): string {
  const kind = value.kind;
  if (kind === "stl_container") {
    const containerType = String(value.container_type ?? "container");
    const size = typeof value.size === "number" ? value.size : "?";
    return `${containerType}<${size}>`;
  }
  if (kind === "struct" || kind === "heap_object") return "{...}";
  if (kind === "array") {
    const length = typeof value.length === "number" ? value.length : "?";
    return `array[${length}]`;
  }
  return String(value.value ?? "unknown");
}

export function VariableDisplay({ name, value, onPointerClick }: VariableDisplayProps) {
  const pointerAddress = (() => {
    if (value.kind === "pointer") return value.address;
    if (value.kind === "container") return value.ref;
    const raw = value as unknown;
    if (!isLegacyObject(raw)) return null;
    if (raw.kind === "pointer") {
      const ref = raw.ref;
      return typeof ref === "string" ? ref : null;
    }
    if (raw.kind === "stl_container") return null;
    return null;
  })();
  const isClickable = Boolean(pointerAddress && onPointerClick);

  return (
    <div className="grid grid-cols-[minmax(80px,1fr)_minmax(90px,1fr)_2fr] gap-2 rounded px-2 py-1 text-sm font-mono">
      <span className="text-[#9cdcfe] truncate">{name}</span>
      <span className="text-zinc-400 truncate">{value.kind === "primitive" ? value.type : value.kind}</span>
      {value.kind === "primitive" ? (
        <span className={`${primitiveClass(value.value)} truncate`}>
          {typeof value.value === "string" ? `"${value.value}"` : String(value.value)}
        </span>
      ) : isLegacyObject(value as unknown) && (value as unknown as Record<string, unknown>).kind === "stl_container" ? (
        <span className="truncate text-indigo-300">{legacyPreview(value as unknown as Record<string, unknown>)}</span>
      ) : pointerAddress ? (
        <button
          type="button"
          onClick={() => onPointerClick?.(pointerAddress)}
          className={`justify-self-start text-left text-orange-300 ${isClickable ? "hover:underline" : ""}`}
        >
          → {pointerAddress}
        </button>
      ) : (
        <span className="text-zinc-500">∅ nullptr</span>
      )}
    </div>
  );
}
