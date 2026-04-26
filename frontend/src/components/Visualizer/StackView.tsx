/**
 * StackView Component
 * 
 * Displays the call stack with local variables for each frame.
 * Similar to Python Tutor's stack visualization with:
 * - Frames displayed as boxes
 * - Function name as header
 * - Local variables listed with values
 */

import type { StackFrame } from "../../types/index.js";
import { VariableDisplay } from "./VariableDisplay.js";

/** Props for StackView component */
interface StackViewProps {
  callStack: StackFrame[];
  onPointerClick?: (address: string) => void;
}

/**
 * Single stack frame display
 */
function StackFrameCard({
  frame,
  isCurrent,
  onPointerClick,
}: {
  frame: StackFrame;
  isCurrent: boolean;
  onPointerClick?: (address: string) => void;
}) {
  const locals = Object.entries(frame.locals);
  return (
    <div
      className={`rounded-md border bg-[#2d2d30] transition-colors ${
        isCurrent ? "border-l-4 border-[#007acc] border-zinc-500" : "border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2 font-mono">
        <span className="text-sm text-zinc-100">
          {isCurrent ? "🔵 " : ""}
          {frame.function} (line {frame.line})
        </span>
      </div>
      <div className="space-y-1 p-2">
        {locals.length === 0 && <div className="px-2 text-xs text-zinc-500">No locals</div>}
        {locals.map(([name, value]) => (
          <VariableDisplay key={name} name={name} value={value} onPointerClick={onPointerClick} />
        ))}
      </div>
    </div>
  );
}

/**
 * StackView - Displays execution call stack
 * 
 * Features:
 * - Shows all stack frames from bottom to top
 * - Current (top) frame is highlighted
 * - Each frame shows function name and local variables
 * - Variables are clickable for pointer references
 * 
 * @example
 * <StackView 
 *   callStack={step.callStack}
 *   onPointerClick={(ref) => highlightHeapObject(ref)}
 * />
 */
export function StackView({ callStack, onPointerClick }: StackViewProps) {
  if (callStack.length === 0) {
    return <div className="p-4 text-sm text-zinc-500">No stack frames for this step.</div>;
  }

  const ordered = [...callStack].reverse();
  return (
    <div className="h-full overflow-auto p-3">
      <div className="space-y-3">
        {ordered.map((frame, index) => (
          <StackFrameCard
            key={frame.frameId}
            frame={frame}
            isCurrent={index === 0}
            onPointerClick={onPointerClick}
          />
        ))}
      </div>
    </div>
  );
}
