#!/bin/bash
# run_traced.sh - Execute a compiled binary under GDB tracing
#
# This script is the main entry point for running C++ code with execution tracing.
# It sets up the environment, runs GDB with the trace_collector.py script,
# and produces a JSON trace file.
#
# Usage:
#   ./run_traced.sh <binary_path> <input_file> <output_trace> [max_steps]
#
# Arguments:
#   binary_path  - Path to compiled C++ executable (must have debug symbols)
#   input_file   - Path to file containing stdin input for the program
#   output_trace - Path where trace.json will be written
#   max_steps    - Optional: Maximum trace steps (default: 1000)
#
# Environment Variables Used:
#   TRACE_OUTPUT   - Same as output_trace argument (overrides if set)
#   TRACE_MAX_STEPS - Same as max_steps argument (overrides if set)
#
# Exit Codes:
#   0 - Success, trace written
#   1 - Binary not found or not executable
#   2 - Input file not found
#   3 - GDB execution failed
#   4 - Trace file not created
#   5 - GDB not installed
#   6 - GDB missing Python support
#
# Example:
#   ./run_traced.sh ./solution input.txt trace.json 500
#
# Security Note:
#   This script should be run inside the Docker container where the binary
#   was compiled. The container provides the sandboxed environment.

set -euo pipefail

# Check if GDB is available
if ! command -v gdb &> /dev/null; then
    echo "Error: GDB is not installed or not in PATH" >&2
    echo "Please install GDB: apt-get install gdb" >&2
    exit 5
fi

# Check if Python support is available in GDB
if ! gdb -batch -ex "python print('Python OK')" &> /dev/null; then
    echo "Error: GDB does not have Python support enabled" >&2
    exit 6
fi

# Print usage information
usage() {
    echo "Usage: $0 <binary_path> <input_file> <output_trace> [max_steps]"
    echo ""
    echo "Arguments:"
    echo "  binary_path   - Path to compiled C++ executable (with debug symbols)"
    echo "  input_file    - Path to file containing stdin input"
    echo "  output_trace  - Path where trace.json will be written"
    echo "  max_steps     - Maximum steps (default: 1000)"
    echo ""
    echo "Environment Variables:"
    echo "  TRACE_OUTPUT    - Override output_trace"
    echo "  TRACE_MAX_STEPS - Override max_steps"
    echo ""
    echo "Example:"
    echo "  $0 ./solution input.txt trace.json 500"
    exit 1
}

# Validate arguments
if [ $# -lt 3 ]; then
    echo "Error: Missing required arguments" >&2
    usage
fi

BINARY_PATH="$1"
INPUT_FILE="$2"
OUTPUT_TRACE="$3"
MAX_STEPS="${4:-1000}"

# Security: Validate environment variables before use
# This prevents injection attacks via environment variable manipulation
validate_env_var() {
    local var_name="$1"
    local var_value="$2"
    # Check for suspicious characters that could indicate injection
    if [[ "$var_value" =~ [;&|<>$\(\)\`\{]] ]]; then
        echo "Error: Invalid characters in $var_name environment variable" >&2
        exit 1
    fi
}

# Validate environment variables if set
if [[ -n "${TRACE_OUTPUT:-}" ]]; then
    validate_env_var "TRACE_OUTPUT" "$TRACE_OUTPUT"
fi

if [[ -n "${TRACE_MAX_STEPS:-}" ]]; then
    validate_env_var "TRACE_MAX_STEPS" "$TRACE_MAX_STEPS"
    # Validate that MAX_STEPS is a number
    if ! [[ "$TRACE_MAX_STEPS" =~ ^[0-9]+$ ]]; then
        echo "Error: TRACE_MAX_STEPS must be a positive integer" >&2
        exit 1
    fi
fi

# Allow environment variables to override arguments
OUTPUT_TRACE="${TRACE_OUTPUT:-$OUTPUT_TRACE}"
MAX_STEPS="${TRACE_MAX_STEPS:-$MAX_STEPS}"

# Security: Validate binary path to prevent path traversal attacks
# Only allow paths within /workspace or relative paths (no .. components)
if [[ "$BINARY_PATH" == *".."* ]]; then
    echo "Error: Binary path contains invalid characters (path traversal attempt)" >&2
    exit 1
fi

# Security: Ensure binary path is absolute or relative to allowed directories
if [[ "$BINARY_PATH" =~ ^/ ]]; then
    # Absolute path - must start with /workspace
    if [[ ! "$BINARY_PATH" =~ ^/workspace ]]; then
        echo "Error: Binary path must be within /workspace directory" >&2
        exit 1
    fi
fi

# Validate binary exists and is executable
if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Binary not found: $BINARY_PATH" >&2
    exit 1
fi

if [ ! -x "$BINARY_PATH" ]; then
    echo "Error: Binary is not executable: $BINARY_PATH" >&2
    exit 1
fi

# Validate input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file not found: $INPUT_FILE" >&2
    exit 2
fi

# Get absolute paths
BINARY_ABS=$(readlink -f "$BINARY_PATH")
INPUT_ABS=$(readlink -f "$INPUT_FILE")
OUTPUT_ABS=$(readlink -f "$OUTPUT_TRACE")

# Ensure output directory exists
OUTPUT_DIR=$(dirname "$OUTPUT_ABS")
if [ ! -d "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
fi

# Check if trace_collector.py exists
TRACE_SCRIPT="/scripts/trace_collector.py"
if [ ! -f "$TRACE_SCRIPT" ]; then
    # Try relative path from current directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TRACE_SCRIPT="$SCRIPT_DIR/trace_collector.py"

    if [ ! -f "$TRACE_SCRIPT" ]; then
        echo "Error: trace_collector.py not found at $TRACE_SCRIPT" >&2
        exit 1
    fi
fi

echo "Running traced execution..."
echo "  Binary: $BINARY_ABS"
echo "  Input: $INPUT_ABS"
echo "  Output: $OUTPUT_ABS"
echo "  Max Steps: $MAX_STEPS"

# Run GDB with tracing
# -batch: Exit after processing commands
# -silent: Suppress copyright message
# -ex "set pagination off": Don't pause for long output
# -ex "set confirm off": Don't ask for confirmation
# -x <script>: Execute Python script for tracing
# --args <program>: Program to debug with its arguments
#
# Note on stdin handling:
# We pass the input file path via STDIN_INPUT_FILE environment variable.
# The trace_collector.py reads this and sets up GDB to redirect stdin.
# Using GDB's "run < input_file" command ensures stdin works correctly
# when the inferior runs under GDB's control.
if ! TRACE_OUTPUT="$OUTPUT_ABS" \
     TRACE_MAX_STEPS="$MAX_STEPS" \
     STDIN_INPUT_FILE="$INPUT_ABS" \
     gdb -batch -silent \
         -ex "set pagination off" \
         -ex "set confirm off" \
         -x "$TRACE_SCRIPT" \
         --args "$BINARY_ABS"; then
    echo "Error: GDB execution failed" >&2
    exit 3
fi

# Verify trace was created
if [ ! -f "$OUTPUT_ABS" ]; then
    echo "Error: Trace file not created: $OUTPUT_ABS" >&2
    exit 4
fi

# Get file size for reporting
FILE_SIZE=$(stat -c%s "$OUTPUT_ABS" 2>/dev/null || stat -f%z "$OUTPUT_ABS" 2>/dev/null || echo "unknown")

echo ""
echo "Trace collection complete!"
echo "  Output: $OUTPUT_ABS"
echo "  Size: $FILE_SIZE bytes"

# Count steps in trace
if command -v python3 &> /dev/null; then
    STEP_COUNT=$(python3 -c "import json; data=json.load(open('$OUTPUT_ABS')); print(len(data.get('steps', [])))" 2>/dev/null || echo "unknown")
    echo "  Steps: $STEP_COUNT"
fi

exit 0
