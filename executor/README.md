# Executor - GDB-Based C++ Execution Tracing

The executor is a sandboxed Docker environment that compiles and runs C++ code under GDB to capture detailed execution traces. It converts program state into JSON format for visualization.

## Overview

This component provides:
- **Secure sandboxing** via Docker with non-root user
- **Step-by-step tracing** using GDB's Python API
- **Variable inspection** capturing all local variables at each step
- **Heap tracking** for pointers and data structures (linked lists, trees)
- **STL support** for vectors, lists, maps, sets, and more
- **JSON output** compatible with the visualization frontend

## Architecture

```
executor/
├── Dockerfile                 # Docker image definition
├── scripts/
│   ├── __init__.py
│   ├── trace_collector.py    # Main GDB Python script
│   ├── value_serializer.py   # GDB value → JSON conversion
│   ├── stl_printers.py       # STL container serializers
│   ├── run_traced.sh         # Shell wrapper script
│   └── pyproject.toml        # Python project config (uv)
├── templates/
│   ├── structures.hpp        # ListNode, TreeNode definitions
│   └── deserializers.hpp     # Input parsing utilities
└── tests/
    ├── test_trace_collector.py
    ├── test_stl_printers.py
    └── sample_solutions/
        ├── reverse_linked_list.cpp
        ├── two_sum.cpp
        └── binary_tree_inorder.cpp
```

## Building the Docker Image

```bash
cd executor
docker build -t dsa-executor .
```

The image includes:
- g++ (C++ compiler with debug symbol support)
- gdb (GNU debugger with Python scripting)
- uv (Modern Python package manager)
- Non-root user for secure code execution

## Usage

### Running a Solution with Tracing

1. **Compile your C++ solution with debug symbols:**
   ```bash
   g++ -g -std=c++17 my_solution.cpp -o my_solution
   ```

2. **Run with the trace collector:**
   ```bash
   TRACE_OUTPUT=trace.json TRACE_MAX_STEPS=100 \
     gdb -batch -silent \
         -ex "set pagination off" \
         -x scripts/trace_collector.py \
         --args ./my_solution < input.txt
   ```

3. **Or use the shell wrapper:**
   ```bash
   ./scripts/run_traced.sh ./my_solution input.txt trace.json 100
   ```

### Using Docker

```bash
# Build the image
docker build -t dsa-executor .

# Run a solution inside the container
docker run --rm -v $(pwd)/workspace:/workspace dsa-executor \
  bash -c "cd /workspace && g++ -g -std=c++17 solution.cpp -o solution && \
           TRACE_OUTPUT=trace.json TRACE_MAX_STEPS=100 \
           gdb -batch -silent -ex 'set pagination off' \
               -x /scripts/trace_collector.py \
               --args ./solution < input.txt"
```

## Python Scripts

### trace_collector.py

Main GDB script that orchestrates execution tracing.

**Key Features:**
- Registers stop event handlers with GDB
- Captures call stack at each execution step
- Tracks local variables in all frames
- Manages heap object collection
- Outputs JSON trace file

**Environment Variables:**
- `TRACE_OUTPUT`: Path for trace.json (default: trace.json)
- `TRACE_MAX_STEPS`: Maximum steps before stopping (default: 1000)

### value_serializer.py

Converts GDB Value objects to JSON-serializable dictionaries.

**Supported Types:**
- Primitives (int, float, bool, char)
- Pointers (with null checking and heap tracking)
- Structs/Classes (field iteration)
- Arrays (bounds detection)
- Enums (symbolic names)

**Type Codes:**
```python
TYPE_CODE_PTR = 3      # Pointer types
TYPE_CODE_ARRAY = 4    # C arrays
TYPE_CODE_STRUCT = 6   # Structs and classes
TYPE_CODE_INT = 8      # Integer types
TYPE_CODE_FLT = 9      # Floating point
TYPE_CODE_ENUM = 11    # Enumerations
TYPE_CODE_BOOL = 21    # Boolean
TYPE_CODE_CHAR = 20    # Character types
```

### stl_printers.py

Custom serializers for C++ STL containers.

**Supported Containers:**
- `std::vector<T>`: Shows size, capacity, elements array
- `std::list<T>`: Shows doubly-linked node structure
- `std::map<K,V>`: Shows red-black tree entries
- `std::set<T>`: Shows ordered elements
- `std::unordered_map<K,V>`: Shows hash table with buckets
- `std::unordered_set<T>`: Shows hash-based elements
- `std::stack<T>` / `std::queue<T>`: Shows underlying container

**Note:** Currently targets libstdc++ (GNU C++ library). libc++ support may be added in future versions.

## C++ Templates

### structures.hpp

Standard data structure definitions matching LeetCode conventions.

**Included Structures:**
- `ListNode`: Singly-linked list node (val, next)
- `TreeNode`: Binary tree node (val, left, right)
- `Node`: N-ary tree node (val, children vector)
- `GraphNode`: Graph node (val, neighbors vector)

### deserializers.hpp

Utility functions for parsing LeetCode-style inputs.

**Functions:**
- `buildList(vector<int>)`: Creates linked list from array
- `buildTree(vector<optional<int>>)`: Creates tree from level-order array
- `serializeList(ListNode*)`: Converts list to vector
- `serializeTree(TreeNode*)`: Converts tree to level-order array
- `parseIntArray(string)`: Parses "[1,2,3]" format
- `parseMatrix(string)`: Parses "[[1,2],[3,4]]" format

## Testing

### Running Tests

```bash
cd executor

# Install test dependencies
uv add pytest

# Run all tests
uv run pytest tests/ -v

# Run specific test file
uv run pytest tests/test_trace_collector.py -v

# Run with coverage
uv run pytest tests/ --cov=scripts
```

### Test Requirements

Before running tests, compile the sample solutions:

```bash
cd tests/sample_solutions

g++ -g -std=c++17 reverse_linked_list.cpp -o reverse_linked_list
g++ -g -std=c++17 two_sum.cpp -o two_sum
g++ -g -std=c++17 binary_tree_inorder.cpp -o binary_tree_inorder
```

### Sample Solutions

**reverse_linked_list.cpp**: Demonstrates pointer manipulation with three pointers (prev, curr, next). The trace shows how the linked list is reversed step by step.

**two_sum.cpp**: Demonstrates hash map usage with `std::unordered_map`. The trace shows the map growing as elements are processed.

**binary_tree_inorder.cpp**: Demonstrates recursive traversal. The trace shows the call stack growing and shrinking with recursion depth.

## Output Format

The trace collector produces a JSON object with the following structure:

```json
{
  "steps": [
    {
      "stepIndex": 0,
      "line": 10,
      "file": "solution.cpp",
      "event": "line",
      "callStack": [
        {
          "frameId": "frame_0",
          "function": "main",
          "file": "solution.cpp",
          "line": 10,
          "locals": {
            "head": {
              "kind": "pointer",
              "type": "ListNode*",
              "ref": "addr_0x7fff1234"
            },
            "n": {
              "kind": "primitive",
              "type": "int",
              "value": 5
            }
          }
        }
      ],
      "heap": {
        "addr_0x7fff1234": {
          "kind": "heap_object",
          "type": "ListNode",
          "fields": {
            "val": {"kind": "primitive", "type": "int", "value": 1},
            "next": {"kind": "pointer", "type": "ListNode*", "ref": "addr_0x7fff5678"}
          }
        }
      },
      "stdout": ""
    }
  ],
  "totalSteps": 1,
  "executionTime": 42
}
```

**Fields:**
- `steps`: Array of TraceStep objects representing each execution step
- `totalSteps`: Total number of steps captured
- `executionTime`: Execution time in milliseconds

## Security

The executor implements several security measures:

### Container Security

1. **Non-root user**: Code runs as `sandbox` user (UID 1000), not root
2. **Fixed UID**: User created with fixed UID 1000 for consistency
3. **No network**: Container has no network access in docker-compose.yml
4. **Read-only filesystem**: With tmpfs for temporary files only
5. **Resource limits**: Memory and CPU constraints via Docker
6. **No new privileges**: Prevents privilege escalation
7. **Immutable scripts**: `/scripts` directory is owned by root and read-only

### Input Validation

The `run_traced.sh` script includes security validations:

- **Path traversal prevention**: Rejects paths containing `..`
- **Workspace restriction**: Binaries must be within `/workspace`
- **Environment variable sanitization**: Rejects suspicious characters in env vars
- **Max steps validation**: Ensures `TRACE_MAX_STEPS` is a positive integer

### Docker Compose Configuration
```yaml
executor:
  network_mode: none
  read_only: true
  tmpfs:
    - /tmp:noexec,nosuid,size=100m
  security_opt:
    - no-new-privileges:true
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '1.0'
```

## Compatibility

### libstdc++ Versions

The STL container serializers target **libstdc++** (GNU C++ standard library). Internal field names vary between GCC versions:

- `_M_impl`, `_M_start`, `_M_finish` - std::vector internals
- `_M_node`, `_M_next`, `_M_prev` - std::list internals  
- `_M_t`, `_M_header` - std::map/set tree internals
- `_M_h`, `_M_buckets` - std::unordered_map/set hash table internals

If you encounter serialization errors, check your GCC version:
```bash
gcc --version
gdb -batch -ex "python import gdb; print(gdb.execute('show version', to_string=True))"
```

**Supported:** GCC 9.x, 10.x, 11.x, 12.x with corresponding libstdc++
**Not Supported:** libc++ (Clang's standard library) - field names differ

### GDB Python Setup

The trace_collector.py automatically adds `/scripts` to Python path for GDB:
```python
sys.path.insert(0, '/scripts')
```

This ensures GDB's embedded Python can find the modules regardless of working directory.

## Development

### Using uv for Python

This project uses `uv` instead of pip for Python package management:

```bash
# Initialize project
uv init --name dsa-tracer

# Add dependencies
uv add pytest

# Run scripts
uv run python script.py

# Run tests
uv run pytest
```

### Testing GDB Scripts

Test GDB Python scripts manually:

```bash
# Check GDB Python version
gdb -batch -ex "python import sys; print(sys.version)"

# Test loading a script
gdb -batch -ex "python exec(open('scripts/value_serializer.py').read())" \
              -ex "python print('Script loaded successfully')"

# Run a quick trace
gdb -batch -silent \
    -ex "set pagination off" \
    -x scripts/trace_collector.py \
    --args /bin/echo "test"
```

### Common Issues

1. **"No symbol table loaded"**: Compile with `-g` flag for debug symbols
2. **"Cannot access memory"**: Variable may be optimized out; use `-O0` flag
3. **STL internals in trace**: The tracer uses `next` not `step` to avoid this
4. **Import errors**: GDB Python can't find scripts; check PYTHONPATH or use absolute paths

## Implementation Notes

### GDB Python Environment

- Scripts run inside GDB's embedded Python interpreter
- Standard library is available but pip packages are not
- The `gdb` module provides debugging APIs
- Test environment: `gdb -batch -ex "python import gdb; print(dir(gdb))"`

### Tracing Strategy

We use `next` (next line) instead of `step` (step into) to:
- Stay at user code level (avoid STL implementation internals)
- Keep traces focused on algorithm logic
- Reduce trace size and processing time

This means function calls like `push_back()` appear as single steps.

### Memory Management

- Heap objects are tracked by memory address
- Cycles are detected using a visited set
- Each pointer gets a stable ID based on its address
- Dangling pointers are handled gracefully

## License

MIT - See main project LICENSE file
