/**
 * HeapView Component
 * 
 * Displays heap objects like arrays, linked lists, and trees.
 * Similar to Python Tutor's heap visualization with:
 * - Array boxes with indices
 * - Object fields for structs
 * - Visual distinction between different object types
 */

import type { HeapObject, Value } from '../../types/index.js'

/** Props for HeapView component */
interface HeapViewProps {
    /** Heap state from trace step (object ID -> HeapObject) */
    heap: Record<string, HeapObject>
    /** Currently highlighted object ID */
    highlightedRef?: string | null
    /** Callback when object is clicked */
    onObjectClick?: (ref: string) => void
}

/**
 * Renders a single primitive or pointer value inline
 */
function InlineValue({ value }: { value: Value }) {
    if (value.kind === 'primitive') {
        const display = typeof value.value === 'string'
            ? `"${value.value}"`
            : String(value.value)
        return <span className="font-mono text-blue-600">{display}</span>
    }

    if (value.kind === 'pointer') {
        if (value.ref === null) {
            return <span className="font-mono text-gray-500 italic">null</span>
        }
        return (
            <span className="font-mono text-orange-600">
                →{value.ref}
            </span>
        )
    }

    if (value.kind === 'container') {
        return (
            <span className="font-mono text-indigo-600">
                →{value.ref}
            </span>
        )
    }

    return <span className="text-gray-400">?</span>
}

/**
 * Renders array elements as indexed boxes (Python Tutor style)
 */
function ArrayDisplay({ elements }: { elements: Value[] }) {
    if (elements.length === 0) {
        return <span className="text-gray-400 italic">empty</span>
    }

    return (
        <div className="flex flex-wrap gap-0.5">
            {elements.map((element, index) => (
                <div key={index} className="flex flex-col items-center">
                    {/* Index label */}
                    <span className="text-[10px] text-gray-400 font-mono mb-0.5">
                        {index}
                    </span>
                    {/* Value box */}
                    <div className="min-w-[32px] px-2 py-1 border border-gray-300 bg-white text-center text-sm">
                        <InlineValue value={element} />
                    </div>
                </div>
            ))}
        </div>
    )
}

/**
 * Renders struct/object fields
 */
function FieldsDisplay({ fields }: { fields: Record<string, Value> }) {
    const entries = Object.entries(fields)

    if (entries.length === 0) {
        return <span className="text-gray-400 italic">no fields</span>
    }

    return (
        <div className="space-y-1">
            {entries.map(([name, value]) => (
                <div key={name} className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-600 min-w-[60px]">
                        {name}:
                    </span>
                    <InlineValue value={value} />
                </div>
            ))}
        </div>
    )
}

/**
 * Single heap object card
 */
function HeapObjectCard({
    objectId,
    object,
    isHighlighted,
    onClick
}: {
    objectId: string
    object: HeapObject
    isHighlighted: boolean
    onClick?: () => void
}) {
    // Determine object type icon/color
    const typeConfig = getTypeConfig(object.type)

    return (
        <div
            onClick={onClick}
            className={`
        rounded-lg border-2 overflow-hidden cursor-pointer
        transition-all duration-200
        ${isHighlighted
                    ? 'border-orange-500 shadow-lg ring-2 ring-orange-200'
                    : 'border-gray-300 hover:border-gray-400'
                }
      `}
        >
            {/* Header with type */}
            <div
                className={`
          px-3 py-1.5 flex items-center justify-between
          ${typeConfig.bgClass} ${typeConfig.textClass}
        `}
            >
                <span className="font-mono font-semibold text-sm">
                    {object.type}
                </span>
                <span className="text-xs opacity-70 font-mono">
                    {objectId}
                </span>
            </div>

            {/* Content */}
            <div className="bg-white p-3">
                {/* Array/container elements */}
                {object.elements && object.elements.length > 0 && (
                    <div className="mb-2">
                        <ArrayDisplay elements={object.elements} />
                        {object.size !== undefined && (
                            <div className="text-xs text-gray-400 mt-1">
                                size: {object.size}
                                {object.capacity !== undefined && `, capacity: ${object.capacity}`}
                            </div>
                        )}
                    </div>
                )}

                {/* Struct fields */}
                {object.fields && Object.keys(object.fields).length > 0 && (
                    <FieldsDisplay fields={object.fields} />
                )}

                {/* Empty object fallback */}
                {(!object.elements || object.elements.length === 0) &&
                    (!object.fields || Object.keys(object.fields).length === 0) && (
                        <span className="text-gray-400 text-sm italic">
                            (no data)
                        </span>
                    )}
            </div>
        </div>
    )
}

/**
 * Get styling config based on type name
 */
function getTypeConfig(type: string): { bgClass: string; textClass: string } {
    // Linked list nodes
    if (type.toLowerCase().includes('listnode') || type.toLowerCase().includes('node')) {
        return { bgClass: 'bg-green-500', textClass: 'text-white' }
    }

    // Tree nodes
    if (type.toLowerCase().includes('treenode') || type.toLowerCase().includes('tree')) {
        return { bgClass: 'bg-purple-500', textClass: 'text-white' }
    }

    // Arrays/vectors
    if (type.toLowerCase().includes('vector') || type.toLowerCase().includes('array')) {
        return { bgClass: 'bg-blue-500', textClass: 'text-white' }
    }

    // Default
    return { bgClass: 'bg-gray-500', textClass: 'text-white' }
}

/**
 * HeapView - Displays heap memory objects
 * 
 * Features:
 * - Shows all heap-allocated objects
 * - Arrays displayed with indexed boxes
 * - Structs show fields with values
 * - Type-based color coding (lists, trees, arrays)
 * - Click to highlight object
 * 
 * @example
 * <HeapView 
 *   heap={step.heap}
 *   highlightedRef={selectedRef}
 *   onObjectClick={(ref) => setSelectedRef(ref)}
 * />
 */
export function HeapView({ heap, highlightedRef, onObjectClick }: HeapViewProps) {
    const objects = Object.entries(heap)

    // Handle empty heap
    if (objects.length === 0) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <p className="text-lg font-medium mb-2">No Heap Objects</p>
                    <p className="text-sm">No objects are currently allocated on the heap</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-sm" />
                    Heap Objects
                    <span className="text-xs font-normal text-gray-500">
                        ({objects.length} object{objects.length !== 1 ? 's' : ''})
                    </span>
                </h3>
            </div>

            {/* Objects grid */}
            <div className="flex-1 overflow-auto p-4">
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                    {objects.map(([objectId, object]) => (
                        <HeapObjectCard
                            key={objectId}
                            objectId={objectId}
                            object={object}
                            isHighlighted={objectId === highlightedRef}
                            onClick={() => onObjectClick?.(objectId)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
