# DSA Visualizer

An interactive tool for visualizing Data Structures and Algorithms with step-by-step execution traces powered by GDB.

## Quick Start

Run the entire stack using Docker Compose:

```bash
docker-compose up
```

This will start:
- **Frontend**: React app at http://localhost:3000
- **Backend**: Express API at http://localhost:4000
- **Executor**: Sandboxed C++ execution environment

## Project Structure

```
dsa-visualizer/
├── shared/        # Shared TypeScript types (workspace)
├── backend/       # Express API server (workspace)
├── frontend/      # React frontend (workspace)
├── executor/      # C++ execution sandbox (Docker only)
├── docker-compose.yml
├── package.json
└── README.md
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
# Run all workspaces in development mode
bun run dev

# Or run backend only
cd backend && bun run dev
```

## Backend API

The backend provides a RESTful API for code compilation, execution, and trace generation.

### API Endpoints

- `POST /api/compile` - Compile C++ code
- `POST /api/run` - Execute compiled binary
- `POST /api/trace` - Generate execution trace using GDB
- `GET /api/health` - Health check

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=4000
NODE_ENV=development
EXECUTOR_IMAGE=dsa-visualizer-executor:latest
MAX_COMPILE_TIMEOUT_MS=30000
MAX_RUN_TIMEOUT_MS=5000
MAX_TRACE_STEPS=1000
TEMP_DIR=/tmp/dsa-visualizer
TRACE_RATE_LIMIT=10
COMPILE_RATE_LIMIT=30
CORS_ORIGIN=*
```

### Running Tests

```bash
cd backend

# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/compile.test.ts
```

### Type Checking

```bash
cd backend && bun run typecheck
```

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
- Max trace steps: 1-5000
- Binary ID validation: UUID v4 format (prevents path traversal)

## License

MIT