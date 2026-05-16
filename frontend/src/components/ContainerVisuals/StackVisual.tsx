/**
 * components/ContainerVisuals/StackVisual.tsx — Vertical stack, top clearly marked.
 */

interface StackValue { top: unknown; items: unknown[] }

interface Props { value: StackValue; name: string }

export function StackVisual({ value, name }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-zinc-500">{name}: stack</div>
      <div className="flex flex-col gap-0.5">
        {value.items.map((item, i) => (
          <div
            key={i}
            className={`px-2 py-1 border text-xs font-mono ${
              i === 0
                ? "border-amber-500 bg-amber-500/10 text-amber-300"
                : "border-zinc-600 bg-zinc-800 text-zinc-300"
            }`}
          >
            {i === 0 && <span className="text-amber-500 mr-1">top →</span>}
            {String(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
