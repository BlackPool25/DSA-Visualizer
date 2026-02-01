"""
trace_collector.py - GDB Python script for step-by-step execution tracing.

This script is loaded by GDB to capture program state at each execution step.
It hooks into GDB's stop events, extracts variable values from stack frames,
and serializes the complete execution trace to JSON.

Usage:
    gdb -batch -silent -x trace_collector.py --args ./solution

Environment Variables:
    TRACE_OUTPUT - Path to write trace.json (default: trace.json)
    TRACE_MAX_STEPS - Maximum steps before stopping (default: 1000)

Output Format:
    Writes a JSON array of TraceStep objects to the output file:
    [
        {
            "stepIndex": 0,
            "line": 10,
            "file": "solution.cpp",
            "event": "line",
            "callStack": [...],
            "heap": {...},
            "stdout": ""
        },
        ...
    ]

Execution Flow:
    1. GDB loads this script via -x flag
    2. TraceCollector class registers stop event handler with gdb.events.stop
    3. Sets breakpoint at main() and runs the program
    4. Each time execution stops (on a line, breakpoint, etc.):
       a. stop_handler is called by GDB
       b. Capture state with capture_state()
       c. Append to trace list
       d. Execute 'next' command to step (not 'step' - avoids STL internals)
    5. When program exits or max_steps reached, write trace to output file

Important: Using 'next' vs 'step'
    - 'next' (next line): Steps OVER function calls
    - 'step' (step into): Steps INTO functions (including STL internals)
    We use 'next' to avoid getting lost in libstdc++ implementation details.
    This means calls to push_back(), etc. appear as single steps.

GDB Python Environment:
    - This script runs inside GDB's embedded Python interpreter
    - Standard library is available but not pip packages
    - Only the 'gdb' module is special (provided by GDB)
"""

# Add script directory to Python path so GDB can find our modules
# When running in Docker, /scripts is the correct path
# When running locally, we use the script's directory
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
# Also try /scripts for Docker compatibility
if os.path.exists("/scripts"):
    sys.path.insert(0, "/scripts")

import gdb
import json
import os
import sys
from typing import Any, Dict, List, Optional
from value_serializer import serialize_value


class TraceCollector:
    """
    Collects execution trace by stepping through program and capturing state.

    This class manages the entire tracing lifecycle:
    - Registers event handlers with GDB
    - Captures program state at each stop
    - Tracks heap objects for visualization
    - Writes final trace to JSON file

    Attributes:
        trace: List of trace steps collected so far
        heap: Dictionary mapping addresses to heap objects
        max_steps: Maximum steps before stopping (prevents infinite loops)
        step_count: Current step number
        output_file: Path to write trace JSON
        stdout_buffer: Accumulated stdout from the inferior
        stdout_file: Temporary file path for capturing stdout
    """

    def __init__(self, output_file: str = "trace.json", max_steps: int = 1000):
        """
        Initialize the trace collector.

        Args:
            output_file: Path where trace.json will be written
            max_steps: Maximum number of steps to record (safety limit)
        """
        self.trace: List[Dict[str, Any]] = []
        self.heap: Dict[str, Any] = {}
        self.max_steps = max_steps
        self.step_count = 0
        self.output_file = output_file
        self.stdout_buffer = ""
        self.stdout_file = "/tmp/gdb_stdout_capture.txt"
        self._stop_event_connection = None

    def stop_handler(self, event) -> None:
        """
        Called by GDB when execution stops (breakpoint, step, signal, etc.).

        This is the core callback that captures state at each execution point.
        We capture the current state, add it to the trace, then continue execution.

        Args:
            event: GDB StopEvent object with information about why we stopped

        Note:
            GDB frames become invalid after the inferior continues execution.
            We must capture all needed data from frames before calling gdb.execute().
        """
        # Check if we've reached the step limit
        if self.step_count >= self.max_steps:
            print(f"Reached max steps ({self.max_steps}), stopping trace collection")
            return

        try:
            # Read any new stdout from the inferior before capturing state
            self.read_stdout()

            # Capture current program state
            state = self.capture_state()
            self.trace.append(state)
            self.step_count += 1

            # Continue execution with 'next' (step over, not into)
            # This keeps us at the user code level, avoiding STL internals
            if not self.step_once():
                # Program has exited
                self.write_trace()

        except gdb.error as e:
            # GDB error (e.g., program exited, frame invalid)
            print(f"GDB error during trace: {e}")
            self.write_trace()
        except Exception as e:
            # Unexpected error - still try to write what we have
            print(f"Unexpected error during trace: {e}")
            import traceback

            traceback.print_exc()
            self.write_trace()

    def capture_state(self) -> Dict[str, Any]:
        """
        Captures complete program state at current execution point.

        Returns a TraceStep dictionary containing:
        - stepIndex: Sequential step number
        - line: Current source line number
        - file: Source file path
        - event: Type of event (line, breakpoint, etc.)
        - callStack: All stack frames with local variables
        - heap: All tracked heap objects (linked list nodes, tree nodes, etc.)
        - stdout: Accumulated output from the program

        Returns:
            Dictionary matching the frontend TraceStep interface

        Note:
            We capture all frames by walking up the call stack from the selected frame.
            Each frame's local variables are serialized using value_serializer.
        """
        try:
            # Get current frame info
            frame = gdb.selected_frame()
            sal = frame.find_sal()  # Symtab and line info

            line = sal.line if sal.line else 0
            filename = sal.symtab.filename if sal.symtab else "unknown"

            # Capture call stack (all frames)
            call_stack = []
            current_frame = frame
            frame_idx = 0

            while current_frame is not None:
                try:
                    frame_data = self.capture_frame(current_frame, frame_idx)
                    call_stack.append(frame_data)
                    frame_idx += 1
                    current_frame = current_frame.older()
                except gdb.error:
                    # Frame might be invalid or unwinding failed
                    break

            # Build the trace step
            trace_step = {
                "stepIndex": self.step_count,
                "line": line,
                "file": filename,
                "event": "line",  # Could be enhanced to detect breakpoints, etc.
                "callStack": call_stack,
                "heap": self.heap,
                "stdout": self.stdout_buffer,
            }

            return trace_step

        except gdb.error as e:
            # Return error state if we can't capture
            return {
                "stepIndex": self.step_count,
                "line": 0,
                "file": "error",
                "event": "error",
                "error": str(e),
                "callStack": [],
                "heap": self.heap,
                "stdout": self.stdout_buffer,
            }

    def capture_frame(self, frame: gdb.Frame, frame_idx: int) -> Dict[str, Any]:
        """
                Captures the state of a single stack frame.

                Extracts all local variables from the frame and converts them
        to JSON-serializable format using value_serializer.

                Args:
                    frame: A GDB Frame object representing a stack frame.
                           Access via gdb.selected_frame() or frame iteration.
                    frame_idx: Index of this frame in the call stack (0 = top)

                Returns:
                    A dictionary matching the StackFrame TypeScript interface:
                    {
                        "frameId": str,      # Unique identifier for this frame
                        "function": str,     # Function name
                        "file": str,         # Source file path
                        "line": int,         # Current line number
                        "locals": dict       # Map of variable name to Value
                    }

                Raises:
                    gdb.error: If frame is invalid or has been unwound.

                Note:
                    GDB frames become invalid after the inferior continues.
                    Always capture needed data before any gdb.execute() calls.
        """
        try:
            # Get frame info
            function_name = frame.name() or "unknown"
            sal = frame.find_sal()
            file_name = sal.symtab.filename if sal.symtab else "unknown"
            line_num = sal.line if sal.line else 0

            # Get local variables in this frame
            locals_dict = {}
            visited = set()  # For cycle detection in pointers

            try:
                # Get block (scope) for this frame
                block = frame.block()

                # Iterate through all symbols in the block
                for symbol in block:
                    if symbol.is_argument or symbol.is_variable:
                        name = symbol.name
                        try:
                            # Read the variable's value
                            val = frame.read_var(name)
                            # Serialize to JSON
                            locals_dict[name] = serialize_value(val, self.heap, visited)
                        except gdb.error as e:
                            # Variable might be optimized out or not yet initialized
                            locals_dict[name] = {
                                "kind": "error",
                                "error": f"Could not read variable: {str(e)}",
                            }
            except gdb.error:
                # Block might not be available
                pass

            return {
                "frameId": f"frame_{frame_idx}",
                "function": function_name,
                "file": file_name,
                "line": line_num,
                "locals": locals_dict,
            }

        except gdb.error as e:
            return {
                "frameId": f"frame_{frame_idx}",
                "function": "error",
                "file": "error",
                "line": 0,
                "error": str(e),
                "locals": {},
            }

    def step_once(self) -> bool:
        """
        Execute one step, staying at user code level.

        Uses 'next' instead of 'step' to avoid entering library functions.
        This means we step OVER calls to push_back, etc., not INTO them.

        Returns:
            True if step succeeded, False if program exited or hit error.

        Note:
            'next' in GDB steps to the next line of code, stepping over function calls.
            'step' would step INTO functions, including STL implementation details.
            We use 'next' to keep the trace focused on user code.
        """
        try:
            # 'next' steps over function calls
            # 'step' would step INTO functions (including STL)
            gdb.execute("next", to_string=True)
            return True
        except gdb.error:
            # Program has exited or other GDB error
            return False

    def write_trace(self) -> None:
        """
        Write the collected trace to the output file.

        Serializes the trace to JSON in the format expected by the backend:
        {
            "steps": [...],
            "totalSteps": N,
            "executionTime": M
        }

        Note:
            We use a try-except block to ensure we always attempt to write,
            even if there were errors during collection.
        """
        try:
            import time

            # Calculate execution time (approximate - from first to last step)
            execution_time = 0
            if hasattr(self, "_start_time"):
                execution_time = int((time.time() - self._start_time) * 1000)

            # Format output to match backend Zod schema (FullTraceSchema)
            output = {
                "steps": self.trace,
                "totalSteps": len(self.trace),
                "executionTime": execution_time,
            }

            with open(self.output_file, "w") as f:
                json.dump(output, f, indent=2)
            print(f"Trace written to {self.output_file} ({len(self.trace)} steps)")
        except Exception as e:
            print(f"Error writing trace file: {e}")
            import traceback

            traceback.print_exc()

    def setup_stdout_capture(self) -> None:
        """
        Set up stdout capture by creating a fresh output file.

        We'll redirect the inferior's stdout using the 'run' command with
        shell redirection. This separates the inferior's output from GDB's
        internal messages.

        Note:
            This must be called before running the program to capture all output.
            The output file is read after each step to populate the stdout field.
        """
        try:
            # Remove any existing output file to start fresh
            import os

            if os.path.exists(self.stdout_file):
                os.remove(self.stdout_file)
            
            # Create empty file
            open(self.stdout_file, 'w').close()
        except Exception as e:
            print(f"Warning: Could not set up stdout file: {e}")

    def read_stdout(self) -> str:
        """
        Read accumulated stdout from the output file.

        This reads the complete output from the inferior process.
        The file is populated by the inferior as it runs, thanks to
        the shell redirection in the 'run' command.

        Returns:
            New output since the last read.

        Note:
            We read the entire file and track what we've seen to maintain
            cumulative output. Each step's stdout field contains all output
            produced up to that point in execution.
        """
        try:
            import os

            if os.path.exists(self.stdout_file):
                with open(self.stdout_file, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                # Update buffer with complete content
                # The trace step will get the complete buffer (cumulative output)
                if len(content) > len(self.stdout_buffer):
                    new_content = content[len(self.stdout_buffer) :]
                    self.stdout_buffer = content
                    return new_content
            return ""
        except Exception as e:
            print(f"Warning: Could not read stdout: {e}")
            return ""

    def run(self) -> None:
        """
        Main entry point. Sets up tracing and runs the program.

        Execution sequence:
        1. Register stop event handler with gdb.events.stop
        2. Set up stdout capture via GDB logging
        3. Set breakpoint at main() to start tracing from the beginning
        4. Run the program (will hit main breakpoint)
        5. Continue execution, stop_handler will be called at each step
        6. When program exits, write_trace() is called automatically

        Note:
            This method blocks until the program finishes or max_steps is reached.
            GDB must be started with the target program already loaded.
        """
        import time

        self._start_time = time.time()  # Track execution time for output

        try:
            # Register our stop handler with GDB
            # GDB will call this function whenever execution stops
            self._stop_event_connection = gdb.events.stop.connect(self.stop_handler)

            # Set up GDB environment
            gdb.execute("set pagination off")  # Don't pause for long output
            gdb.execute("set confirm off")  # Don't ask for confirmation
            gdb.execute("set print null-stop")  # Stop at null in strings

            # Set up stdout capture before running
            self.setup_stdout_capture()

            # Set breakpoint at main to start tracing from the beginning
            gdb.execute("break main")

            # Run the program - will stop at main breakpoint
            # Redirect stdout to capture file, and stdin if provided
            print("Starting trace collection...")
            input_file = os.environ.get("STDIN_INPUT_FILE", "")

            # Build run command with redirections
            # We use shell redirection to capture the inferior's output separately from GDB's output
            run_cmd = "run"
            if input_file and os.path.exists(input_file):
                run_cmd += f" < {input_file}"
            # Redirect stdout to capture file (use > for initial write, not >>)
            # This ensures we capture only the inferior's output, not GDB messages
            run_cmd += f" > {self.stdout_file} 2>&1"

            gdb.execute(run_cmd)

            # After run() returns, the program has exited
            # Write any remaining trace data
            self.write_trace()

        except Exception as e:
            print(f"Error during trace collection: {e}")
            import traceback

            traceback.print_exc()
            self.write_trace()
        finally:
            # Clean up event handler and logging
            if self._stop_event_connection:
                gdb.events.stop.disconnect(self._stop_event_connection)
            try:
                gdb.execute("set logging enabled off")
            except:
                pass


def main():
    """
    Entry point when GDB loads this script.

    Parses environment variables for configuration:
    - TRACE_OUTPUT: Output file path (default: trace.json)
    - TRACE_MAX_STEPS: Maximum steps (default: 1000)

    Usage:
        TRACE_OUTPUT=/tmp/trace.json TRACE_MAX_STEPS=500 \
            gdb -batch -silent -x trace_collector.py --args ./program
    """
    # Parse configuration from environment variables
    output_file = os.environ.get("TRACE_OUTPUT", "trace.json")
    max_steps = int(os.environ.get("TRACE_MAX_STEPS", "1000"))

    print(f"Trace collector starting...")
    print(f"Output file: {output_file}")
    print(f"Max steps: {max_steps}")

    # Create and run the collector
    collector = TraceCollector(output_file, max_steps)
    collector.run()


# GDB loads this script and executes it
# The main() function starts the tracing process
if __name__ == "__main__":
    main()
