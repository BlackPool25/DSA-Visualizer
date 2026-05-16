/**
 * components/StatePanel/VariableRow.tsx — One variable with its value.
 *
 * Highlights changed values in amber.
 * Renders arrays as compact inline lists.
 * Pure display — no store access.
 */

interface Props {
  name: string;
  value: unknown;
  changed: boolean;
}

export function VariableRow({ name, value, changed }: Props) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/50 ${
        changed ? "bg-amber-400/5" : ""
      }`}
    >
      <span className="text-xs font-mono text-zinc-400 min-w-[80px] shrink-0">
        {name}
      </span>
      <span
        className={`text-xs font-mono break-all ${
          changed ? "text-amber-300" : "text-zinc-200"
        }`}
      >
        {renderValue(value)}
      </span>
      {changed && (
        <span className="text-xs text-amber-500 shrink-0 ml-auto">changed</span>
      )}
    </div>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length > 8) {
      return `[${value.slice(0, 8).join(", ")}, …(${value.length})]`;
    }
    return `[${value.join(", ")}]`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 0);
  }
  return String(value);
}
