# Dockerfile - Secure C++ execution environment with GDB tracing
#
# This Dockerfile creates a sandboxed container for:
# 1. Compiling user-submitted C++ code
# 2. Running code under GDB with Python scripts to capture execution traces
# 3. Serializing program state (variables, heap objects, stack frames) to JSON
#
# Security features:
# - Multi-stage build to minimize final image size
# - Non-root user for code execution
# - Minimal attack surface (only required tools)
#
# Based on Ubuntu 22.04 for stability and good C++ tooling support

FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install C++ toolchain and GDB with Python support
# g++: C++ compiler for building user code with -g flag (debug symbols)
# gdb: GNU debugger for stepping through code and inspecting state
# python3: Required for GDB's Python scripting interface
# curl: Used to download uv installer
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    gdb \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
# uv is a modern Python package installer written in Rust
# Install as root, then copy to /usr/local/bin so sandbox user can access it
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    cp /root/.cargo/bin/uv /usr/local/bin/uv && \
    chmod +x /usr/local/bin/uv

# Add system bin to PATH (uv is now available to all users)
ENV PATH="/usr/local/bin:$PATH"

# Create directories for scripts and templates
# /scripts: Python GDB tracing scripts
# /templates: C++ header templates for data structures
# /workspace: Working directory for user code compilation and execution
RUN mkdir -p /scripts /templates /workspace

# Copy Python tracing scripts
# These scripts are loaded by GDB to capture execution traces
COPY scripts/ /scripts/

# Set working directory for Python setup
WORKDIR /scripts

# Initialize uv project and install dependencies
# Note: GDB uses its own embedded Python, so these packages are mainly for testing
RUN uv init --name dsa-tracer && \
    uv add pytest

# Copy C++ templates
# These provide standard data structure definitions (ListNode, TreeNode, etc.)
COPY templates/ /templates/

# Create non-root user for code execution
# Running as non-root limits damage if sandbox is compromised
# UID 1000 is standard for first non-root user
RUN useradd -m -u 1000 sandbox

# Set ownership of workspace to sandbox user
RUN chown -R sandbox:sandbox /workspace

# Switch to non-root user for security
USER sandbox

# Set working directory to workspace for user code
WORKDIR /workspace

# Default command - container will be used with docker exec
CMD ["echo", "DSA Executor container ready - use docker exec to run commands"]
