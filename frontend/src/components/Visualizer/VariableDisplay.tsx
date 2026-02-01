/**
 * VariableDisplay Component
 * 
 * Renders variable values in the trace visualization.
 * Handles different value types: primitives, pointers, and containers.
 * Uses visual styling similar to Python Tutor.
 */

import type { Value, PrimitiveValue, PointerValue, ContainerValue } from '../../types/index.js'

/** Props for VariableDisplay component */
interface VariableDisplayProps {
    /** Variable name */
    name: string
    /** Variable value (discriminated union) */
    value: Value
    /** Optional callback when pointer is clicked */
    onPointerClick?: (ref: string) => void
}

/**
 * Display a primitive value (number, string, boolean)
 */
function PrimitiveDisplay({ value }: { value: PrimitiveValue }) {
    // Format based on type
    const displayValue = typeof value.value === 'string'
        ? `"${value.value}"`
        : String(value.value)

    // Color based on type
    const typeColor = typeof value.value === 'number'
        ? 'text-blue-600'
        : typeof value.value === 'string'
            ? 'text-green-600'
            : 'text-purple-600'

    return (
        <span className={`font-mono ${typeColor}`}>
            {displayValue}
        </span>
    )
}

/**
 * Display a pointer/reference value with arrow indicator
 */
function PointerDisplay({
    value,
    onPointerClick
}: {
    value: PointerValue
    onPointerClick?: (ref: string) => void
}) {
    // Null pointer
    if (value.ref === null) {
        return (
            <span className="font-mono text-gray-500 italic">
                nullptr
            </span>
        )
    }

    return (
        <button
            onClick={() => onPointerClick?.(value.ref!)}
            className="inline-flex items-center gap-1 font-mono text-orange-600 hover:text-orange-800 cursor-pointer"
            title={`Points to object ${value.ref}`}
        >
            <span className="text-xs">→</span>
            <span className="underline">{value.ref}</span>
        </button>
    )
}

/**
 * Display a container reference (array, vector, etc.)
 */
function ContainerDisplay({
    value,
    onPointerClick
}: {
    value: ContainerValue
    onPointerClick?: (ref: string) => void
}) {
    return (
        <button
            onClick={() => onPointerClick?.(value.ref)}
            className="inline-flex items-center gap-1 font-mono text-indigo-600 hover:text-indigo-800 cursor-pointer"
            title={`Container object ${value.ref}`}
        >
            <span className="text-xs bg-indigo-100 px-1 rounded">{value.type}</span>
            <span className="text-xs">→</span>
            <span className="underline">{value.ref}</span>
        </button>
    )
}

/**
 * VariableDisplay - Renders a named variable with its value
 * 
 * Supports three value types:
 * - Primitive: Numbers, strings, booleans shown inline
 * - Pointer: Shows arrow and reference ID, clickable
 * - Container: Shows type badge and reference, clickable
 * 
 * @example
 * <VariableDisplay name="x" value={{ kind: 'primitive', value: 42, type: 'int' }} />
 * <VariableDisplay name="ptr" value={{ kind: 'pointer', ref: 'obj_1', type: 'int*' }} />
 */
export function VariableDisplay({ name, value, onPointerClick }: VariableDisplayProps) {
    return (
        <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded">
            {/* Variable name */}
            <span className="font-mono text-sm font-medium text-gray-700 min-w-[80px]">
                {name}
            </span>

            {/* Separator */}
            <span className="text-gray-400">=</span>

            {/* Value display based on kind */}
            <div className="flex-1">
                {value.kind === 'primitive' && (
                    <PrimitiveDisplay value={value} />
                )}

                {value.kind === 'pointer' && (
                    <PointerDisplay value={value} onPointerClick={onPointerClick} />
                )}

                {value.kind === 'container' && (
                    <ContainerDisplay value={value} onPointerClick={onPointerClick} />
                )}
            </div>

            {/* Type annotation */}
            <span className="text-xs text-gray-400 font-mono">
                {value.type}
            </span>
        </div>
    )
}
