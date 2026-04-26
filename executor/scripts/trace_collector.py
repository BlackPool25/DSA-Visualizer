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
"""

import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
if os.path.exists("/scripts"):
    sys.path.insert(0, "/scripts")

import gdb
import json
from typing import Any, Dict, List

# Import the value serializer for capturing variable values
from value_serializer import serialize_value


# Global state for trace collection - using globals works correctly with GDB's event system
_max_steps: int = 1000
_step_count: int = 0
_output_file: str = "trace.json"
_start_time: float = 0
_stdout_file: str = "/workspace/stdout.txt"
_stderr_file: str = "/workspace/stderr.txt"
_trace_steps_file: str = "/workspace/trace_steps.jsonl"
_max_stack_frames: int = 24
_max_locals_per_frame: int = 40
_max_stdout_chars: int = 4096
_last_frame_locals: Dict[str, Dict[str, Any]] = {}

def _read_text_file(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return ""

def _is_user_source_path(fullname: str, filename: str) -> bool:
    """
    Recognize user source in common GDB formats:
    - /workspace/solution.cpp
    - solution.cpp
    """
    if fullname and fullname.endswith("/solution.cpp"):
        return True
    if filename == "solution.cpp":
        return True
    return False

def is_library_frame(frame: gdb.Frame) -> bool:
    """Return True when frame is from STL/runtime internals."""
    try:
        name = frame.name() or ""
        if (
            name.startswith("std::")
            or name.startswith("__gnu_cxx::")
            or name.startswith("__libc")
            or name.startswith("pthread_")
            or name.startswith("_")
        ):
            return True

        sal = frame.find_sal()
        if not sal or not sal.symtab:
            # Frames without source mapping are almost always runtime internals.
            return True
        if sal and sal.symtab:
            full = sal.symtab.fullname() or ""
            filename = sal.symtab.filename or ""
            if not _is_user_source_path(full, filename):
                # Files from system headers/runtime should be considered non-user.
                return True
    except Exception:
        return True
    return False


def capture_frame(frame: gdb.Frame, idx: int, step_heap: Dict[str, Any]) -> Dict[str, Any]:
    """Capture state of a single stack frame."""
    try:
        func_name = frame.name() or "unknown"
        sal = frame.find_sal()
        
        # Get local variables
        locals_dict: Dict[str, Any] = {}
        locals_seen = 0
        frame_visited = set()
        try:
            block = frame.block()
            # Capture current block + immediate parent block. This includes function
            # arguments like vector<int>& arr without walking deep into internal scopes.
            levels = 0
            while block and levels < 2:
                for symbol in block:
                    if locals_seen >= _max_locals_per_frame:
                        break
                    if symbol.is_variable or symbol.is_argument:
                        name = symbol.name
                        if (
                            name not in locals_dict
                            and not name.startswith("_")
                            and "::" not in name
                        ):
                            try:
                                value = frame.read_var(symbol)
                                serialized = serialize_value(value, step_heap, frame_visited)
                                if serialized is not None:
                                    locals_dict[name] = serialized
                                    locals_seen += 1
                            except:
                                pass
                if locals_seen >= _max_locals_per_frame:
                    break
                block = block.superblock
                levels += 1
        except:
            pass
        
        frame_key = f"{idx}:{func_name}"
        cached = _last_frame_locals.get(frame_key, {})
        merged_locals = dict(cached)
        merged_locals.update(locals_dict)
        _last_frame_locals[frame_key] = merged_locals

        return {
            "frameId": f"frame_{idx}",
            "function": func_name,
            "file": sal.symtab.filename if sal.symtab else "unknown",
            "line": sal.line if sal.line else 0,
            "locals": merged_locals,
        }
    except gdb.error as e:
        return {
            "frameId": f"frame_{idx}",
            "function": "error",
            "file": "error",
            "line": 0,
            "error": str(e),
            "locals": {},
        }


def capture_state() -> Dict[str, Any]:
    """Capture complete program state at current execution point."""
    global _step_count
    
    try:
        frame = gdb.selected_frame()
        sal = frame.find_sal()
        
        # Step-local heap snapshot. Do not accumulate across steps.
        step_heap: Dict[str, Any] = {}

        # Build call stack (user frames only)
        call_stack = []
        current = frame
        idx = 0
        primary_user_sal = None
        while current:
            try:
                if not is_library_frame(current):
                    call_stack.append(capture_frame(current, idx, step_heap))
                    if primary_user_sal is None:
                        primary_user_sal = current.find_sal()
                    idx += 1
                    if idx >= _max_stack_frames:
                        break
                current = current.older()
            except:
                break

        # Skip state if we are not in user code.
        if primary_user_sal is None:
            return None
        
        current_stdout = _read_text_file(_stdout_file)
        if len(current_stdout) > _max_stdout_chars:
            current_stdout = current_stdout[-_max_stdout_chars:]

        return {
            "stepIndex": _step_count,
            "line": primary_user_sal.line if primary_user_sal.line else 0,
            "file": primary_user_sal.symtab.filename if primary_user_sal.symtab else "unknown",
            "event": "line",
            "callStack": call_stack,
            "heap": step_heap,
            "stdout": current_stdout,
        }
    except Exception as e:
        return {
            "stepIndex": _step_count,
            "line": 0,
            "file": "unknown",
            "event": "error",
            "callStack": [],
            "heap": {},
            "stdout": _read_text_file(_stdout_file),
            "error": str(e),
        }


def stop_handler(event) -> None:
    """Called by GDB when execution stops. Captures state and steps."""
    global _step_count, _max_steps
    
    if _step_count >= _max_steps:
        return
    
    try:
        selected = gdb.selected_frame()

        # If currently in STL/runtime internals, jump back to caller frame.
        if is_library_frame(selected):
            try:
                gdb.execute("finish", to_string=True)
            except gdb.error:
                pass
            return

        # Capture current program state
        state = capture_state()
        if state is not None:
            # Stream each step to disk immediately to avoid unbounded memory growth.
            with open(_trace_steps_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(state))
                f.write("\n")
            _step_count += 1
        
        # Step to next line
        try:
            gdb.execute("step", to_string=True)
        except gdb.error:
            # Program exited
            pass
    except Exception as e:
        print(f"Error in stop_handler: {e}")


def write_trace() -> None:
    """Write collected trace to output file."""
    global _output_file, _start_time, _trace_steps_file, _step_count
    
    import time
    execution_time = int((time.time() - _start_time) * 1000)
    
    try:
        with open(_output_file, "w", encoding="utf-8") as out:
            out.write('{"steps":[')
            first = True
            if os.path.exists(_trace_steps_file):
                with open(_trace_steps_file, "r", encoding="utf-8", errors="replace") as steps:
                    for line in steps:
                        line = line.strip()
                        if not line:
                            continue
                        if not first:
                            out.write(",")
                        out.write(line)
                        first = False
            out.write(f'],"totalSteps":{_step_count},"executionTime":{execution_time}' + "}")
        print(f"Trace written to {_output_file} ({_step_count} steps)")
    except Exception as e:
        print(f"Error writing trace: {e}")


def run() -> None:
    """Main entry point - sets up GDB and runs the trace collection."""
    global _output_file, _max_steps, _start_time, _stdout_file, _stderr_file, _trace_steps_file, _step_count, _last_frame_locals
    
    import time
    _start_time = time.time()
    
    # Get configuration from environment
    _output_file = os.environ.get("TRACE_OUTPUT", "trace.json")
    _max_steps = int(os.environ.get("TRACE_MAX_STEPS", "1000"))
    _stdout_file = os.environ.get("TRACE_STDOUT_FILE", "/workspace/stdout.txt")
    _stderr_file = os.environ.get("TRACE_STDERR_FILE", "/workspace/stderr.txt")
    _trace_steps_file = os.environ.get("TRACE_STEPS_FILE", "/workspace/trace_steps.jsonl")
    _step_count = 0
    _last_frame_locals = {}

    # Start with a clean step stream file.
    try:
        if os.path.exists(_trace_steps_file):
            os.remove(_trace_steps_file)
    except Exception:
        pass
    
    print("Trace collector starting...")
    print(f"Output file: {_output_file}")
    print(f"Max steps: {_max_steps}")
    print(f"Working dir: {os.getcwd()}")
    print(f"ENV TRACE_OUTPUT: {os.environ.get('TRACE_OUTPUT', 'NOT_SET')}")
    print(f"ENV TRACE_MAX_STEPS: {os.environ.get('TRACE_MAX_STEPS', 'NOT_SET')}")
    
    try:
        # Register stop handler - using global function for correct GDB event handling
        gdb.events.stop.connect(stop_handler)
        
        # Configure GDB
        gdb.execute("set pagination off")
        gdb.execute("set confirm off")
        gdb.execute("set step-mode on")
        
        # Set breakpoint at main
        gdb.execute("break main")
        
        # Run with stdin input if provided
        input_file = os.environ.get("STDIN_INPUT_FILE", "")
        run_cmd = "run"
        if input_file and os.path.exists(input_file):
            run_cmd += f" < {input_file}"
        run_cmd += f" > {_stdout_file} 2> {_stderr_file}"
        
        print("Starting trace collection...")
        gdb.execute(run_cmd)
        
        # Program finished - write trace
        write_trace()
        
    except Exception as e:
        print(f"Error during trace: {e}")
        import traceback
        traceback.print_exc()
        write_trace()
    finally:
        try:
            gdb.events.stop.disconnect(stop_handler)
        except:
            pass


# Entry point - run immediately when script is loaded by GDB
run()
