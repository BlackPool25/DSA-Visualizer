/**
 * components/Editor/InputPanel.tsx — Raw stdin textarea + cleaned stdin preview.
 *
 * Shows the raw input textarea when idle/analyzing.
 * Shows the cleaned stdin preview when confirming (with a "Looks right?" gate).
 */

import { useUIStore } from "../../store/uiStore";

interface Props {
  onConfirm: () => void;
  onEdit: () => void;
}

export function InputPanel({ onConfirm, onEdit }: Props) {
  const rawInput = useUIStore((s) => s.rawInput);
  const setRawInput = useUIStore((s) => s.setRawInput);
  const cleanedStdin = useUIStore((s) => s.cleanedStdin);
  const stdinPreview = useUIStore((s) => s.stdinPreview);
  const status = useUIStore((s) => s.status);

  const isConfirming = status === "confirming";

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
        {isConfirming ? "Cleaned stdin" : "stdin (optional)"}
      </div>

      {isConfirming ? (
        <div className="flex flex-col gap-2 flex-1">
          {stdinPreview && (
            <div className="text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1">
              {stdinPreview}
            </div>
          )}
          <pre className="flex-1 bg-zinc-900 rounded p-2 text-xs text-zinc-300 overflow-auto font-mono whitespace-pre-wrap">
            {cleanedStdin || "(empty)"}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded px-3 py-1.5 transition-colors"
            >
              Looks right — Run
            </button>
            <button
              onClick={onEdit}
              className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded px-3 py-1.5 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <textarea
          className="flex-1 bg-zinc-900 rounded p-2 text-xs text-zinc-300 font-mono resize-none outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder="Enter program input here..."
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
}
