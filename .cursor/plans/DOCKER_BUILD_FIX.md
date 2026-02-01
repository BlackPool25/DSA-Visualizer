# Docker Build Fix

**Date:** February 1, 2026  
**Issue:** Docker Compose build failing with missing package error

---

## Problem

When running `docker compose up`, the build failed with:

```
error: MissingPackageJSON
note: error occured while resolving @dsa-visualizer/shared
error: @dsa-visualizer/shared@file:../shared failed to resolve
```

---

## Root Cause

The Docker build context for both `backend` and `frontend` was set to their respective subdirectories (`./backend` and `./frontend`). This meant Docker couldn't access the `shared` directory which is outside their build context.

Additionally, the Dockerfiles were trying to `COPY` all files after `bun install`, which would overwrite the `node_modules` directory that was just created, causing file conflicts.

---

## Solution

### 1. Updated Build Context

**Changed `docker-compose.yml`:**

```yaml
# Before:
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile

# After:
backend:
  build:
    context: .
    dockerfile: backend/Dockerfile
```

This gives Docker access to the entire project root, including the `shared` directory.

### 2. Fixed Dockerfile Copy Order

**Changed both `backend/Dockerfile` and `frontend/Dockerfile`:**

The key changes:
1. Copy `shared` directory first and build it
2. Copy source files **before** installing node_modules
3. Then install dependencies

**Backend Dockerfile structure:**
```dockerfile
# 1. Copy and build shared package
COPY shared /shared
WORKDIR /shared
RUN bun install && bun run build

# 2. Back to app directory
WORKDIR /app

# 3. Copy source files FIRST
COPY backend/src ./src
COPY backend/tests ./tests
COPY backend/tsconfig.json ./

# 4. Copy package files
COPY backend/package.json backend/bun.lockb* ./

# 5. Install dependencies (creates node_modules)
RUN bun install
```

This prevents `node_modules` from being overwritten by the source file copy.

### 3. Removed Obsolete Version Field

Removed the `version: '3.8'` field from `docker-compose.yml` as it's obsolete in modern Docker Compose and was causing warnings.

---

## Files Modified

1. **docker-compose.yml**
   - Changed `backend` build context from `./backend` to `.`
   - Changed `frontend` build context from `./frontend` to `.`
   - Updated dockerfile paths to include subdirectory
   - Removed obsolete `version` field

2. **backend/Dockerfile**
   - Added shared package copy and build
   - Reordered COPY commands to copy source before install
   - Updated paths for root build context

3. **frontend/Dockerfile**
   - Added shared directory copy
   - Reordered COPY commands to copy source before install
   - Updated paths for root build context

---

## Verification

**Build Status:**
```bash
✅ Backend:  Built successfully
✅ Frontend: Built successfully
✅ Executor: Built successfully (no changes needed)
```

**Runtime Status:**
```bash
✅ dsa-backend:  Running and healthy
✅ dsa-frontend: Running on port 3000
✅ Health check:  http://localhost:4000/api/health returns OK
```

**Services:**
- Backend API: http://localhost:4000
- Frontend: http://localhost:3000
- Docker connectivity: ✅ Connected (version 29.2.0)

---

## How to Use

```bash
# Build all services
docker compose build

# Start all services in detached mode
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild and restart
docker compose up -d --build
```

---

## Technical Details

### Why the Copy Order Matters

When you run `bun install` after copying `package.json`, Bun creates a `node_modules` directory with:
- Installed packages
- Symlinks (for workspace packages like `@dsa-visualizer/shared`)
- Binary executables

If you then run `COPY . .`, Docker tries to copy everything from the source directory, including any `node_modules` that might exist there. This causes conflicts because:
1. Docker can't replace directories with files
2. Symlinks get broken
3. Installed packages get overwritten with source files

By copying source files **before** `bun install`, we ensure:
1. Source files are in place
2. Then `node_modules` is created fresh
3. No conflicts occur

---

## Lessons Learned

1. **Build Context Matters:** When multiple packages depend on each other, set the build context to a parent directory that includes all dependencies.

2. **Copy Order is Critical:** Always copy source files before running package install commands in Docker.

3. **Monorepo Challenges:** Monorepos require careful Docker setup because dependencies can live outside individual package directories.

4. **Volume Mounts vs Image Layers:** In development, we mount source directories as volumes which override the image layers. This is fine because the volume mount happens at runtime, after the image is built.

---

## Future Improvements

For production builds, consider:
1. Multi-stage builds to reduce image size
2. Separate build and runtime stages
3. Pre-building shared package in a separate stage
4. Using build cache more efficiently with BuildKit

---

## Status

✅ **RESOLVED** - All services now build and run successfully in Docker Compose.
