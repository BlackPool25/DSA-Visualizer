"""
scripts package - GDB Python tracing scripts.

This package contains Python scripts that run inside GDB to capture
execution traces of C++ programs.

Modules:
    trace_collector: Main GDB script for step-by-step tracing
    value_serializer: Converts GDB values to JSON
    stl_printers: Custom serializers for STL containers

Usage:
    These scripts are loaded by GDB, not run directly:
    gdb -batch -silent -x trace_collector.py --args ./program

Note:
    These scripts use the 'gdb' module which is only available
    when running inside GDB's embedded Python interpreter.
"""

__version__ = "0.1.0"
__all__ = ["trace_collector", "value_serializer", "stl_printers"]
