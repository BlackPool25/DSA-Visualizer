# DSA Visualizer

An interactive tool for visualizing Data Structures and Algorithms with step-by-step execution traces powered by GDB.

## Quick Start

**Prerequisites:**

- Docker and Docker Compose V2 installed
- **Bun** installed (not npm/yarn): `curl -fsSL https://bun.sh/install | bash`
- For Python executor scripts: `uv` package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`

### 🚀 Running the Application

The easiest way to build and run the entire stack:

```bash
# Build all Docker images
./build.sh

# Start all services
./start.sh
```

This will start:

- **Frontend**: React app at http://localhost:3000
- **Backend**: Express API at http://localhost:4000
- **Executor**: Sandboxed C++ execution environment

### 📦 Quick Commands

```bash
# Build Docker images
./build.sh

# Start services
./start.sh

# Stop services
docker compose down

# Clean up old images and temp files
./clean.sh

# View logs
docker compose logs -f
```

### 🎯 Using the Visualizer

1. **Select a problem** from the dropdown (fetched from LeetCode)
2. **Write your C++ Solution class** - just the class, no main() needed!
3. **Click Run** to test with sample inputs
4. **Click Trace** to see step-by-step visualization

### How It Works: LeetCode-Style Execution

You write ONLY the Solution class (like on LeetCode):

```cpp
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> myDict;
        for(int i=0; i<nums.size(); i++){
            int diff = target - nums[i];
            if(myDict.count(diff)){
                return vector<int>{i, myDict[diff]};
            }
            myDict[nums[i]] = i;
        }
        return {};
    }
};
```

**The system automatically:**

1. Fetches the problem signature from LeetCode
2. Wraps your code with:
   - `#include <bits/stdc++.h>` and all necessary headers
   - `using namespace std;`
   - Data structure definitions (ListNode, TreeNode, etc.)
   - Input deserializers (JSON → C++ types)
   - A `main()` function that reads test input
   - Output serializers (C++ types → JSON)
3. Compiles the complete program
4. Runs it with your test cases
5. For tracing: Runs under GDB with breakpoints on every line

**You never need to write:**

- `#include` statements
- `main()` function
- Input/output handling
- Type conversions

### Local Development (Without Docker)

**Backend:**

```bash
cd backend
bun install
bun run dev  # Starts on port 4000
```

**Frontend:**

```bash
cd frontend
bun install
bun run dev  # Starts on port 3000
```

**Shared Types:**

```bash
cd shared
bun install
bun run build  # Must build before using in backend/frontend
```

## 🆕 Recent Updates (February 2026)

### Major Improvements

#### 🎯 Fixed GDB Trace Collection

- **Steps into user functions** - Now properly traces execution inside `Solution` methods
- **Suppressed GDB warnings** - Clean trace output without Docker/GDB warnings
- **Increased max steps** - Default: 5000 steps (up from 1000), max: 10000
- **Better stdout filtering** - Removes GDB debug messages from program output
- **Proper function stepping** - Uses `set step-mode on` to step into all user code

#### 🐳 Enhanced Docker Error Handling

- **Custom error classes** for Docker operations (`DockerExecutionError`, `DockerTimeoutError`, `DockerConnectionError`, etc.)
- **Better error context** in API responses with detailed error information
- **Output size limits** to prevent memory exhaustion (10MB default)
- **Proper stream cleanup** to avoid resource leaks
- **Type guards** for error identification (`isDockerExecutionError`, `isDockerTimeoutError`)

#### 🚀 Express Error Handling

- **Async handler wrapper** for automatic promise rejection catching
- **Structured error responses** with consistent format
- **Docker-specific error handling** in global error middleware
- **Improved logging** with error context

#### 💾 Zustand State Persistence

- **Persistent storage** for user code and problem selection
- **LocalStorage integration** via `zustand/middleware`
- **Selective persistence** - only saves code/problem, not runtime state
- **Automatic restoration** on page reload

#### 📝 Monaco Editor Enhancements

- **Validation markers** support for displaying compilation errors
- **Error/warning indicators** directly in the editor
- **Better integration** with backend error responses

#### 🔧 Package Management Updates

- **Pure Bun** - Removed all npm artifacts (`package-lock.json`)
- **Updated backend scripts** to use Bun exclusively (removed `tsx` dependency)
- **UV for Python** - Python executor scripts use UV exclusively

---

## Docker Container Management

### Rebuilding Docker Containers

After making changes to the executor or when you encounter Docker-related issues:

#### Full Rebuild (Recommended After Major Changes)

```bash
# Stop all containers
docker-compose down

# Rebuild the executor image from scratch
docker-compose build --no-cache executor

# Start all services
docker-compose up
```

#### Quick Rebuild (Faster)

```bash
# Rebuild only the executor
docker-compose up --build executor

# Or rebuild everything
docker-compose up --build
```

#### Verify Executor Image

```bash
# Check if executor image exists
docker images | grep dsa-visualizer-executor

# View executor image details
docker inspect dsa-visualizer-executor:latest
```

#### Clean Docker Environment

```bash
# Remove all containers and volumes
docker-compose down -v

# Remove executor image
docker rmi dsa-visualizer-executor:latest

# Clean up unused Docker resources
docker system prune -f

# Rebuild from scratch
docker-compose up --build
```

#### Debugging Docker Issues

```bash
# Check container logs
docker-compose logs -f executor

# Execute shell in executor container
docker-compose exec executor /bin/bash

# Check if scripts are present in container
docker-compose exec executor ls -la /scripts/

# Verify UV installation in container
docker-compose exec executor uv --version
```

### Docker Environment Variables

The executor container can be configured via environment variables in `docker-compose.yml`:

```yaml
environment:
  - TRACE_MAX_STEPS=1000
  - TRACE_OUTPUT=/workspace/trace.json
```

---

## Recent Updates (Frontend UI Improvements)

### Fixed Issues

- **Problem Picker API Response**: Fixed handling of backend response - backend returns `Problem[]` directly, not wrapped in `{ problems: [...] }`
- **Problem Display**: Enhanced problem description with proper formatting for:
  - Problem number displayed with title (e.g., "1. Two Sum")
  - Examples with code block styling
  - Constraints with proper visual distinction
  - Improved prose styling matching LeetCode's interface
- **Test Cases**: Auto-load sample test cases from `problem.exampleTestcases` when a problem is selected
- **Code Editor**: Fixed code clearing bug by adding guards in `setCode()` to prevent empty updates during re-renders
- **Problem Picker UI**: Improved visibility with enhanced CSS (better borders, contrast, and gradient styling)

### Component Architecture

- All state management uses **Zustand** for efficient, simple state handling
- **Monaco Editor** integration with proper controlled component pattern
- CSS uses **Tailwind CSS** utility classes with custom prose styling for LeetCode-style problem descriptions

## Project Structure

```
dsa-visualizer/
├── shared/        # Shared TypeScript types (workspace)
├── backend/       # Express API server (workspace)
├── frontend/      # React + Vite + TypeScript frontend (workspace)
├── executor/      # C++ execution sandbox (Docker only)
├── docker-compose.yml
├── package.json
└── README.md
```

## Frontend Architecture

The frontend is built with modern React patterns:

- **Build Tool**: Vite for fast HMR and optimized builds
- **Framework**: React 18 with functional components and hooks
- **Language**: TypeScript with strict type checking
- **State Management**: Zustand for simple, efficient state
- **Editor**: Monaco Editor with C++ syntax highlighting
- **Styling**: Tailwind CSS for utility-first styling
- **Icons**: Lucide React

### Frontend Components

#### Core Components

- `CodeEditor`: Monaco Editor wrapper with C++ support and line highlighting
- `ProblemPicker`: Searchable dropdown with difficulty/tag filters
- `TestCases`: Test case management with run/pass/fail display
- `MainLayout`: Split-pane layout with problem/editor/visualization sections
- `editorStore`: Zustand store for code, problems, and execution state

#### Visualization Engine (Python Tutor-style)

The frontend includes a comprehensive trace visualization system inspired by Python Tutor, providing step-by-step execution visualization with synchronized editor highlighting.

**Components** (`frontend/src/components/Visualizer/`):

- **`TracePlayback.tsx`**: Main container integrating all visualization components
  - Tabbed interface for Stack, Heap, and Output views
  - Reports current line number for synchronized editor highlighting
  - Handles empty traces gracefully with user-friendly messages
  - Displays execution event types (step, call, return, exception)

- **`StackView.tsx`**: Call stack visualization
  - Displays frames from bottom to top (most recent call at top)
  - Current frame highlighted with blue border
  - Each frame shows function name, line number, and local variables
  - Supports clickable pointer references to jump to heap view

- **`HeapView.tsx`**: Heap objects visualization
  - Grid layout for multiple objects
  - Array elements displayed with indexed boxes (Python Tutor style)
  - Struct fields shown with name-value pairs
  - Type-based color coding (lists: green, trees: purple, arrays: blue)
  - Click to highlight specific objects
  - Shows size and capacity for containers

- **`TimelineControls.tsx`**: Playback controls
  - First/Prev/Next/Last navigation buttons
  - Timeline slider for random access to any step
  - Play/Pause button for auto-playback
  - Speed selector (0.5x, 1x, 2x, 4x)
  - Step counter display ("Step X of Y")
  - Disabled states for boundary conditions

- **`VariableDisplay.tsx`**: Variable value rendering
  - Primitives: Inline display with type-based colors (numbers: blue, strings: green, booleans: purple)
  - Pointers: Arrow indicator with clickable reference (null shown as "nullptr")
  - Containers: Type badge with reference to heap object
  - Type annotations for all values

**Custom Hooks** (`frontend/src/hooks/`):

- **`useTracePlayback.ts`**: Trace playback state management
  - Navigation controls (first, prev, next, last, jumpTo)
  - Auto-play functionality with configurable speed
  - Boundary checking to prevent invalid step indices
  - Uses `requestAnimationFrame` for smooth timing
  - Resets state when trace data changes
  - Memoized controls to prevent unnecessary re-renders

**Features**:

- ✅ Step-by-step execution visualization
- ✅ Timeline slider for random access to any step
- ✅ Auto-play with adjustable speed (0.5x, 1x, 2x, 4x)
- ✅ Stack frames displayed as boxes with local variables
- ✅ Heap objects with array indices and struct fields
- ✅ Line highlighting in editor synchronized with current step
- ✅ Tab interface for Stack, Heap, and Output views
- ✅ Clickable pointer references to navigate between stack and heap
- ✅ Visual distinction for different data structure types
- ✅ Execution event indicators (call, return, exception)

**Trace Data Format**:

The visualization consumes trace data in the following format (from `shared/types/trace.ts`):

```typescript
interface FullTrace {
  code: string; // Source code
  steps: TraceStep[]; // Execution steps
  error?: string; // Error message if execution failed
}

interface TraceStep {
  stepIndex: number; // 0-based step counter
  line: number; // Source line number
  event: "step" | "call" | "return" | "exception";
  callStack: StackFrame[]; // Current call stack
  heap: Record<string, HeapObject>; // Heap state
  stdout: string; // Accumulated stdout
}

interface StackFrame {
  frameId: string; // Unique frame identifier
  function: string; // Function name
  file: string; // Source file path
  line: number; // Current line in function
  locals: Record<string, Value>; // Local variables
}

interface HeapObject {
  type: string; // Type name (e.g., "ListNode", "std::vector")
  address: string; // Memory address
  fields?: Record<string, Value>; // Object fields (for structs)
  elements?: Value[]; // Array elements (for containers)
  size?: number; // Container size
  capacity?: number; // Container capacity
}

// Value is a discriminated union: PrimitiveValue | PointerValue | ContainerValue
```

**Usage Example**:

```tsx
import { TracePlayback } from "./components/Visualizer/TracePlayback";

function App() {
  const [highlightLine, setHighlightLine] = useState<number>();

  return (
    <div>
      <CodeEditor highlightLine={highlightLine} />
      <TracePlayback trace={traceData} onLineChange={setHighlightLine} />
    </div>
  );
}
```

### API Service

The frontend communicates with the backend via REST API:

- `fetchProblems()` - Get problem list with filters
- `fetchProblem(slug)` - Get problem details
- `generateHarness()` - Generate executable C++ from Solution class
- `compileCode(code)` - Compile C++ code
- `runCode(binaryId, stdin)` - Execute compiled binary
- `traceCode(code, stdin)` - Generate GDB execution trace

## Backend API Documentation

The backend provides REST endpoints for LeetCode problem fetching, code compilation, execution, and tracing.

**Base URL**: `http://localhost:4000/api`

### 🔍 GET /problems

Fetch paginated list of LeetCode problems with optional filters.

**Query Parameters:**

- `page` (number, optional): Page number (1-based, default: 1)
- `pageSize` (number, optional): Problems per page (1-100, default: 20)
- `difficulty` (string, optional): Filter by "Easy", "Medium", or "Hard"
- `tags` (string, optional): Comma-separated tags (e.g., "array,hash-table")

**Response:** `Problem[]`

```json
[
  {
    "id": 1,
    "title": "Two Sum",
    "titleSlug": "two-sum",
    "difficulty": "Easy",
    "topicTags": ["array", "hash-table"],
    "content": "",
    "codeSnippets": {}
  }
]
```

**Example:**

```bash
curl "http://localhost:4000/api/problems?difficulty=Easy&pageSize=10"
```

---

### 🔍 GET /problems/:slug

Fetch detailed information for a specific problem.

**Path Parameters:**

- `slug` (string): Problem identifier (e.g., "two-sum")

**Response:** `Problem`

```json
{
  "id": 1,
  "title": "Two Sum",
  "titleSlug": "two-sum",
  "difficulty": "Easy",
  "content": "<p>Given an array...</p>",
  "sampleTestCase": "[2,7,11,15]\n9",
  "exampleTestcases": "[2,7,11,15]\n9\n[3,2,4]\n6",
  "hints": ["Use a hash map..."],
  "topicTags": ["array", "hash-table"],
  "codeSnippets": {
    "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        \n    }\n};",
    "python3": "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        "
  }
}
```

**Example:**

```bash
curl "http://localhost:4000/api/problems/two-sum"
```

---

### 🔧 POST /harness

**Generate complete executable C++ from user's Solution class** (LeetCode-style).

This is the KEY endpoint that enables LeetCode-style execution. It takes just the Solution class and wraps it with all necessary infrastructure.

**Request Body:**

```json
{
  "slug": "two-sum",
  "userCode": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // your code\n    }\n};",
  "testInput": "[[2,7,11,15], 9]"
}
```

**Fields:**

- `slug` or `problemSlug` (string): LeetCode problem identifier
- `userCode` or `code` (string, optional): User's Solution class. If omitted, uses LeetCode's C++ template
- `testInput` (string): JSON array of test inputs (e.g., `"[[2,7,11,15], 9]"`)

**Response:**

```json
{
  "success": true,
  "data": {
    "harnessedCode": "#include <bits/stdc++.h>\n#include \"structures.hpp\"...",
    "problem": {
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "difficulty": "Easy"
    },
    "signature": {
      "returnType": "vector<int>",
      "functionName": "twoSum",
      "parameters": [
        { "type": "vector<int>&", "name": "nums" },
        { "type": "int", "name": "target" }
      ]
    }
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "Failed to parse function signature",
  "details": "Could not find Solution class with public section"
}
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/harness \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "two-sum",
    "userCode": "class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { return {0,1}; } };",
    "testInput": "[[2,7,11,15], 9]"
  }'
```

---

### ⚙️ POST /compile

Compile C++ source code (usually the harnessed code from `/harness`).

**Request Body:**

```json
{
  "code": "#include <iostream>\nint main() { return 0; }",
  "compiler": "g++",
  "flags": ["-std=c++17"]
}
```

**Fields:**

- `code` (string, max 50KB): C++ source code
- `compiler` (string, optional): "g++" or "clang++" (default: "g++")
- `flags` (string[], optional): Additional compiler flags

**Success Response (200):**

```json
{
  "success": true,
  "binaryId": "550e8400-e29b-41d4-a716-446655440000",
  "duration": 523,
  "output": ""
}
```

**Compilation Error Response (200):**

```json
{
  "success": false,
  "errors": [
    {
      "message": "error: 'vector' was not declared in this scope",
      "line": 10,
      "column": 5
    }
  ],
  "duration": 421
}
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code": "#include <iostream>\nint main() { std::cout << \"Hello\"; return 0; }"}'
```

---

### ▶️ POST /run

Execute a compiled binary with optional input.

**Request Body:**

```json
{
  "binaryId": "550e8400-e29b-41d4-a716-446655440000",
  "stdin": "[2,7,11,15]\n9"
}
```

**Fields:**

- `binaryId` (string, UUID): ID from `/compile` response
- `stdin` (string, optional, max 1MB): Input to provide via stdin

**Response (200):**

```json
{
  "success": true,
  "stdout": "[0,1]\n",
  "stderr": "",
  "exitCode": 0,
  "duration": 45,
  "timedOut": false
}
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/run \
  -H "Content-Type: application/json" \
  -d '{"binaryId": "550e8400-e29b-41d4-a716-446655440000", "stdin": "[2,7,11,15]\n9"}'
```

---

### 📊 POST /trace

Generate step-by-step execution trace using GDB.

**Request Body:**

```json
{
  "code": "#include <bits/stdc++.h>\n...",
  "stdin": "[2,7,11,15]\n9",
  "maxSteps": 1000
}
```

**Fields:**

- `code` (string, max 50KB): C++ source code (harnessed code)
- `stdin` (string, optional, max 1MB): Program input
- `maxSteps` (number, optional): Max trace steps (1-10000, default: 5000)

**Response (200):**

```json
{
  "success": true,
  "trace": {
    "steps": [
      {
        "line": 15,
        "event": "step",
        "variables": { "i": 0, "diff": 7 },
        "callStack": ["main"],
        "heap": {}
      }
    ],
    "totalSteps": 142,
    "executionTime": 523
  },
  "duration": 1523
}
```

**Example:**

```bash
curl -X POST http://localhost:4000/api/trace \
  -H "Content-Type: application/json" \
  -d '{"code": "...", "stdin": "[2,7,11,15]\n9", "maxSteps": 500}'
```

---

### 🔒 Security & Rate Limiting

**Rate Limits:**

- Trace: 10 requests/minute (expensive operation)
- Compile/Run: 30 requests/minute
- Problems: 60 requests/minute

**Security Measures:**

- Input validation with Zod schemas
- Code size limits (50KB max)
- Input size limits (1MB max)
- Docker isolation (no network, memory/CPU limits)
- UUID-based binary IDs (prevent path traversal)

**Error Response (429):**

```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 60
}
```

---

### 🔄 Complete Workflow Example

```bash
# 1. Fetch problem details
PROBLEM=$(curl -s "http://localhost:4000/api/problems/two-sum")

# 2. Generate harness from Solution class
HARNESS=$(curl -s -X POST http://localhost:4000/api/harness \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "two-sum",
    "userCode": "class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { unordered_map<int,int> m; for(int i=0; i<nums.size(); i++){ if(m.count(target-nums[i])) return {m[target-nums[i]], i}; m[nums[i]]=i; } return {}; } };",
    "testInput": "[[2,7,11,15], 9]"
  }')

CODE=$(echo $HARNESS | jq -r '.data.harnessedCode')

# 3. Compile the harnessed code
COMPILE=$(curl -s -X POST http://localhost:4000/api/compile \
  -H "Content-Type: application/json" \
  -d "{\"code\": $(echo $CODE | jq -Rs .)}")

BINARY_ID=$(echo $COMPILE | jq -r '.binaryId')

# 4. Run with test input
curl -s -X POST http://localhost:4000/api/run \
  -H "Content-Type: application/json" \
  -d "{\"binaryId\": \"$BINARY_ID\", \"stdin\": \"[[2,7,11,15], 9]\"}"
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0 (JavaScript runtime and package manager)
- [Docker](https://docker.com) & Docker Compose
- [Node.js](https://nodejs.org) >= 20.0.0

### Package Management

This project uses **Bun** as the primary package manager:

```bash
# Install dependencies for all workspaces
bun install

# Add dependency to backend
bun add --cwd backend <package>

# Add dev dependency
bun add --cwd backend --dev <package>
```

For Python dependencies (in executor), use **uv** instead of pip:

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Python dependencies
uv pip install -r executor/requirements.txt
```

### Build Shared Types

```bash
cd shared && bun run build
```

### Run Development Mode

```bash
# Install dependencies for all workspaces
bun install

# Run all workspaces in development mode
bun run dev

# Or run specific workspaces
cd backend && bun run dev    # API server only
cd frontend && bun run dev   # Frontend only (requires backend running)
```

### Frontend Development

The frontend is built with **Vite** + **React** + **TypeScript**:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not done at root)
bun install

# Start development server with hot reload
bun run dev

# Type check
bun run typecheck

# Build for production
bun run build
```

The frontend will be available at http://localhost:3000

**Note**: The frontend expects the backend to be running at http://localhost:4000 (configured via Vite proxy).

### Frontend Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   └── CodeEditor.tsx       # Monaco Editor with line highlighting
│   │   ├── Problem/
│   │   │   ├── ProblemPicker.tsx    # Problem selection with filters
│   │   │   └── TestCases.tsx        # Test case management
│   │   ├── Layout/
│   │   │   └── MainLayout.tsx       # Split-pane layout with visualization
│   │   └── Visualizer/              # Python Tutor-style visualization
│   │       ├── index.ts             # Component exports
│   │       ├── TracePlayback.tsx    # Main trace visualization container
│   │       ├── StackView.tsx        # Call stack visualization
│   │       ├── HeapView.tsx         # Heap objects visualization
│   │       ├── TimelineControls.tsx # Playback controls
│   │       └── VariableDisplay.tsx  # Variable value rendering
│   ├── hooks/
│   │   └── useTracePlayback.ts      # Trace playback state management
│   ├── stores/
│   │   └── editorStore.ts           # Zustand state management
│   ├── services/
│   │   └── api.ts                   # Backend API client
│   ├── types/
│   │   └── index.ts                 # Shared type re-exports
│   ├── App.tsx                      # Root component
│   ├── main.tsx                     # React 18 createRoot setup
│   └── index.css                    # Tailwind CSS directives
├── package.json
├── tsconfig.json
├── vite.config.ts                   # Vite config with proxy
└── Dockerfile
```

## Backend API

The backend provides a RESTful API for code compilation, execution, and trace generation.

### API Endpoints

- `POST /api/compile` - Compile C++ code
- `POST /api/run` - Execute compiled binary
- `POST /api/trace` - Generate execution trace using GDB
- `GET /api/health` - Health check
- `GET /api/problems` - List LeetCode problems (paginated, filterable by difficulty/tags)
- `GET /api/problems/:slug` - Get single problem details from LeetCode
- `POST /api/harness` - Generate C++ harness code for LeetCode problems

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=4000
NODE_ENV=development
EXECUTOR_IMAGE=dsa-visualizer-executor:latest
MAX_COMPILE_TIMEOUT_MS=30000
MAX_RUN_TIMEOUT_MS=5000
MAX_TRACE_STEPS=5000
TEMP_DIR=/tmp/dsa-visualizer
TRACE_RATE_LIMIT=10
COMPILE_RATE_LIMIT=30
CORS_ORIGIN=*
```

### Running Tests

This project uses **Bun's built-in test runner** for all tests.

#### Backend Tests

```bash
cd backend

# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test src/services/__tests__/docker-errors.test.ts
bun test src/middleware/__tests__/errorHandler.test.ts

# Run tests in watch mode
bun test --watch
```

#### Test Coverage

Current test coverage includes:

- **Docker Error Classes** (`docker-errors.test.ts`)
  - `DockerExecutionError`
  - `DockerTimeoutError`
  - `DockerConnectionError`
  - `DockerImageNotFoundError`
  - `DockerOutputLimitError`
  - Type guards for error identification

- **Error Handler Middleware** (`errorHandler.test.ts`)
  - `AppError` base class
  - `ValidationError`
  - `NotFoundError`
  - `RateLimitError`
  - Type guards

#### Frontend Tests

```bash
cd frontend

# Run tests (when configured)
bun test

# Type checking (always available)
bun run typecheck
```

Frontend tests (if configured):

```bash
cd frontend

# Run tests (requires test setup)
bun test

# Type checking (runs successfully)
bun run typecheck
```

### Type Checking

Both frontend and backend have TypeScript type checking:

```bash
# Frontend type check
cd frontend && bun run typecheck

# Backend type check
cd backend && bun run typecheck

# Or from root
bun run --filter frontend typecheck
bun run --filter backend typecheck
```

## Usage Guide

### Running the Application

1. **Start with Docker Compose** (Recommended):

   ```bash
   docker-compose up
   ```

   This starts all services (frontend, backend, executor).

2. **Or run in development mode**:

   ```bash
   # Terminal 1: Start backend
   cd backend && bun run dev

   # Terminal 2: Start frontend
   cd frontend && bun run dev
   ```

   Note: The executor must be running via Docker for trace generation to work.

### Using the Visualizer

1. **Select a Problem**: Use the problem picker dropdown to choose a LeetCode problem
2. **Edit Code**: Write your solution in the Monaco Editor
3. **Test Cases**: Sample test cases are loaded automatically
4. **Run Tests**: Click "Run" to execute all test cases
5. **Trace Execution**: Click "Trace" to generate a step-by-step visualization

### Trace Visualization Controls

**Timeline Navigation**:

- **First**: Jump to the first step
- **Prev**: Go to previous step
- **Next**: Go to next step
- **Last**: Jump to the last step
- **Slider**: Drag to any step in the trace
- **Play/Pause**: Auto-play through steps
- **Speed**: Adjust playback speed (0.5x, 1x, 2x, 4x)

**View Tabs**:

- **Stack**: View call stack with local variables
- **Heap**: View heap-allocated objects (arrays, linked lists, trees)
- **Output**: View program stdout

**Interactive Features**:

- Click on pointer variables to jump to the referenced heap object
- Click on heap objects to highlight them
- Line highlighting in editor synchronized with current step
- Color-coded data structures (lists: green, trees: purple, arrays: blue)

## Architecture

**Frontend**: React-based visualization UI that displays execution traces as animated data structures.

**Backend**: Express API that handles problem fetching, code compilation, and trace generation requests.

**Executor**: Locked-down Docker container that runs user-submitted C++ code under GDB to capture execution traces safely.

## Security

The executor container runs with strict security settings:

- No network access (`network_mode: none`)
- Read-only filesystem with tmpfs for temporary files
- No new privileges allowed (`no-new-privileges`)
- Memory limit: 256MB
- CPU quota: 50% of one CPU core
- Process limit: 50 PIDs
- Non-root user execution (UID 1000)
- Sandboxed GDB-based code execution

### Rate Limiting

The backend implements rate limiting to prevent abuse:

- **Trace endpoint**: 10 requests per minute (expensive GDB operation)
- **Compile/Run endpoints**: 30 requests per minute
- Returns `429 Too Many Requests` with `Retry-After` header when limit exceeded

### Input Validation

All inputs are validated using Zod schemas:

- Code size limit: 50KB
- Input size limit: 1MB
- Max trace steps: 1-10000 (default: 5000)
- Binary ID validation: UUID v4 format (prevents path traversal)

## License

MIT

## Troubleshooting

### Frontend Issues

**Problem**: Monaco Editor not loading

- Check browser console for errors
- Verify Vite dev server is running
- Clear browser cache and reload

**Problem**: API requests failing

- Ensure backend is running on port 4000
- Check CORS configuration in backend
- Verify network tab in browser dev tools

**Problem**: Type errors in IDE

- Run `bun install` in frontend directory
- Run `bun run typecheck` to verify
- Check that shared types are built (`cd shared && bun run build`)

### Backend Issues

**Problem**: Compilation failing

- Check executor Docker container is running: `docker ps | grep executor`
- Verify executor image exists: `docker images | grep dsa-visualizer-executor`
- Check Docker daemon is running

**Problem**: Trace generation failing

- Verify GDB trace collector script exists in executor image
- Check backend logs for detailed error messages
- Ensure trace rate limit not exceeded (10 requests/minute)

**Problem**: Rate limit errors

- Wait for rate limit window to reset (shown in `Retry-After` header)
- Reduce request frequency
- Check logs for rate limit counter

### Docker Issues

**Problem**: Container fails to start

- Check port conflicts: `lsof -i :3000,4000`
- Verify Docker has sufficient resources (memory, CPU)
- Check Docker logs: `docker-compose logs`

**Problem**: Permission errors

- Ensure Docker is running with proper permissions
- Check file permissions in mounted volumes
- Verify UID 1000 has access to temp directories

### Build Issues

#### ❌ Compilation Error: `'vector' does not name a type`

**Problem**: You're trying to compile the Solution class directly without the harness.

```
Error: /workspace/solution.cpp:3:5: error: 'vector' does not name a type
 3 | vector<int> twoSum(vector<int>& nums, int target) {
```

**Solution**: You must use the `/api/harness` endpoint FIRST to wrap your code:

1. **Frontend workflow**: Just write the Solution class and click Run - the frontend automatically calls `/harness` first
2. **API workflow**: Call `/harness` to get complete code, then pass that to `/compile`

```bash
# ❌ Wrong - compiling Solution class directly
curl -X POST http://localhost:4000/api/compile \
  -d '{"code": "class Solution { public: vector<int> twoSum(...) {...} };"}'

# ✅ Correct - generate harness first
HARNESS=$(curl -s -X POST http://localhost:4000/api/harness \
  -H "Content-Type: application/json" \
  -d '{"slug": "two-sum", "userCode": "class Solution {...}", "testInput": "[[2,7,11,15], 9]"}')

CODE=$(echo $HARNESS | jq -r '.data.harnessedCode')

curl -X POST http://localhost:4000/api/compile \
  -H "Content-Type: application/json" \
  -d "{\"code\": $(echo $CODE | jq -Rs .)}"
```

The harness adds:

- `#include <bits/stdc++.h>` (includes vector, string, etc.)
- `using namespace std;`
- Data structures (ListNode, TreeNode)
- main() with input/output handling

#### 🎨 White Text on White Background (Test Cases)

**Fixed**: Test case inputs/outputs now have explicit text colors (`text-gray-900`, `text-red-900`, `text-green-900`).

If you still see white-on-white text:

1. Clear browser cache and hard reload (Ctrl+Shift+R)
2. Check if custom CSS is interfering
3. Verify Tailwind CSS is loaded (check Network tab in DevTools)

#### 🐳 Docker Build Fails: `bun.lock: not found`

**Fixed**: Dockerfiles now work without `bun.lock` - they generate it during build.

If build still fails:

1. Generate lock files locally first:
   ```bash
   cd frontend && bun install
   cd backend && bun install
   ```
2. Or let Docker generate them automatically (slower first build)

#### 🌐 LeetCode API Error 400/502: "Bad Request"

**Cause**: Requested a field that doesn't exist in LeetCode's GraphQL schema.

**Fixed**: Removed invalid `constraints` field from GraphQL query. Constraints are embedded in the `content` HTML.

If you still get errors:

- Check LeetCode API is accessible: `curl https://leetcode.com/graphql`
- Verify problem slug is correct: `two-sum`, not `Two Sum`
- Try a different problem to isolate issue
- Check your IP isn't rate-limited by LeetCode

**Problem**: Bun installation fails

- Ensure Bun >= 1.0.0 is installed: `bun --version`
- Try reinstalling: `curl -fsSL https://bun.sh/install | bash`
- Check Node.js >= 20.0.0 is available

**Problem**: Type generation fails

- Ensure shared workspace is built first
- Run `cd shared && bun run build`
- Check for TypeScript errors: `cd shared && bun run typecheck`

**Problem**: Dependencies not resolving

- Clear node_modules: `rm -rf node_modules`
- Clear Bun cache: `rm -rf ~/.bun/install/cache`
- Reinstall: `bun install`

### Getting Help

- Check GitHub Issues for known problems
- Review backend logs: `docker-compose logs backend`
- Review frontend console in browser dev tools
- Enable debug logging: Set `NODE_ENV=development` in backend `.env`
