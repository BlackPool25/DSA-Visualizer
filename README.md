# DSA Visualizer

Interactive C++ data-structure and algorithm visualizer powered by GDB traces.

## What Changed

- Removed LeetCode/problem-picker/harness workflow from the app UI.
- App now focuses on full C++ programs (`#include`, `main()`, stdin) end-to-end.
- Frontend uses only:
  - `POST /api/compile`
  - `POST /api/run`
  - `POST /api/trace`
- Backend route aggregator no longer exposes `/api/problems` or `/api/harness`.

## UI Overview

- **Top bar**: `DSA Visualizer` title, `C++ · GDB` badge, Settings, Run, Trace.
- **Left panel**:
  - Monaco C++ editor with current-line trace highlighting.
  - `stdin` textarea for optional input.
  - Inline compile errors + status/output strips.
- **Right panel**:
  - Trace tabs: Stack, Heap, Output.
  - Timeline controls pinned to bottom with keyboard stepping.

## Settings

Persisted in `localStorage` key `dsa-settings`:

- Backend URL (default `http://localhost:4000`)
- Max trace steps (1-5000, default 1000)
- Auto-play speed (0.5x, 1x, 2x, 4x)
- Editor theme (dark/light)

## Run Flow

1. Compile with full source:
   `POST /api/compile { code, compiler?, flags? }`
2. If successful, run binary:
   `POST /api/run { binaryId, stdin? }`
3. Show stdout/stderr/exit code in left-side result panel.
4. If compile fails, errors appear inline and are clickable to focus Monaco line.

## Trace Flow

1. Request trace:
   `POST /api/trace { code, stdin?, maxSteps? }`
2. Load returned trace into Stack/Heap/Output tabs.
3. Timeline initializes at step 0, paused.
4. Keyboard shortcuts:
   - Left Arrow: previous step
   - Right Arrow: next step
   - Space: play/pause

## Development

### Prerequisites

- Bun
- Docker + Docker Compose

### Start

```bash
./build.sh
./start.sh
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

### Local Frontend

```bash
cd frontend
bun install
bun run dev
```

### Local Backend

```bash
cd backend
bun install
bun run dev
```

## API Contract

```json
POST /api/compile { "code": "...", "compiler": "g++", "flags": [] }
→ { "success": true, "binaryId": "...", "duration": 123 }
```

```json
POST /api/run { "binaryId": "...", "stdin": "1 2 3" }
→ { "success": true, "stdout": "...", "stderr": "", "exitCode": 0, "duration": 20 }
```

```json
POST /api/trace { "code": "...", "stdin": "", "maxSteps": 1000 }
→ { "success": true, "trace": { "steps": [], "totalSteps": 0, "executionTime": 0 }, "duration": 350 }
```

## Notes

- Backend compile/run/trace endpoints are unchanged.
- Executor sandboxing, rate limiting, and Docker isolation remain intact.
