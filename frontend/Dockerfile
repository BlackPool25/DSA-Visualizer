# Frontend Dockerfile
#
# Development Dockerfile for the React + Vite frontend
# Provides hot-reload support for local development
#
# Note: For production, use a multi-stage build with nginx

FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Copy shared types (frontend imports from it)
COPY shared /shared

# Copy frontend source code first (before node_modules exists)
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig*.json frontend/tailwind.config.js frontend/postcss.config.js frontend/eslint.config.js ./

# Copy package files
COPY frontend/package.json ./

# Install dependencies using Bun (will generate bun.lock if missing)
RUN bun install

# Expose the Vite dev server port
EXPOSE 3000

# Command to run the development server
CMD ["bun", "run", "dev"]
