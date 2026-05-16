/**
 * components/ContainerVisuals/VectorVisual.tsx — Horizontal array of index-labelled boxes.
 */

interface Props {
  value: unknown[];
  name: string;
}

export function VectorVisual({ value, name }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-zinc-500">{name}: vector</div>
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {value.map((item, i) => (
          <div key={i} className="flex flex-col items-center shrink-0">
            <div className="w-8 h-7 border border-zinc-600 bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-200">
              {String(item)}
            </div>
            <div className="text-[10px] text-zinc-600">{i}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
