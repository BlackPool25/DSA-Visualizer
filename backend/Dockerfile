# Backend Dockerfile - Express/TypeScript API server
#
# This Dockerfile creates the backend API container that:
# 1. Serves REST API endpoints for compile, run, and trace operations
# 2. Communicates with the executor container via Docker API
# 3. Orchestrates code compilation and GDB tracing
#
# Uses Bun as the JavaScript runtime for fast startup and execution
#
# Note: In development, shared/ is mounted as a volume (see docker-compose.yml)
# In production, you'd use a multi-stage build or copy shared types

FROM oven/bun:1.1-alpine

# Set working directory
WORKDIR /app

# Install Docker CLI for communicating with executor container
# The backend needs to spawn executor containers via Docker API
RUN apk add --no-cache docker-cli curl

# Copy package files first for better layer caching
COPY package.json bun.lockb* ./

# Install dependencies (will be overwritten by volume mount in dev)
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source code
COPY . .

# Create temp directory for code compilation
RUN mkdir -p /tmp/dsa-visualizer && chmod 777 /tmp/dsa-visualizer

# Expose API port
EXPOSE 4000

# Health check using curl (more reliable than wget in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

# Start the server directly with bun
# Bun can run TypeScript directly without compilation
CMD ["bun", "run", "src/index.ts"]
