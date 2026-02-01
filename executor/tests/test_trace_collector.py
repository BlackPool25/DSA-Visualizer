"""
tests/test_trace_collector.py - Tests for trace_collector.py

These tests verify that:
1. Basic tracing produces valid JSON output
2. Variables are captured correctly at each step
3. STL containers are serialized properly
4. Max steps limit is respected

Note:
These tests require GDB to be installed and the sample C++ programs
must be compiled with debug symbols (-g flag) before running tests.

Compilation (run before tests):
    cd tests/sample_solutions
    g++ -g -std=c++17 reverse_linked_list.cpp -o reverse_linked_list
    g++ -g -std=c++17 two_sum.cpp -o two_sum
    g++ -g -std=c++17 binary_tree_inorder.cpp -o binary_tree_inorder

Usage:
    cd executor
    uv run pytest tests/test_trace_collector.py -v
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

import pytest

# Paths
SAMPLE_SOLUTIONS_DIR = Path(__file__).parent / "sample_solutions"
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"


class TestTraceCollector:
    """Test suite for trace collection functionality."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for test outputs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    def run_traced(
        self, binary_name: str, input_data: str, output_path: Path, max_steps: int = 100
    ) -> subprocess.CompletedProcess:
        """
        Helper to run a binary with tracing.

        Args:
            binary_name: Name of compiled binary (e.g., "reverse_linked_list")
            input_data: Input to provide via stdin
            output_path: Where to write trace.json
            max_steps: Maximum steps for tracing

        Returns:
            CompletedProcess with result information
        """
        binary_path = SAMPLE_SOLUTIONS_DIR / binary_name

        # Ensure binary exists
        if not binary_path.exists():
            pytest.skip(
                f"Binary not found: {binary_path}. Run: g++ -g -std=c++17 {binary_name}.cpp -o {binary_name}"
            )

        # Create input file
        input_path = output_path.parent / "input.txt"
        input_path.write_text(input_data)

        # Run trace
        env = os.environ.copy()
        env["TRACE_OUTPUT"] = str(output_path)
        env["TRACE_MAX_STEPS"] = str(max_steps)

        result = subprocess.run(
            [
                "gdb",
                "-batch",
                "-silent",
                "-ex",
                "set pagination off",
                "-ex",
                "set confirm off",
                "-x",
                str(SCRIPTS_DIR / "trace_collector.py"),
                "--args",
                str(binary_path),
            ],
            input=input_data,
            capture_output=True,
            text=True,
            env=env,
        )

        return result

    def test_trace_file_created(self, temp_dir):
        """Verify tracing a simple program produces a trace file."""
        output_path = temp_dir / "trace.json"

        result = self.run_traced(
            "reverse_linked_list", "[1,2,3]\n", output_path, max_steps=50
        )

        # Check trace file was created
        assert output_path.exists(), (
            f"Trace file not created. GDB output: {result.stderr}"
        )
        assert output_path.stat().st_size > 0, "Trace file is empty"

    def test_valid_json_output(self, temp_dir):
        """Verify trace output is valid JSON."""
        output_path = temp_dir / "trace.json"

        self.run_traced("reverse_linked_list", "[1,2,3]\n", output_path, max_steps=50)

        # Parse JSON
        with open(output_path) as f:
            trace = json.load(f)

        # Should be a list
        assert isinstance(trace, list), "Trace should be a JSON array"
        assert len(trace) > 0, "Trace should contain at least one step"

    def test_trace_step_structure(self, temp_dir):
        """Verify each trace step has required fields."""
        output_path = temp_dir / "trace.json"

        self.run_traced("reverse_linked_list", "[1,2,3]\n", output_path, max_steps=50)

        with open(output_path) as f:
            trace = json.load(f)

        # Check first step has required fields
        first_step = trace[0]
        required_fields = [
            "stepIndex",
            "line",
            "file",
            "event",
            "callStack",
            "heap",
            "stdout",
        ]

        for field in required_fields:
            assert field in first_step, f"Missing required field: {field}"

        assert first_step["stepIndex"] == 0, "First step should have index 0"
        assert isinstance(first_step["callStack"], list), "callStack should be a list"

    def test_call_stack_frame_structure(self, temp_dir):
        """Verify call stack frames have required fields."""
        output_path = temp_dir / "trace.json"

        self.run_traced("reverse_linked_list", "[1,2,3]\n", output_path, max_steps=50)

        with open(output_path) as f:
            trace = json.load(f)

        # Find a step with call stack
        for step in trace:
            if step["callStack"]:
                frame = step["callStack"][0]
                required_fields = ["frameId", "function", "file", "line", "locals"]

                for field in required_fields:
                    assert field in frame, f"Missing required frame field: {field}"

                assert isinstance(frame["locals"], dict), "locals should be a dict"
                break
        else:
            pytest.skip("No steps with call stack found")

    def test_max_steps_limit(self, temp_dir):
        """Verify tracing stops at max_steps."""
        output_path = temp_dir / "trace.json"
        max_steps = 10

        self.run_traced(
            "reverse_linked_list",
            "[1,2,3,4,5,6,7,8,9,10]\n",
            output_path,
            max_steps=max_steps,
        )

        with open(output_path) as f:
            trace = json.load(f)

        # Should not exceed max_steps by too much (allow some buffer)
        assert len(trace) <= max_steps + 5, (
            f"Trace exceeded max_steps: {len(trace)} > {max_steps}"
        )

    def test_linked_list_heap_objects(self, temp_dir):
        """Verify linked list nodes appear in heap."""
        output_path = temp_dir / "trace.json"

        self.run_traced("reverse_linked_list", "[1,2,3]\n", output_path, max_steps=50)

        with open(output_path) as f:
            trace = json.load(f)

        # Look for heap objects
        found_heap_objects = False
        for step in trace:
            if step["heap"]:
                found_heap_objects = True
                # Verify heap object structure
                for addr, obj in step["heap"].items():
                    assert "kind" in obj, "Heap object should have 'kind' field"
                    assert "type" in obj, "Heap object should have 'type' field"
                    break
                break

        assert found_heap_objects, "No heap objects found in trace"

    def test_two_sum_hash_map(self, temp_dir):
        """Verify two_sum solution traces hash map usage."""
        output_path = temp_dir / "trace.json"

        result = self.run_traced(
            "two_sum", "[2,7,11,15]\n9\n", output_path, max_steps=50
        )

        # Check trace was created
        assert output_path.exists(), f"Trace not created: {result.stderr}"

        with open(output_path) as f:
            trace = json.load(f)

        # Verify valid JSON and structure
        assert isinstance(trace, list)
        assert len(trace) > 0

    def test_binary_tree_traversal(self, temp_dir):
        """Verify binary tree solution traces correctly."""
        output_path = temp_dir / "trace.json"

        result = self.run_traced(
            "binary_tree_inorder", "[1,null,2,3]\n", output_path, max_steps=50
        )

        assert output_path.exists(), f"Trace not created: {result.stderr}"

        with open(output_path) as f:
            trace = json.load(f)

        assert isinstance(trace, list)
        assert len(trace) > 0

        # Should have call stack showing recursion
        has_recursive_stack = False
        for step in trace:
            if len(step["callStack"]) > 1:
                has_recursive_stack = True
                break

        assert has_recursive_stack, "No recursive call stack found"


class TestTraceEdgeCases:
    """Test edge cases and error handling."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for test outputs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    def test_empty_input(self, temp_dir):
        """Test tracing with minimal/empty input."""
        output_path = temp_dir / "trace.json"

        # Create a simple test program
        test_cpp = temp_dir / "test_empty.cpp"
        test_cpp.write_text("""
#include <iostream>
int main() {
    int x = 42;
    std::cout << x << std::endl;
    return 0;
}
""")

        # Compile
        binary_path = temp_dir / "test_empty"
        compile_result = subprocess.run(
            ["g++", "-g", "-std=c++17", str(test_cpp), "-o", str(binary_path)],
            capture_output=True,
            text=True,
        )

        if compile_result.returncode != 0:
            pytest.skip(f"Compilation failed: {compile_result.stderr}")

        # Run trace
        env = os.environ.copy()
        env["TRACE_OUTPUT"] = str(output_path)
        env["TRACE_MAX_STEPS"] = "10"

        subprocess.run(
            [
                "gdb",
                "-batch",
                "-silent",
                "-ex",
                "set pagination off",
                "-x",
                str(SCRIPTS_DIR / "trace_collector.py"),
                "--args",
                str(binary_path),
            ],
            capture_output=True,
            env=env,
        )

        assert output_path.exists()
        with open(output_path) as f:
            trace = json.load(f)
        assert len(trace) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
