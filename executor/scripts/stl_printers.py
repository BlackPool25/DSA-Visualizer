"""
stl_printers.py - Custom serializers for STL containers.

STL containers have complex internal structures that vary by implementation
(libstdc++ vs libc++). This module provides structured JSON serialization
for common STL containers rather than just string representations.

Supported Containers:
- std::vector<T>: Dynamic array with size/capacity
- std::list<T>: Doubly-linked list with node structure
- std::map<K,V> / std::set<T>: Red-black tree
- std::unordered_map<K,V> / std::unordered_set<T>: Hash table
- std::stack<T> / std::queue<T> / std::priority_queue<T>: Container adapters

Implementation Notes:
- Currently targets libstdc++ (GNU C++ standard library)
- Internal field names may differ in libc++ (Clang)
- Field names (_M_impl, _M_start, etc.) vary between GCC/libstdc++ versions
- We access private members through GDB's ability to inspect any field
- If serialization fails, check your GCC version and libstdc++ implementation

Container Internals (libstdc++):

std::vector:
  _M_impl._M_start - pointer to first element
  _M_impl._M_finish - pointer past last element
  _M_impl._M_end_of_storage - pointer past allocated space

std::list:
  _M_impl._M_node - sentinel node (circular list)
  Each node has _M_next, _M_prev, _M_data

std::map/set:
  Red-black tree with _M_root, _M_header nodes
  Each node has _M_left, _M_right, _M_parent, _M_color, _M_value

std::unordered_map/set:
  _M_buckets - array of bucket pointers
  _M_bucket_count - number of buckets
  _M_element_count - number of elements
"""

import gdb
from typing import Any, Dict, Set, Optional, Callable


def is_stl_container(type_name: str) -> bool:
    """
    Detect if a type name is an STL container.

    Args:
        type_name: The type string from GDB, e.g., "std::vector<int, std::allocator<int>>"

    Returns:
        True if this is a known STL container type.

    Note:
        We check prefixes to handle templates with allocators and other parameters.
        For example, "std::vector<int, std::allocator<int>>" starts with "std::vector<".
    """
    stl_prefixes = [
        "std::vector<",
        "std::deque<",
        "std::list<",
        "std::map<",
        "std::set<",
        "std::unordered_map<",
        "std::unordered_set<",
        "std::stack<",
        "std::queue<",
        "std::priority_queue<",
    ]
    return any(type_name.startswith(prefix) for prefix in stl_prefixes)


def serialize_stl_container(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Main dispatcher for STL container serialization.

    Routes to specific serializers based on container type.

    Args:
        val: GDB Value of an STL container
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize individual values (passed to avoid circular imports)

    Returns:
        Dictionary with container-specific JSON structure

    Note:
        Container adapters (stack, queue, priority_queue) are detected and
        handled by serializing their underlying container.
    """
    type_name = str(val.type)

    if type_name.startswith("std::vector<"):
        return serialize_vector(val, heap, visited, serialize_value)
    elif type_name.startswith("std::deque<"):
        return serialize_deque(val, heap, visited, serialize_value)
    elif type_name.startswith("std::list<"):
        return serialize_list(val, heap, visited, serialize_value)
    elif type_name.startswith("std::map<"):
        return serialize_map(val, heap, visited, serialize_value)
    elif type_name.startswith("std::set<"):
        return serialize_set(val, heap, visited, serialize_value)
    elif type_name.startswith("std::unordered_map<"):
        return serialize_unordered_map(val, heap, visited, serialize_value)
    elif type_name.startswith("std::unordered_set<"):
        return serialize_unordered_set(val, heap, visited, serialize_value)
    elif type_name.startswith("std::stack<"):
        return serialize_stack(val, heap, visited, serialize_value)
    elif type_name.startswith("std::queue<"):
        return serialize_queue(val, heap, visited, serialize_value)
    elif type_name.startswith("std::priority_queue<"):
        return serialize_priority_queue(val, heap, visited, serialize_value)
    else:
        return {
            "kind": "stl_container",
            "type": type_name,
            "error": "Unknown STL container type",
        }


def serialize_vector(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::vector<T>.

    libstdc++ internals:
    - _M_impl._M_start: pointer to first element
    - _M_impl._M_finish: pointer past last element (size = finish - start)
    - _M_impl._M_end_of_storage: pointer past allocated space (capacity = end_of_storage - start)

    Args:
        val: GDB Value of a std::vector
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with vector details

    Note:
        We calculate size and capacity from pointer arithmetic on the internal pointers.
        Elements are stored contiguously in memory.
    """
    type_name = str(val.type)

    try:
        # Access internal implementation
        impl = val["_M_impl"]
        start = impl["_M_start"]
        finish = impl["_M_finish"]
        end_of_storage = impl["_M_end_of_storage"]

        # Calculate size and capacity
        size = int(finish - start)
        capacity = int(end_of_storage - start)

        # Get element type
        element_type = str(val.type.template_argument(0))

        # Serialize elements
        elements = []
        for i in range(size):
            try:
                elem_val = start[i]
                elements.append(serialize_value(elem_val, heap, visited))
            except gdb.error as e:
                elements.append(
                    {"kind": "error", "error": f"Could not read element {i}: {str(e)}"}
                )

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "vector",
            "element_type": element_type,
            "size": size,
            "capacity": capacity,
            "elements": elements,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "vector",
            "error": f"Could not serialize vector: {str(e)}",
        }


def serialize_deque(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::deque<T>.

    libstdc++ implements std::deque as a sequence of chunks/buffers.
    - _M_impl._M_start: iterator to first element
    - _M_impl._M_finish: iterator past last element
    - Size is calculated from iterator difference

    Args:
        val: GDB Value of a std::deque
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with deque details

    Note:
        std::deque is the default underlying container for std::stack and std::queue.
        Internal structure varies between libstdc++ versions.
    """
    type_name = str(val.type)

    try:
        # Access internal implementation
        impl = val["_M_impl"]
        start = impl["_M_start"]
        finish = impl["_M_finish"]

        # Get element type
        element_type = str(val.type.template_argument(0))

        # Try to calculate size from iterators
        # In libstdc++, iterators have _M_cur, _M_first, _M_last, _M_node
        try:
            # Calculate size by pointer arithmetic if possible
            size = int(finish["_M_cur"] - start["_M_cur"])
        except:
            # Fallback: try to get size from _M_node difference
            size = 0

        # For deque, we'll try a simpler approach - access by index if supported
        # or just report basic info
        elements = []

        # Try to iterate using operator[] if available
        # Note: This may not work for all deque implementations
        max_elements = min(size, 1000) if size > 0 else 0
        for i in range(max_elements):
            try:
                # Attempt to access element at index i
                elem_val = val[i]
                elements.append(serialize_value(elem_val, heap, visited))
            except gdb.error:
                # If direct access fails, stop trying
                break

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "deque",
            "element_type": element_type,
            "size": size,
            "elements": elements,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "deque",
            "error": f"Could not serialize deque: {str(e)}",
        }


def serialize_list(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::list<T>.

    libstdc++ implements std::list as a circular doubly-linked list.
    - _M_impl._M_node is the sentinel node
    - Each node has _M_next, _M_prev pointers and _M_data value
    - Empty list: sentinel's next and prev point to itself

    Args:
        val: GDB Value of a std::list
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with list structure

    Note:
        We traverse the list from the sentinel's next pointer until we
        loop back to the sentinel. Each node's address becomes its ID.
    """
    type_name = str(val.type)

    try:
        # Access sentinel node
        impl = val["_M_impl"]
        sentinel = impl["_M_node"]

        # Get element type
        element_type = str(val.type.template_argument(0))

        # Count nodes and collect them
        nodes = []
        current = sentinel["_M_next"]
        sentinel_addr = int(sentinel.address)

        # Prevent infinite loop - limit to reasonable size
        max_nodes = 1000
        node_count = 0

        while int(current.address) != sentinel_addr and node_count < max_nodes:
            node_count += 1
            node_addr = int(current.address)
            node_id = f"node_{node_addr:x}"

            # Get value and neighbor pointers
            try:
                node_value = current["_M_data"]
                serialized_value = serialize_value(node_value, heap, visited)
            except:
                serialized_value = {
                    "kind": "error",
                    "error": "Could not read node data",
                }

            next_node = current["_M_next"]
            prev_node = current["_M_prev"]

            next_id = (
                f"node_{int(next_node.address):x}"
                if int(next_node.address) != sentinel_addr
                else None
            )
            prev_id = (
                f"node_{int(prev_node.address):x}"
                if int(prev_node.address) != sentinel_addr
                else None
            )

            nodes.append(
                {
                    "id": node_id,
                    "value": serialized_value,
                    "next": next_id,
                    "prev": prev_id,
                }
            )

            current = next_node

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "list",
            "element_type": element_type,
            "size": len(nodes),
            "nodes": nodes,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "list",
            "error": f"Could not serialize list: {str(e)}",
        }


def serialize_map(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::map<K,V>.

    std::map is implemented as a red-black tree in libstdc++.
    Each node contains a std::pair<const Key, T> as _M_value.

    Args:
        val: GDB Value of a std::map
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with map entries

    Note:
        Currently performs in-order traversal of the tree.
        For large maps, this could be expensive.
    """
    type_name = str(val.type)

    try:
        # Get key and value types
        key_type = str(val.type.template_argument(0))
        value_type = str(val.type.template_argument(1))

        # Access tree root through _M_t (tree structure)
        tree = val["_M_t"]
        root = tree["_M_impl"]["_M_header"]["_M_parent"]

        entries = []

        def traverse_tree(node):
            """In-order traversal of red-black tree."""
            if int(node) == 0:
                return

            # Traverse left subtree
            left = node["_M_left"]
            traverse_tree(left)

            # Process current node
            try:
                pair = node["_M_value"]
                key = pair["first"]
                value = pair["second"]

                entries.append(
                    {
                        "key": serialize_value(key, heap, visited),
                        "value": serialize_value(value, heap, visited),
                    }
                )
            except gdb.error:
                pass

            # Traverse right subtree
            right = node["_M_right"]
            traverse_tree(right)

        traverse_tree(root)

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "map",
            "key_type": key_type,
            "value_type": value_type,
            "size": len(entries),
            "implementation": "red_black_tree",
            "entries": entries,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "map",
            "error": f"Could not serialize map: {str(e)}",
        }


def serialize_set(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::set<T>.

    Similar to std::map but stores only keys (values are the same as keys).

    Args:
        val: GDB Value of a std::set
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with set elements
    """
    type_name = str(val.type)

    try:
        # Get element type
        element_type = str(val.type.template_argument(0))

        # Access tree root
        tree = val["_M_t"]
        root = tree["_M_impl"]["_M_header"]["_M_parent"]

        elements = []

        def traverse_tree(node):
            """In-order traversal."""
            if int(node) == 0:
                return

            left = node["_M_left"]
            traverse_tree(left)

            try:
                value = node["_M_value"]
                elements.append(serialize_value(value, heap, visited))
            except gdb.error:
                pass

            right = node["_M_right"]
            traverse_tree(right)

        traverse_tree(root)

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "set",
            "element_type": element_type,
            "size": len(elements),
            "elements": elements,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "set",
            "error": f"Could not serialize set: {str(e)}",
        }


def serialize_unordered_map(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::unordered_map<K,V>.

    Implemented as a hash table with buckets in libstdc++.
    - _M_buckets: array of bucket pointers
    - _M_bucket_count: number of buckets
    - _M_element_count: number of elements

    Args:
        val: GDB Value of std::unordered_map
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with hash table details
    """
    type_name = str(val.type)

    try:
        # Get types
        key_type = str(val.type.template_argument(0))
        value_type = str(val.type.template_argument(1))

        # Access hashtable implementation
        hashtable = val["_M_h"]
        bucket_count = int(hashtable["_M_bucket_count"])
        element_count = int(hashtable["_M_element_count"])

        # Calculate load factor
        load_factor = element_count / bucket_count if bucket_count > 0 else 0

        # Collect entries from buckets
        entries = []
        buckets = hashtable["_M_buckets"]

        for i in range(min(bucket_count, 100)):  # Limit bucket traversal
            try:
                node = buckets[i]
                while int(node) != 0:
                    try:
                        pair = node["_M_v"]
                        key = pair["first"]
                        value = pair["second"]
                        entries.append(
                            {
                                "key": serialize_value(key, heap, visited),
                                "value": serialize_value(value, heap, visited),
                                "bucket": i,
                            }
                        )
                    except gdb.error:
                        pass
                    node = node["_M_next"]
            except:
                pass

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "unordered_map",
            "key_type": key_type,
            "value_type": value_type,
            "size": element_count,
            "bucket_count": bucket_count,
            "load_factor": round(load_factor, 3),
            "entries": entries,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "unordered_map",
            "error": f"Could not serialize unordered_map: {str(e)}",
        }


def serialize_unordered_set(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::unordered_set<T>.

    Similar to unordered_map but stores only elements.

    Args:
        val: GDB Value of std::unordered_set
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with set details (similar to unordered_map but with elements array)
    """
    type_name = str(val.type)

    try:
        element_type = str(val.type.template_argument(0))

        hashtable = val["_M_h"]
        bucket_count = int(hashtable["_M_bucket_count"])
        element_count = int(hashtable["_M_element_count"])

        load_factor = element_count / bucket_count if bucket_count > 0 else 0

        elements = []
        buckets = hashtable["_M_buckets"]

        for i in range(min(bucket_count, 100)):
            try:
                node = buckets[i]
                while int(node) != 0:
                    try:
                        value = node["_M_v"]
                        elements.append(serialize_value(value, heap, visited))
                    except gdb.error:
                        pass
                    node = node["_M_next"]
            except:
                pass

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "unordered_set",
            "element_type": element_type,
            "size": element_count,
            "bucket_count": bucket_count,
            "load_factor": round(load_factor, 3),
            "elements": elements,
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "unordered_set",
            "error": f"Could not serialize unordered_set: {str(e)}",
        }


def serialize_stack(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::stack<T>.

    std::stack is a container adapter that wraps an underlying container
    (default is std::deque). We serialize the underlying container.

    Args:
        val: GDB Value of std::stack
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with stack details
    """
    type_name = str(val.type)

    try:
        element_type = str(val.type.template_argument(0))

        # Access underlying container (default is deque)
        container = val["c"]
        container_type = str(container.type).split("<")[0]

        # Serialize underlying container
        underlying = serialize_stl_container(container, heap, visited, serialize_value)

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "stack",
            "element_type": element_type,
            "size": underlying.get("size", 0),
            "underlying_container": container_type.replace("std::", ""),
            "elements": underlying.get("elements", underlying.get("nodes", [])),
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "stack",
            "error": f"Could not serialize stack: {str(e)}",
        }


def serialize_queue(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::queue<T>.

    Similar to stack, queue wraps an underlying container (default deque).
    Front of queue is first element, back is last.

    Args:
        val: GDB Value of std::queue
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with queue details (similar structure to stack)
    """
    type_name = str(val.type)

    try:
        element_type = str(val.type.template_argument(0))

        container = val["c"]
        container_type = str(container.type).split("<")[0]

        underlying = serialize_stl_container(container, heap, visited, serialize_value)

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "queue",
            "element_type": element_type,
            "size": underlying.get("size", 0),
            "underlying_container": container_type.replace("std::", ""),
            "elements": underlying.get("elements", underlying.get("nodes", [])),
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "queue",
            "error": f"Could not serialize queue: {str(e)}",
        }


def serialize_priority_queue(
    val: gdb.Value, heap: Dict[str, Any], visited: Set[int], serialize_value: Callable
) -> Dict[str, Any]:
    """
    Serialize std::priority_queue<T>.

    priority_queue wraps an underlying container (default vector) and
    maintains a heap structure. We serialize the underlying container.

    Args:
        val: GDB Value of std::priority_queue
        heap: Dictionary to collect heap objects
        visited: Set of addresses already visited
        serialize_value: Function to serialize values

    Returns:
        Dictionary with priority queue details
    """
    type_name = str(val.type)

    try:
        element_type = str(val.type.template_argument(0))

        container = val["c"]
        container_type = str(container.type).split("<")[0]

        underlying = serialize_stl_container(container, heap, visited, serialize_value)

        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "priority_queue",
            "element_type": element_type,
            "size": underlying.get("size", 0),
            "underlying_container": container_type.replace("std::", ""),
            "elements": underlying.get("elements", []),
        }
    except (gdb.error, KeyError) as e:
        return {
            "kind": "stl_container",
            "type": type_name,
            "container_type": "priority_queue",
            "error": f"Could not serialize priority_queue: {str(e)}",
        }
