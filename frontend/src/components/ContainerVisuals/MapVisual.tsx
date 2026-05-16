/**
 * components/ContainerVisuals/MapVisual.tsx — Key-value table.
 */

interface Props { value: Record<string, unknown>; name: string }

export function MapVisual({ value, name }: Props) {
  const entries = Object.entries(value);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-zinc-500">{name}: map ({entries.length})</div>
      <div className="border border-zinc-700 rounded overflow-hidden">
        {entries.map(([k, v]) => (
          <div key={k} className="flex border-b border-zinc-800 last:border-0">
            <div className="px-2 py-1 text-xs font-mono text-blue-300 border-r border-zinc-700 min-w-[60px]">{k}</div>
            <div className="px-2 py-1 text-xs font-mono text-zinc-200">{String(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
