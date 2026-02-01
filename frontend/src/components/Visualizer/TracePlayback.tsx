/**
 * TracePlayback Component
 * 
 * Main container for the Python Tutor-style visualization.
 * Integrates all visualization components:
 * - StackView for call stack and local variables
 * - HeapView for heap objects
 * - TimelineControls for step navigation
 * - TabView for switching between Stack/Heap views
 */

import { useState } from 'react'
import type { FullTrace } from '../../types/index.js'
import { useTracePlayback } from '../../hooks/useTracePlayback.js'
import { StackView } from './StackView.js'
import { HeapView } from './HeapView.js'
import { TimelineControls } from './TimelineControls.js'

/** Props for TracePlayback component */
interface TracePlaybackProps {
    /** Full execution trace data */
    trace: FullTrace
    /** Current line from trace for highlighting in editor */
    onLineChange?: (line: number) => void
}

/** Tab options for visualization */
type TabType = 'stack' | 'heap' | 'stdout'

/**
 * Tab button component
 */
function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            className={`
        px-4 py-2 text-sm font-medium transition-colors duration-150
        ${active
                    ? 'bg-white text-blue-600 border-b-2 border-blue-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }
      `}
        >
            {children}
        </button>
    )
}

/**
 * Stdout display panel
 */
function StdoutView({ stdout }: { stdout: string }) {
    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-3 h-3 bg-yellow-500 rounded-sm" />
                    Program Output
                </h3>
            </div>

            {/* Output content */}
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
                <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                    {stdout || <span className="text-gray-500 italic">No output yet</span>}
                </pre>
            </div>
        </div>
    )
}

/**
 * TracePlayback - Main trace visualization container
 * 
 * Features:
 * - Tabbed interface for Stack, Heap, and Output views
 * - Synchronized playback controls at bottom
 * - Reports current line number for editor highlighting
 * - Handles empty traces gracefully
 * 
 * @example
 * <TracePlayback 
 *   trace={traceResult.trace}
 *   onLineChange={(line) => setHighlightLine(line)}
 * />
 */
export function TracePlayback({ trace, onLineChange }: TracePlaybackProps) {
    const [activeTab, setActiveTab] = useState<TabType>('stack')
    const [highlightedRef, setHighlightedRef] = useState<string | null>(null)

    const {
        currentStep,
        step,
        totalSteps,
        controls,
        isPlaying,
        speed,
        isAtStart,
        isAtEnd,
    } = useTracePlayback(trace)

    // Notify parent of line changes for editor highlighting
    const currentLine = step?.line ?? 0

    // Effect to call onLineChange when step changes
    if (onLineChange && currentLine > 0) {
        onLineChange(currentLine)
    }

    // Handle pointer click to highlight heap object
    const handlePointerClick = (ref: string) => {
        setActiveTab('heap')
        setHighlightedRef(ref)
    }

    // Handle empty trace
    if (totalSteps === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <p className="text-lg font-medium text-gray-600 mb-2">
                        No Trace Data
                    </p>
                    <p className="text-sm text-gray-500">
                        Click "Trace" to generate an execution trace
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-gray-100">
                <TabButton
                    active={activeTab === 'stack'}
                    onClick={() => setActiveTab('stack')}
                >
                    Stack ({step?.callStack.length ?? 0})
                </TabButton>
                <TabButton
                    active={activeTab === 'heap'}
                    onClick={() => setActiveTab('heap')}
                >
                    Heap ({Object.keys(step?.heap ?? {}).length})
                </TabButton>
                <TabButton
                    active={activeTab === 'stdout'}
                    onClick={() => setActiveTab('stdout')}
                >
                    Output
                </TabButton>

                {/* Event type indicator */}
                <div className="flex-1 flex items-center justify-end px-4">
                    <span className={`
            px-2 py-0.5 text-xs font-medium rounded-full
            ${step?.event === 'call' ? 'bg-blue-100 text-blue-700' :
                            step?.event === 'return' ? 'bg-green-100 text-green-700' :
                                step?.event === 'exception' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'}
          `}>
                        {step?.event ?? 'step'}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                        Line {currentLine}
                    </span>
                </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'stack' && step && (
                    <StackView
                        callStack={step.callStack}
                        onPointerClick={handlePointerClick}
                    />
                )}

                {activeTab === 'heap' && step && (
                    <HeapView
                        heap={step.heap}
                        highlightedRef={highlightedRef}
                        onObjectClick={(ref) => setHighlightedRef(ref)}
                    />
                )}

                {activeTab === 'stdout' && step && (
                    <StdoutView stdout={step.stdout} />
                )}
            </div>

            {/* Timeline controls */}
            <TimelineControls
                currentStep={currentStep}
                totalSteps={totalSteps}
                controls={controls}
                isPlaying={isPlaying}
                speed={speed}
                isAtStart={isAtStart}
                isAtEnd={isAtEnd}
            />
        </div>
    )
}
