/**
 * components/ContainerVisuals/QueueVisual.tsx — Queue visualization.
 *
 * Renders a queue as a horizontal row of boxes with front/back arrows.
 * Backend serializes queue as: { front: T, items: T[] }
 */

interface QueueData {
  front: unknown;
  items: unknown[];
}

interface Props {
  value: QueueData;
}

export function QueueVisual({ value }: Props) {
  const items = value.items ?? [];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {/* Front arrow */}
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[9px] text-blue-400">front</span>
          <span className="text-blue-400 text-xs">→</span>
        </div>

        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-center min-w-[32px] h-7 px-1.5 border text-[10px] font-mono shrink-0 ${
              i === 0
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-zinc-600 bg-zinc-800 text-zinc-300"
            }`}
          >
            {String(item)}
          </div>
        ))}

        {items.length === 0 && (
          <span className="text-[10px] text-zinc-600 italic">empty</span>
        )}

        {/* Back arrow */}
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[9px] text-zinc-500">back</span>
          <span className="text-zinc-500 text-xs">→</span>
        </div>
      </div>
      <span className="text-[9px] text-zinc-600">queue · {items.length} items</span>
    </div>
  );
}
