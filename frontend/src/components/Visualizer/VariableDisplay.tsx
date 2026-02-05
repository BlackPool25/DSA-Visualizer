/**
 * VariableDisplay Component
 * 
 * Renders variable values in the trace visualization.
 * Handles different value types from GDB trace:
 * - primitive: numbers, strings, booleans, chars
 * - pointer: memory addresses with references
 * - stl_container: vectors, maps, sets, etc.
 * - struct/heap_object: custom structs with fields
 * - array: C-style arrays
 * - enum: enumeration values
 * - unknown/error: fallback display
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Props for VariableDisplay component */
interface VariableDisplayProps {
    /** Variable name */
    name: string
    /** Variable value (from GDB trace) */
    value: any
    /** Optional callback when pointer is clicked */
    onPointerClick?: (ref: string) => void
}

/**
 * Get display color based on value type
 */
function getTypeColor(value: any): string {
    if (!value || typeof value !== 'object') return 'text-gray-600'

    const kind = value.kind
    switch (kind) {
        case 'primitive':
            if (typeof value.value === 'number') return 'text-blue-600'
            if (typeof value.value === 'string') return 'text-green-600'
            if (typeof value.value === 'boolean') return 'text-purple-600'
            return 'text-gray-600'
        case 'pointer':
            return value.ref ? 'text-orange-600' : 'text-gray-500'
        case 'stl_container':
            return 'text-indigo-600'
        case 'struct':
        case 'heap_object':
            return 'text-teal-600'
        case 'array':
            return 'text-cyan-600'
        case 'enum':
            return 'text-pink-600'
        case 'error':
            return 'text-red-500'
        default:
            return 'text-gray-600'
    }
}

/**
 * Format a value for display
 */
function formatValue(value: any): string {
    if (value === null || value === undefined) {
        return 'null'
    }

    if (typeof value !== 'object') {
        return String(value)
    }

    const kind = value.kind

    switch (kind) {
        case 'primitive': {
            const val = value.value
            if (typeof val === 'string') return `"${val}"`
            if (typeof val === 'boolean') return val ? 'true' : 'false'
            if (val === null || val === undefined) return 'null'
            return String(val)
        }

        case 'pointer': {
            if (value.is_null || value.ref === null) return 'nullptr'
            if (value.is_cycle) return `→ ${value.ref} (cycle)`
            return `→ ${value.ref}`
        }

        case 'stl_container': {
            const containerType = value.container_type || 'container'
            const size = value.size ?? value.elements?.length ?? '?'

            // For vector, show elements preview
            if (containerType === 'vector' && value.elements) {
                const preview = value.elements
                    .slice(0, 5)
                    .map((el: any) => formatValue(el))
                    .join(', ')
                const suffix = value.elements.length > 5 ? ', ...' : ''
                return `[${preview}${suffix}]`
            }

            // For map/set, show size
            if (containerType === 'map' || containerType === 'unordered_map') {
                return `{${size} entries}`
            }

            return `${containerType}<${size}>`
        }

        case 'struct':
        case 'heap_object': {
            const typeName = value.type?.split('<')[0] || 'struct'
            const fields = value.fields
            if (fields && typeof fields === 'object') {
                const fieldCount = Object.keys(fields).length
                // Show condensed field preview
                const preview = Object.entries(fields)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${formatValue(v)}`)
                    .join(', ')
                if (fieldCount <= 3) return `{${preview}}`
                return `{${preview}, ...}`
            }
            return `${typeName}{...}`
        }

        case 'array': {
            if (value.elements) {
                const preview = value.elements
                    .slice(0, 5)
                    .map((el: any) => formatValue(el))
                    .join(', ')
                const suffix = value.elements.length > 5 ? ', ...' : ''
                return `[${preview}${suffix}]`
            }
            return `array[${value.length ?? '?'}]`
        }

        case 'enum': {
            return `${value.name} (${value.value})`
        }

        case 'error': {
            return `<error: ${value.error || 'unknown'}>`
        }

        case 'unknown':
        default: {
            // Try to extract value from the object
            if ('value' in value) return String(value.value)
            return JSON.stringify(value).slice(0, 50)
        }
    }
}

/**
 * VariableDisplay - Renders a named variable with its value
 * 
 * Supports all value kinds from GDB tracer:
 * - primitive, pointer, stl_container, struct, array, enum, error, unknown
 * 
 * @example
 * <VariableDisplay name="x" value={{ kind: 'primitive', value: 42, type: 'int' }} />
 */
export function VariableDisplay({ name, value, onPointerClick }: VariableDisplayProps) {
    const colorClass = getTypeColor(value)
    const formattedValue = formatValue(value)
    const isClickable = value?.kind === 'pointer' && value.ref && !value.is_null
    const typeName = value?.type || ''

    const handleClick = () => {
        if (isClickable && onPointerClick) {
            onPointerClick(value.ref)
        }
    }

    return (
        <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded">
            {/* Variable name */}
            <span className="font-mono text-sm font-medium text-gray-700 min-w-[80px]">
                {name}
            </span>

            {/* Separator */}
            <span className="text-gray-400">=</span>

            {/* Value display */}
            <div className="flex-1">
                {isClickable ? (
                    <button
                        onClick={handleClick}
                        className={`font-mono text-sm ${colorClass} hover:underline cursor-pointer`}
                        title={`Points to object ${value.ref}`}
                    >
                        {formattedValue}
                    </button>
                ) : (
                    <span className={`font-mono text-sm ${colorClass}`}>
                        {formattedValue}
                    </span>
                )}
            </div>

            {/* Type annotation */}
            <span className="text-xs text-gray-400 font-mono truncate max-w-[150px]" title={typeName}>
                {typeName.length > 20 ? typeName.split('<')[0] + '<...>' : typeName}
            </span>
        </div>
    )
}
