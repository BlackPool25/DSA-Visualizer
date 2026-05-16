# DSA Visualiser

A web tool where DSA students write C++ code, submit it, and get a full step-by-step visual replay of how their program executed — with variable states, STL container visuals, call trees, loop expansions, and a navigable scrubber.

## How it works

```
User writes code + raw input
        ↓
LLM runs once (struct schema + clean stdin)   ← POST /analyze
        ↓
User confirms cleaned stdin
        ↓
Instrumenter rewrites C++ source (injects trace calls)
  + struct serializers appended to tracer.h
        ↓
Docker compiles + runs instrumented binary
        ↓
Trace log (JSON lines on stderr) is parsed into structured steps
        ↓
Frontend renders CFG (Dagre layout) + state panel + container visuals
        ↓
User scrubs through the full replay             ← POST /execute
```

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, libclang (AST), Docker SDK |
| LLM | Ollama (`qwen2.5-coder:14b`) |
| Sandbox | Docker (`gcc:latest`), read-only fs, tmpfs exec |
| Frontend | React 19, TypeScript 5, Vite 7 |
| State | Zustand (3 stores: trace, cfg, ui) |
| Editor | Monaco (`@monaco-editor/react`) |
| Flowchart | React Flow (`@xyflow/react`) + Dagre layout |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |

## Project structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app, CORS, router registration
│   │   ├── api/routes/
│   │   │   ├── analyze.py             # POST /analyze
│   │   │   └── execute.py             # POST /execute
│   │   ├── core/
│   │   │   ├── instrumenter/
│   │   │   │   ├── tracer.h           # Injected C++ runtime logger
│   │   │   │   │                      #   + unordered_map<string,V> serializer
│   │   │   │   │                      #   + multiset serializer
│   │   │   │   │                      #   + __TRACE_FUNC_EXIT / _VOID macros
│   │   │   │   ├── ast_walker.py      # libclang AST → injection points
│   │   │   │   │                      #   + call depth via BFS from main()
│   │   │   │   │                      #   + return expression extraction
│   │   │   │   ├── scope_tracker.py   # Variable scope map per function
│   │   │   │   └── injector.py        # Source rewriter
│   │   │   │                          #   + struct_schema param → serializer injection
│   │   │   │                          #   + proper __TRACE_FUNC_EXIT emission
│   │   │   ├── executor/
│   │   │   │   ├── docker_runner.py   # Sandbox execution
│   │   │   │   │                      #   + extracts struct serializer block
│   │   │   │   │                      #   + appends to tracer.h before compile
│   │   │   │   │                      #   + truncated flag in RunResult
│   │   │   │   └── sandbox_config.py  # Resource limits
│   │   │   ├── trace/
│   │   │   │   ├── models.py          # Pydantic event models (source of truth)
│   │   │   │   ├── parser.py          # TRACE: lines → TraceEvent list
│   │   │   │   └── cfg_builder.py     # Trace → CFG nodes/edges
│   │   │   │                          #   + recursion detection → FUNC_CALL nodes
│   │   │   │                          #   + return value in FUNC_END label
│   │   │   └── llm/
│   │   │       ├── struct_analyzer.py # Struct rendering schema from LLM
│   │   │       ├── input_cleaner.py   # Stdin reformatter
│   │   │       └── serializer_gen.py  # C++ struct serializer codegen
│   │   └── models/
│   │       ├── request.py             # API request models
│   │       └── response.py            # API response models
│   │                                  #   + truncated: bool field
│   ├── tests/
│   │   ├── test_instrumenter.py       # 11 tests for ast_walker + scope_tracker
│   │   ├── test_injector.py           # 6 tests for injector
│   │   └── fixtures/                  # Sample .cpp files
│   ├── docker/
│   │   └── Dockerfile.sandbox         # gcc:latest execution sandbox
│   └── pyproject.toml                 # uv-managed dependencies
│
└── frontend/
    └── src/
        ├── types/                     # trace.ts, cfg.ts, schema.ts
        ├── store/                     # traceStore, cfgStore, uiStore (Zustand)
        │                              #   uiStore: + truncated field
        ├── utils/
        │   ├── api.ts                 # Typed fetch client (+ truncated in response)
        │   ├── cfgLayout.ts           # Dagre layout for React Flow CFG
        │   └── schemaRenderer.ts      # Maps struct schema → StructGraphVisual props
        ├── hooks/
        │   ├── useContainerType.ts    # Detects container kind from value shape
        │   └── useTraceNavigation.ts  # Keyboard + scrubber nav (Home/End/←/→)
        └── components/
            ├── Editor/
            │   ├── CodeEditor.tsx     # Monaco + trace line highlight + compile markers
            │   └── InputPanel.tsx
            ├── FlowChart/
            │   ├── TraceFlow.tsx      # Dagre layout, loop expand/collapse, active edge
            │   ├── edges/
            │   │   └── TraceEdge.tsx  # Animated edge (amber glow on active path)
            │   └── nodes/
            │       ├── LineNode.tsx
            │       ├── BranchNode.tsx
            │       ├── LoopNode.tsx   # Click to expand/collapse iterations
            │       └── RecursionTreeNode.tsx  # Purple node for recursive calls
            ├── StatePanel/
            │   ├── StatePanel.tsx     # Variable state + event badge + call stack
            │   ├── VariableRow.tsx    # Dispatches to container visual by type
            │   └── CallStackView.tsx  # Live call stack list with depth badges
            ├── ContainerVisuals/
            │   ├── VectorVisual.tsx   # Indexed boxes
            │   ├── StackVisual.tsx    # Vertical stack, top highlighted
            │   ├── MapVisual.tsx      # Key-value table
            │   ├── QueueVisual.tsx    # Horizontal queue with front/back arrows
            │   ├── SetVisual.tsx      # Sorted teal boxes
            │   ├── PriorityQueueVisual.tsx  # Heap pyramid, top highlighted
            │   └── StructGraphVisual.tsx    # SVG tree/linked-list for pointer structs
            └── Scrubber/
                └── TraceScrubber.tsx  # Slider + prev/next + truncation warning
```

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (`pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- [Bun](https://bun.sh/) (`curl -fsSL https://bun.sh/install | bash`)
- Docker
- [Ollama](https://ollama.ai/) with `qwen2.5-coder:14b` pulled

### Backend

```bash
cd backend

# Install dependencies
uv sync --extra dev

# Build the Docker sandbox image (one-time)
docker build -f docker/Dockerfile.sandbox -t dsa-sandbox:latest .

# Run the API server
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
bun install

# Start dev server
bun run dev
# → http://localhost:5173
```

### Pull the LLM model

```bash
ollama pull qwen2.5-coder:14b
```

## API

### POST /analyze

Called first when the user submits code. Runs struct analysis and stdin cleaning in parallel.

```json
// Request
{
  "code": "#include <vector>...",
  "raw_input": "5 elements: 1 2 3 4 5"
}

// Response
{
  "struct_schema": { "structs": [] },
  "cleaned_stdin": "5\n1 2 3 4 5",
  "stdin_preview": "Reformatted from 1 line(s) to 2 line(s)"
}
```

### POST /execute

Called after the user confirms the cleaned stdin.

```json
// Request
{
  "code": "#include <vector>...",
  "cleaned_stdin": "5\n1 2 3 4 5",
  "struct_schema": { "structs": [] }
}

// Response
{
  "stdout": "Found at index: 3\n",
  "compile_error": null,
  "runtime_error": null,
  "timed_out": false,
  "truncated": false,
  "trace": [
    { "type": "enter", "line": 5, "func": "bsearch", "depth": 1, "params": { "arr": [1,3,5,7,9], "target": 7 } },
    { "type": "state", "line": 6, "func": "bsearch", "depth": 1, "vars": { "lo": 0, "hi": 4 } },
    { "type": "exit",  "line": 8, "func": "bsearch", "depth": 1, "return_val": 3 },
    ...
  ],
  "cfg_nodes": [...],
  "cfg_edges": [...],
  "total_steps": 16
}
```

`truncated: true` means the trace was cut at `MAX_TRACE_LINES` (100,000). The scrubber shows a warning banner.

## Trace event format

The `tracer.h` header writes compact JSON to stderr with a `TRACE:` prefix:

```
TRACE:{"t":"enter","l":5,"f":"bsearch","d":1,"p":{"arr":[1,3,5],"target":7}}
TRACE:{"t":"state","l":6,"f":"bsearch","d":1,"v":{"lo":0,"hi":4}}
TRACE:{"t":"branch","l":9,"f":"bsearch","d":1,"c":"arr[mid] == target","tk":false}
TRACE:{"t":"iter","l":7,"f":"bsearch","d":1,"it":0}
TRACE:{"t":"exit","l":13,"f":"bsearch","d":1,"r":3}
```

Keys: `t`=type, `l`=line, `f`=func, `d`=depth, `p`=params, `v`=vars, `c`=condition, `tk`=taken, `it`=iteration, `r`=return_val.

## Container visual shapes

The backend serializes STL containers with distinctive JSON shapes that the frontend detects:

| Container | JSON shape | Visual |
|---|---|---|
| `vector<T>`, `deque<T>`, `set<T>`, `multiset<T>` | `[...]` | Indexed boxes |
| `stack<T>` | `{"top":T,"items":[...]}` | Vertical stack |
| `queue<T>` | `{"front":T,"items":[...]}` | Horizontal queue |
| `priority_queue<T>` | `{"top":T,"items":[...]}` | Heap pyramid |
| `map<K,V>`, `unordered_map<K,V>` | `{"key":val,...}` | Key-value table |
| Pointer struct | `{"field":val,...}` | SVG tree / linked list |

## Struct rendering pipeline

1. `/analyze` calls the LLM to produce a `ProgramSchema` (which fields are labels, children, next pointers).
2. `serializer_gen.py` generates a C++ `__serialize_TypeName()` function from the schema.
3. `injector.py` embeds the generated code as a marker block in the instrumented source.
4. `docker_runner.py` extracts the block and appends it to `tracer.h` before compilation.
5. The frontend's `schemaRenderer.ts` maps the schema to `StructGraphVisual` props.
6. `StructGraphVisual` renders the struct as an SVG tree or linked list.

## CFG node types

| Type | Description | Visual |
|---|---|---|
| `line` | One or more consecutive state events | Grey box |
| `branch` | `if` condition with taken/not-taken label | Diamond (amber) |
| `loop` | Loop body — click to expand/collapse iterations | Green box with ▸/▾ |
| `func_start` | Function entry | Blue box |
| `func_end` | Function return (shows return value) | Blue box |
| `func_call` | Recursive call (same function re-entered) | Purple box with ↻ |

## Running tests

```bash
cd backend
uv run python -m pytest tests/ -v
# 17 tests, all pass
```

## Design decisions

**Why libclang instead of regex?** C++ grammar is not regular. One missed edge case in a regex parser silently corrupts the trace. libclang gives us the full AST.

**Why instrument instead of GDB?** GDB tracing is slow (one step per GDB command), fragile (depends on debug symbols), and hard to sandbox. Instrumentation compiles to native speed and produces exactly the events we need.

**Why two endpoints?** The LLM call for struct analysis and stdin cleaning can take 5-10 seconds. Separating it from execution lets the user see and confirm the cleaned input before waiting for the Docker sandbox.

**Why Ollama instead of a cloud API?** Local inference — no API keys, no data leaving the machine, works offline.

**Why not static CFG analysis?** C++ CFG analysis is extremely complex (templates, macros, virtual dispatch). Building the CFG dynamically from the trace is simpler, always correct, and shows only the paths actually taken.

**Why Dagre for layout?** Sequential `y = i * 80` stacking makes branch nodes look linear. Dagre's hierarchical layout forks branch nodes left/right and curves loop back-edges, making the control flow immediately readable.

**Why embed serializers as a marker block?** The instrumented `.cpp` is a single string passed to `docker_runner`. Embedding the serializer code as a `// __STRUCT_SERIALIZERS_BEGIN__` block lets `docker_runner` extract it and append to `tracer.h` without needing a separate file channel.

## Known limitations

- Template functions are not instrumented (v1 scope).
- Programs with `#define` macros may produce incorrect line numbers.
- The LLM struct analysis requires Ollama to be running locally.
- The Docker sandbox image must be built before first use.
- Loop node expand/collapse requires the backend to populate `CFGNode.children` (currently empty — loop child nodes are tracked by trace index but not yet grouped into sub-graphs).
