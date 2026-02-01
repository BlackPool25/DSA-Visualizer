"""
value_serializer.py - Convert GDB values to JSON-serializable Python dictionaries.

This module is the core of the GDB tracing system. It takes GDB Value objects
(representing C++ variables) and converts them to dictionaries that can be
serialized to JSON for the visualization frontend.

Key Concepts:
- GDB Values are Python objects representing C++ variables in the inferior
- We extract type information using gdb.Type objects and type codes
- Pointers require special handling to avoid infinite recursion (cycles)
- Heap objects are tracked separately and referenced by ID

GDB Python Type Codes Reference:
- TYPE_CODE_PTR = 3: Pointer types (int*)
- TYPE_CODE_ARRAY = 4: C arrays (int[10])
- TYPE_CODE_STRUCT = 6: Structs and classes
- TYPE_CODE_UNION = 7: Unions
- TYPE_CODE_INT = 8: Integer types (int, long, short)
- TYPE_CODE_FLT = 9: Floating point (float, double)
- TYPE_CODE_ENUM = 11: Enumerations
- TYPE_CODE_BOOL = 21: Boolean
- TYPE_CODE_CHAR = 20: Character types

Usage:
    import gdb
    val = gdb.parse_and_eval("my_variable")
    result = serialize_value(val)
    # result is a JSON-serializable dictionary
"""

import gdb
from typing import Any, Dict, Set, Optional


def serialize_value(
    val: gdb.Value,
    heap: Optional[Dict[str, Any]] = None,
    visited: Optional[Set[int]] = None,
) -> Dict[str, Any]:
    """
    Main entry point for serializing a GDB value to JSON.

    Dispatches to specialized serializers based on the value's type code.
    Handles primitives, pointers, structs, arrays, and STL containers.

    Args:
        val: A GDB Value object representing a C++ variable
        heap: Dictionary to collect heap-allocated objects (pass by reference)
        visited: Set of memory addresses already visited (prevents cycles)

    Returns:
        Dictionary matching the frontend Value TypeScript interface:
        {
            "kind": "primitive" | "pointer" | "struct" | "array" | "stl_container",
            "type": str,  # C++ type name
            ...  # Additional fields based on kind
        }

    Note:
        The heap dictionary is modified in-place to collect heap objects.
        This allows pointer values to reference heap objects by ID.
    """
    if heap is None:
        heap = {}
    if visited is None:
        visited = set()

    # Get the type and its code
    val_type = val.type
    type_code = val_type.code
    type_name = str(val_type)

    # Dispatch based on type code
    if type_code == gdb.TYPE_CODE_INT:
        return serialize_primitive(val, "int")
    elif type_code == gdb.TYPE_CODE_FLT:
        return serialize_primitive(val, "float")
    elif type_code == gdb.TYPE_CODE_BOOL:
        return serialize_primitive(val, "bool")
    elif type_code == gdb.TYPE_CODE_CHAR:
        return serialize_primitive(val, "char")
    elif type_code == gdb.TYPE_CODE_PTR:
        return serialize_pointer(val, heap, visited)
    elif type_code == gdb.TYPE_CODE_ARRAY:
        return serialize_array(val, heap, visited)
    elif type_code == gdb.TYPE_CODE_STRUCT:
        # Check if this is an STL container first
        from stl_printers import is_stl_container, serialize_stl_container

        if is_stl_container(type_name):
            # Pass serialize_value function to avoid circular import
            return serialize_stl_container(val, heap, visited, serialize_value)
        return serialize_struct(val, heap, visited)
    elif type_code == gdb.TYPE_CODE_ENUM:
        return serialize_enum(val)
    else:
        # Unknown type - return as string representation
        return {"kind": "unknown", "type": type_name, "value": str(val)}


def serialize_primitive(val: gdb.Value, primitive_type: str) -> Dict[str, Any]:
    """
    Serialize primitive types (int, float, bool, char).

    GDB primitive types have TYPE_CODE_INT, TYPE_CODE_FLT, TYPE_CODE_BOOL,
    or TYPE_CODE_CHAR. We extract the actual value by casting to Python types.

    Args:
        val: GDB Value of a primitive type
        primitive_type: String identifier for the type ("int", "float", "bool", "char")

    Returns:
        Dictionary with kind, type, and value fields

    Note:
        GDB stores all values internally, we cast to Python int/float/bool/str
        to extract the actual value for serialization.
    """
    try:
        if primitive_type == "bool":
            # GDB bool is stored as integer 0 or 1
            python_val = bool(int(val))
        elif primitive_type == "float":
            # Cast to float
            python_val = float(val)
        elif primitive_type == "char":
            # Character might be signed or unsigned
            char_val = int(val)
            # Convert to character if printable, otherwise keep as int
            if 32 <= char_val <= 126:
                python_val = chr(char_val)
            else:
                python_val = char_val
        else:
            # Integer type
            python_val = int(val)

        return {"kind": "primitive", "type": str(val.type), "value": python_val}
    except (ValueError, gdb.error) as e:
        # Handle cases where value cannot be read
        return {
            "kind": "primitive",
            "type": str(val.type),
            "value": None,
            "error": f"Could not read value: {str(e)}",
        }


def serialize_pointer(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int]
) -> Dict[str, Any]:
    """
    Serialize pointer types with heap object tracking.

    Pointers require special handling:
    1. Check for null (address 0)
    2. Generate stable ID from address (e.g., "addr_0x7fff1234")
    3. Check for cycles using visited set
    4. If pointing to struct, add to heap for visualization

    Args:
        val: GDB Value of a pointer type
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited (prevents infinite recursion)

    Returns:
        Dictionary with pointer info and reference ID:
        {
            "kind": "pointer",
            "type": "ListNode*",
            "ref": "addr_0x..." | null,
            "is_null": bool
        }

    Note:
        The referenced object is stored in heap dict with the address as key.
        This allows the frontend to look up the full object details.
    """
    # Get the raw address as integer
    address = int(val)

    # Check for null pointer
    if address == 0:
        return {"kind": "pointer", "type": str(val.type), "ref": None, "is_null": True}

    # Generate stable reference ID
    ref_id = f"addr_{address:x}"

    # Check if we've already visited this address (cycle detection)
    if address in visited:
        # Just return the reference, don't re-serialize
        return {
            "kind": "pointer",
            "type": str(val.type),
            "ref": ref_id,
            "is_null": False,
            "is_cycle": True,
        }

    # Mark as visited
    visited.add(address)

    # Dereference the pointer to get the pointed-to value
    try:
        pointed_val = val.dereference()
        pointed_type = pointed_val.type

        # Add to heap if it's a struct (likely a data structure node)
        if pointed_type.code == gdb.TYPE_CODE_STRUCT:
            # Serialize the pointed-to object and add to heap
            heap_obj = serialize_struct(pointed_val, heap, visited, is_heap=True)
            heap[ref_id] = heap_obj

        return {
            "kind": "pointer",
            "type": str(val.type),
            "ref": ref_id,
            "is_null": False,
        }
    except gdb.error as e:
        # Dangling pointer or invalid memory
        return {
            "kind": "pointer",
            "type": str(val.type),
            "ref": ref_id,
            "is_null": False,
            "error": f"Could not dereference: {str(e)}",
        }


def serialize_struct(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], is_heap: bool = False
) -> Dict[str, Any]:
    """
    Serialize struct and class types.

    Iterates over all fields in the struct and recursively serializes each.
    Handles nested structs, pointers to other structs, etc.

    Args:
        val: GDB Value of a struct/class type
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        is_heap: Whether this struct is heap-allocated (for metadata)

    Returns:
        Dictionary with field names as keys:
        {
            "kind": "struct" | "heap_object",
            "type": "ListNode",
            "fields": {
                "val": {"kind": "primitive", ...},
                "next": {"kind": "pointer", ...}
            }
        }

    Note:
        For data structures like linked lists and trees, fields are typically
        named conventionally (val/value, next, left, right, etc.).
    """
    val_type = val.type
    type_name = str(val_type)

    # Collect all fields
    fields = {}
    for field in val_type.fields():
        field_name = field.name
        if field_name is None:
            continue  # Skip anonymous fields

        try:
            # Get the field value
            field_val = val[field_name]
            # Recursively serialize
            fields[field_name] = serialize_value(field_val, heap, visited)
        except gdb.error as e:
            # Field might be optimized out or inaccessible
            fields[field_name] = {
                "kind": "error",
                "error": f"Could not read field: {str(e)}",
            }

    result = {
        "kind": "heap_object" if is_heap else "struct",
        "type": type_name,
        "fields": fields,
    }

    # Add memory address for heap objects
    if is_heap:
        try:
            result["address"] = f"0x{int(val.address):x}"
        except:
            pass

    return result


def serialize_array(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int]
) -> Dict[str, Any]:
    """
    Serialize C arrays.

    GDB arrays have a range property that gives us the bounds.
    We iterate over each element and serialize it.

    Args:
        val: GDB Value of an array type
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited

    Returns:
        Dictionary with elements array:
        {
            "kind": "array",
            "type": "int[5]",
            "length": 5,
            "elements": [...]
        }

    Note:
        Arrays in C are contiguous in memory. We use GDB's range to get
        the bounds and iterate through each index.
    """
    val_type = val.type
    type_name = str(val_type)

    try:
        # Get array bounds
        array_range = val_type.range()
        start, end = array_range
        length = end - start + 1

        # Serialize each element
        elements = []
        for i in range(start, end + 1):
            try:
                elem_val = val[i]
                elements.append(serialize_value(elem_val, heap, visited))
            except gdb.error as e:
                elements.append(
                    {"kind": "error", "error": f"Could not read element {i}: {str(e)}"}
                )

        return {
            "kind": "array",
            "type": type_name,
            "length": length,
            "elements": elements,
        }
    except (gdb.error, TypeError) as e:
        # Fallback: try to treat as pointer if range fails
        return {
            "kind": "array",
            "type": type_name,
            "error": f"Could not determine array bounds: {str(e)}",
        }


def serialize_enum(val: gdb.Value) -> Dict[str, Any]:
    """
    Serialize enum types.

    Enums are integer-based in C++ but have symbolic names.
    GDB can provide both the numeric value and the symbolic name.

    Args:
        val: GDB Value of an enum type

    Returns:
        Dictionary with enum info:
        {
            "kind": "enum",
            "type": "Status",
            "name": "OK",
            "value": 0
        }

    Note:
        GDB's str() on an enum value usually returns the symbolic name.
        int() returns the underlying numeric value.
    """
    try:
        # Get symbolic name
        name = str(val)
        # Get numeric value
        numeric = int(val)

        return {"kind": "enum", "type": str(val.type), "name": name, "value": numeric}
    except (ValueError, gdb.error) as e:
        return {
            "kind": "enum",
            "type": str(val.type),
            "error": f"Could not read enum: {str(e)}",
        }
