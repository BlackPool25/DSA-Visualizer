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
_trace: List[Dict[str, Any]] = []
_max_steps: int = 1000
_step_count: int = 0
_output_file: str = "trace.json"
_heap: Dict[str, Any] = {}
_start_time: float = 0


def capture_frame(frame: gdb.Frame, idx: int) -> Dict[str, Any]:
    """Capture state of a single stack frame."""
    try:
        func_name = frame.name() or "unknown"
        sal = frame.find_sal()
        
        # Get local variables
        locals_dict = {}
        try:
            block = frame.block()
            while block:
                for symbol in block:
                    if symbol.is_variable or symbol.is_argument:
                        name = symbol.name
                        if name not in locals_dict and not name.startswith("_"):
                            try:
                                value = frame.read_var(symbol)
                                serialized = serialize_value(value, name)
                                if serialized is not None:
                                    locals_dict[name] = serialized
                            except:
                                pass
                block = block.superblock
        except:
            pass
        
        return {
            "frameId": f"frame_{idx}",
            "function": func_name,
            "file": sal.symtab.filename if sal.symtab else "unknown",
            "line": sal.line if sal.line else 0,
            "locals": locals_dict,
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
    global _step_count, _heap
    
    try:
        frame = gdb.selected_frame()
        sal = frame.find_sal()
        
        # Build call stack
        call_stack = []
        current = frame
        idx = 0
        while current:
            try:
                call_stack.append(capture_frame(current, idx))
                idx += 1
                current = current.older()
            except:
                break
        
        return {
            "stepIndex": _step_count,
            "line": sal.line if sal.line else 0,
            "file": sal.symtab.filename if sal.symtab else "unknown",
            "event": "line",
            "callStack": call_stack,
            "heap": dict(_heap),
            "stdout": "",
        }
    except Exception as e:
        return {
            "stepIndex": _step_count,
            "line": 0,
            "file": "unknown",
            "event": "error",
            "callStack": [],
            "heap": {},
            "stdout": "",
            "error": str(e),
        }


def stop_handler(event) -> None:
    """Called by GDB when execution stops. Captures state and steps."""
    global _step_count, _trace, _max_steps
    
    if _step_count >= _max_steps:
        return
    
    try:
        # Capture current program state
        state = capture_state()
        _trace.append(state)
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
    """Write collected trace to output file, filtering for Solution:: methods only."""
    global _trace, _output_file, _start_time
    
    import time
    execution_time = int((time.time() - _start_time) * 1000)
    
    # Filter trace to only include steps where we're in Solution:: methods
    filtered_trace = []
    for step in _trace:
        call_stack = step.get("callStack", [])
        # Check if any frame in the call stack is a Solution:: method
        in_solution = any(
            "Solution::" in frame.get("function", "")
            for frame in call_stack
        )
        if in_solution:
            # Renumber step indices for the filtered trace
            step["stepIndex"] = len(filtered_trace)
            filtered_trace.append(step)
    
    print(f"Filtered {len(_trace)} total steps to {len(filtered_trace)} Solution steps")
    
    # Format output
    output = {
        "steps": filtered_trace,
        "totalSteps": len(filtered_trace),
        "executionTime": execution_time,
    }
    
    try:
        with open(_output_file, "w") as f:
            json.dump(output, f, indent=2)
        print(f"Trace written to {_output_file} ({len(filtered_trace)} steps)")
    except Exception as e:
        print(f"Error writing trace: {e}")


def run() -> None:
    """Main entry point - sets up GDB and runs the trace collection."""
    global _output_file, _max_steps, _start_time
    
    import time
    _start_time = time.time()
    
    # Get configuration from environment
    _output_file = os.environ.get("TRACE_OUTPUT", "trace.json")
    _max_steps = int(os.environ.get("TRACE_MAX_STEPS", "1000"))
    
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
        run_cmd += " > /dev/null 2>&1"
        
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
