/**
 * StackView Component
 * 
 * Displays the call stack with local variables for each frame.
 * Similar to Python Tutor's stack visualization with:
 * - Frames displayed as boxes
 * - Function name as header
 * - Local variables listed with values
 */

import type { StackFrame } from '../../types/index.js'
import { VariableDisplay } from './VariableDisplay.js'

/** Props for StackView component */
interface StackViewProps {
    /** Current call stack from trace step */
    callStack: StackFrame[]
    /** Optional callback when pointer is clicked */
    onPointerClick?: (ref: string) => void
}

/**
 * Single stack frame display
 */
function StackFrameCard({
    frame,
    isTopFrame,
    onPointerClick
}: {
    frame: StackFrame
    isTopFrame: boolean
    onPointerClick?: (ref: string) => void
}) {
    const localVars = Object.entries(frame.locals)

    return (
        <div
            className={`
        rounded-lg border-2 overflow-hidden transition-all duration-200
        ${isTopFrame
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-300'
                }
      `}
        >
            {/* Frame header with function name */}
            <div
                className={`
          px-3 py-2 flex items-center justify-between
          ${isTopFrame
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }
        `}
            >
                <span className="font-mono font-semibold text-sm">
                    {frame.function}()
                </span>
                <span className="text-xs opacity-70">
                    line {frame.line}
                </span>
            </div>

            {/* Local variables */}
            <div className="bg-white p-2">
                {localVars.length > 0 ? (
                    <div className="space-y-1">
                        {localVars.map(([name, value]) => (
                            <VariableDisplay
                                key={name}
                                name={name}
                                value={value}
                                onPointerClick={onPointerClick}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-gray-400 text-sm text-center py-2 italic">
                        No local variables
                    </div>
                )}
            </div>
        </div>
    )
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
    // Handle empty call stack
    if (callStack.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <p className="text-lg font-medium mb-2">No Stack Data</p>
                    <p className="text-sm">Execution has not started or has completed</p>
                </div>
            </div>
        )
    }

    // Reverse to show top of stack first (most recent call at top)
    const reversedStack = [...callStack].reverse()

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-sm" />
                    Stack Frames
                    <span className="text-xs font-normal text-gray-500">
                        ({callStack.length} frame{callStack.length !== 1 ? 's' : ''})
                    </span>
                </h3>
            </div>

            {/* Stack frames list */}
            <div className="flex-1 overflow-auto p-4">
                <div className="space-y-3">
                    {reversedStack.map((frame, index) => (
                        <StackFrameCard
                            key={frame.frameId}
                            frame={frame}
                            isTopFrame={index === 0}
                            onPointerClick={onPointerClick}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
