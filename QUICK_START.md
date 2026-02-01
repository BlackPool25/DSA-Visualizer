# DSA Visualizer - Quick Start Guide

**Status:** ✅ **READY TO USE**  
**Date:** February 1, 2026

---

## 🚀 Getting Started (3 Simple Steps)

### 1. Start the Application

```bash
# From the project root
docker compose up -d
```

That's it! All services will start in detached mode.

### 2. Access the Application

- **Frontend (React UI):** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Health Check:** http://localhost:4000/api/health

### 3. Try It Out

1. Open http://localhost:3000 in your browser
2. Select a LeetCode problem from the dropdown
3. Write or edit your C++ solution
4. Click **Run** to execute or **Trace** to visualize

---

## 📋 Available Commands

### Docker Compose

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build

# Check service status
docker compose ps
```

### Development (without Docker)

**Backend:**
```bash
cd backend
bun install
bun run dev    # Starts on port 4000
```

**Frontend:**
```bash
cd frontend
bun install
bun run dev    # Starts on port 3000
```

**Executor (testing):**
```bash
cd executor
uv run pytest tests/ -v   # Run all tests
```

---

## 🔍 Verify Installation

### Check Services

```bash
# Should show 3 running containers
docker compose ps

# Check backend health
curl http://localhost:4000/api/health

# Check frontend is serving
curl -I http://localhost:3000
```

### Expected Output

**Backend Health Check:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-01T11:54:06.888Z",
  "uptime": 10.769323983,
  "docker": {
    "connected": true,
    "version": "29.2.0"
  }
}
```

**Docker Compose Status:**
```
NAME           STATUS                   PORTS
dsa-backend    Up (healthy)             0.0.0.0:4000->4000/tcp
dsa-frontend   Up                       0.0.0.0:3000->3000/tcp
dsa-executor   Exited (0)              
```

Note: The executor container exits immediately after printing "Executor image built successfully" - this is expected. The backend spawns new executor containers dynamically for each code execution.

---

## 🎯 What Can You Do?

### Current Features (Phases 1-4 Complete)

✅ **LeetCode Integration**
- Fetch real problems from LeetCode
- Filter by difficulty (Easy/Medium/Hard)
- Filter by topic tags
- View problem descriptions

✅ **Code Editor**
- Monaco Editor with C++ syntax highlighting
- Auto-completion and error detection
- Dark theme

✅ **Code Execution**
- Compile C++ code in secure Docker sandbox
- Run with test inputs
- See stdout, stderr, and exit codes

✅ **GDB Tracing**
- Step-by-step execution tracing
- Variable state capture at each step
- STL container serialization
- Call stack tracking

✅ **Test Case Management**
- Add custom test cases
- Run individual or all test cases
- Pass/fail indicators

### Coming Soon (Phase 5)

⏳ **Visualization Engine**
- Array visualization with animations
- Linked list rendering
- Binary tree display
- Playback controls (play, pause, step)

---

## 🛠️ API Endpoints

### Problems

```bash
# List problems (paginated)
GET /api/problems?page=1&pageSize=20&difficulty=Easy&tags=array,hash-table

# Get specific problem
GET /api/problems/two-sum
```

### Code Execution

```bash
# Compile code
POST /api/compile
Content-Type: application/json
{
  "code": "int main() { return 0; }",
  "language": "cpp"
}

# Run compiled code
POST /api/run
Content-Type: application/json
{
  "binaryId": "uuid-here",
  "stdin": "input data"
}

# Generate execution trace
POST /api/trace
Content-Type: application/json
{
  "code": "int main() { int x = 5; return 0; }",
  "stdin": "",
  "maxSteps": 100
}
```

### Harness Generation

```bash
# Generate test harness for LeetCode problem
POST /api/harness
Content-Type: application/json
{
  "problemSlug": "two-sum",
  "userCode": "class Solution { ... }",
  "testInput": "[2,7,11,15]\n9"
}
```

---

## 🔒 Security Features

All code execution happens in a secure Docker container with:

- **No network access** - Container is isolated from the internet
- **Memory limit** - 256MB max
- **CPU limit** - 50% of one core
- **Process limit** - Max 50 processes
- **Time limit** - 3 seconds execution timeout
- **Read-only filesystem** - Where possible
- **No privilege escalation** - Security options enforced

---

## 📁 Project Structure

```
DSA-Visualiser/
├── frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── stores/      # Zustand state
│   │   └── services/    # API client
│   └── package.json
├── backend/           # Express + TypeScript
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── middleware/  # Express middleware
│   └── package.json
├── executor/          # Docker execution environment
│   ├── scripts/         # GDB tracing scripts
│   ├── templates/       # C++ templates
│   └── Dockerfile
├── shared/            # Shared TypeScript types
│   └── types/
└── docker-compose.yml
```

---

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker ps

# Rebuild images
docker compose build

# View logs
docker compose logs
```

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :4000

# Kill the process or change ports in docker-compose.yml
```

### Frontend Can't Connect to Backend

Check environment variables in `docker-compose.yml`:
```yaml
frontend:
  environment:
    - VITE_API_URL=http://localhost:4000
```

### Executor Issues

```bash
# Check executor image exists
docker images | grep executor

# Rebuild executor
docker compose build executor

# Test executor directly
docker run --rm dsa-visualiser-executor echo "Test"
```

---

## 📊 System Requirements

- **Docker:** 20.10+ (with Docker Compose V2)
- **Bun:** 1.0+ (for local development)
- **uv:** Latest (for Python executor tests)
- **Memory:** 2GB+ available
- **Disk:** 5GB+ for Docker images

---

## 🎓 Development Workflow

### Making Changes

**Frontend:**
1. Edit files in `frontend/src/`
2. Changes auto-reload (hot module replacement)
3. Build for production: `bun run build`

**Backend:**
1. Edit files in `backend/src/`
2. Server auto-restarts (nodemon/bun watch)
3. Type check: `bun run typecheck`

**Executor:**
1. Edit scripts in `executor/scripts/`
2. Rebuild image: `docker compose build executor`
3. Test: `uv run pytest tests/`

### Running Tests

```bash
# Backend (when tests are added)
cd backend && bun test

# Frontend (when tests are added)
cd frontend && bun test

# Executor
cd executor && uv run pytest tests/ -v

# Type check everything
bun run typecheck  # From root
```

---

## 📚 Documentation

- **Implementation Status:** `.cursor/plans/IMPLEMENTATION_STATUS.md`
- **Fixes Applied:** `.cursor/plans/FIXES_APPLIED.md`
- **Docker Fix:** `.cursor/plans/DOCKER_BUILD_FIX.md`
- **Original Plan:** `.cursor/plans/dsa_visualizer_build_plan_ababc986.plan.md`

---

## ✨ What's Next?

**Phase 5: Visualization Engine**

The next step is to add D3.js visualizations:
- Array animations
- Linked list rendering with arrows
- Binary tree layout
- Playback timeline
- Step-by-step controls

See the original plan for detailed specifications.

---

## 🤝 Contributing

1. Make changes in your local environment
2. Test locally with Docker Compose
3. Ensure TypeScript checks pass: `bun run typecheck`
4. Ensure tests pass (executor): `uv run pytest tests/`
5. Document any new features

---

## 📞 Quick Reference

| What | Command |
|------|---------|
| Start everything | `docker compose up -d` |
| Stop everything | `docker compose down` |
| View logs | `docker compose logs -f` |
| Rebuild | `docker compose up -d --build` |
| Health check | `curl http://localhost:4000/api/health` |
| Type check | `bun run typecheck` |
| Test executor | `cd executor && uv run pytest tests/ -v` |

---

**Status:** ✅ All systems operational  
**Ready for:** Phase 5 (Visualization Engine)  
**Last Updated:** February 1, 2026
