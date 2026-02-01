"""
tests/test_stl_printers.py - Tests for stl_printers.py

These tests verify STL container serialization works correctly:
1. std::vector serialization captures size, capacity, elements
2. std::list serialization captures node structure
3. std::map serialization captures key-value pairs
4. std::unordered_map serialization captures hash table structure

Note:
These tests require GDB and compiled test programs with STL usage.

Compilation (run before tests):
    cd tests
    g++ -g -std=c++17 test_stl_containers.cpp -o test_stl_containers

Usage:
    cd executor
    uv run pytest tests/test_stl_printers.py -v
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"


class TestSTLPrinters:
    """Test STL container serialization."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for test outputs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    def run_traced_cpp(
        self, cpp_code: str, temp_dir: Path, max_steps: int = 50
    ) -> list:
        """
        Compile and run C++ code with tracing.

        Args:
            cpp_code: C++ source code to compile and run
            temp_dir: Temporary directory for files
            max_steps: Maximum trace steps

        Returns:
            Trace as list of steps
        """
        # Write C++ code
        cpp_path = temp_dir / "test.cpp"
        cpp_path.write_text(cpp_code)

        # Compile
        binary_path = temp_dir / "test"
        compile_result = subprocess.run(
            ["g++", "-g", "-std=c++17", str(cpp_path), "-o", str(binary_path)],
            capture_output=True,
            text=True,
        )

        if compile_result.returncode != 0:
            pytest.skip(f"Compilation failed: {compile_result.stderr}")

        # Run trace
        output_path = temp_dir / "trace.json"
        env = os.environ.copy()
        env["TRACE_OUTPUT"] = str(output_path)
        env["TRACE_MAX_STEPS"] = str(max_steps)

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

        if not output_path.exists():
            pytest.skip("Trace file not created")

        with open(output_path) as f:
            return json.load(f)

    def test_vector_serialization(self, temp_dir):
        """Test that std::vector is serialized with size, capacity, and elements."""
        cpp_code = """
#include <vector>
int main() {
    std::vector<int> vec = {1, 2, 3, 4, 5};
    vec.push_back(6);
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        # Find a step with the vector
        found_vector = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "vec" in locals_dict:
                    vec_data = locals_dict["vec"]
                    if vec_data.get("kind") == "stl_container":
                        found_vector = True
                        assert "size" in vec_data, "Vector should have size field"
                        assert "capacity" in vec_data, (
                            "Vector should have capacity field"
                        )
                        assert "elements" in vec_data, (
                            "Vector should have elements field"
                        )
                        assert vec_data.get("container_type") == "vector"
                        break
            if found_vector:
                break

        assert found_vector, "Vector not found in trace"

    def test_list_serialization(self, temp_dir):
        """Test that std::list is serialized with node structure."""
        cpp_code = """
#include <list>
int main() {
    std::list<int> lst = {1, 2, 3};
    lst.push_back(4);
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        found_list = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "lst" in locals_dict:
                    lst_data = locals_dict["lst"]
                    if lst_data.get("kind") == "stl_container":
                        found_list = True
                        assert "size" in lst_data, "List should have size field"
                        assert "nodes" in lst_data, "List should have nodes field"
                        assert lst_data.get("container_type") == "list"
                        break
            if found_list:
                break

        assert found_list, "List not found in trace"

    def test_map_serialization(self, temp_dir):
        """Test that std::map is serialized with entries."""
        cpp_code = """
#include <map>
#include <string>
int main() {
    std::map<int, std::string> m;
    m[1] = "one";
    m[2] = "two";
    m[3] = "three";
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        found_map = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "m" in locals_dict:
                    map_data = locals_dict["m"]
                    if map_data.get("kind") == "stl_container":
                        found_map = True
                        assert "size" in map_data, "Map should have size field"
                        assert "entries" in map_data, "Map should have entries field"
                        assert map_data.get("container_type") == "map"
                        break
            if found_map:
                break

        assert found_map, "Map not found in trace"

    def test_unordered_map_serialization(self, temp_dir):
        """Test that std::unordered_map is serialized with bucket info."""
        cpp_code = """
#include <unordered_map>
int main() {
    std::unordered_map<int, int> um;
    um[1] = 10;
    um[2] = 20;
    um[3] = 30;
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        found_um = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "um" in locals_dict:
                    um_data = locals_dict["um"]
                    if um_data.get("kind") == "stl_container":
                        found_um = True
                        assert "size" in um_data, "Unordered_map should have size field"
                        assert "bucket_count" in um_data, (
                            "Unordered_map should have bucket_count field"
                        )
                        assert "entries" in um_data, (
                            "Unordered_map should have entries field"
                        )
                        assert um_data.get("container_type") == "unordered_map"
                        break
            if found_um:
                break

        assert found_um, "Unordered_map not found in trace"

    def test_set_serialization(self, temp_dir):
        """Test that std::set is serialized with elements."""
        cpp_code = """
#include <set>
int main() {
    std::set<int> s = {3, 1, 4, 1, 5};
    s.insert(2);
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        found_set = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "s" in locals_dict:
                    set_data = locals_dict["s"]
                    if set_data.get("kind") == "stl_container":
                        found_set = True
                        assert "size" in set_data, "Set should have size field"
                        assert "elements" in set_data, "Set should have elements field"
                        assert set_data.get("container_type") == "set"
                        break
            if found_set:
                break

        assert found_set, "Set not found in trace"

    def test_stack_serialization(self, temp_dir):
        """Test that std::stack is serialized with underlying container."""
        cpp_code = """
#include <stack>
int main() {
    std::stack<int> st;
    st.push(1);
    st.push(2);
    st.push(3);
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        found_stack = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "st" in locals_dict:
                    stack_data = locals_dict["st"]
                    if stack_data.get("kind") == "stl_container":
                        found_stack = True
                        assert "size" in stack_data, "Stack should have size field"
                        assert "elements" in stack_data, (
                            "Stack should have elements field"
                        )
                        assert stack_data.get("container_type") == "stack"
                        break
            if found_stack:
                break

        assert found_stack, "Stack not found in trace"

    def test_queue_serialization(self, temp_dir):
        """Test that std::queue is serialized with underlying container."""
        cpp_code = """
#include <queue>
int main() {
    std::queue<int> q;
    q.push(1);
    q.push(2);
    q.push(3);
    return 0;
}
"""
        trace = self.run_traced_cpp(cpp_code, temp_dir)

        found_queue = False
        for step in trace:
            for frame in step.get("callStack", []):
                locals_dict = frame.get("locals", {})
                if "q" in locals_dict:
                    queue_data = locals_dict["q"]
                    if queue_data.get("kind") == "stl_container":
                        found_queue = True
                        assert "size" in queue_data, "Queue should have size field"
                        assert "elements" in queue_data, (
                            "Queue should have elements field"
                        )
                        assert queue_data.get("container_type") == "queue"
                        break
            if found_queue:
                break

        assert found_queue, "Queue not found in trace"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
