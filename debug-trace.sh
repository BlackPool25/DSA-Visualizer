#!/bin/bash
# Debug script to test trace collection

set -e

# Create temp directory
TMPDIR=$(mktemp -d)
echo "Temp directory: $TMPDIR"

# Create test code
cat > "$TMPDIR/solution.cpp" << 'EOF'
#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    
    for(int i = 0; i < nums.size(); i++) {
        for(int j = i + 1; j < nums.size(); j++) {
            if(nums[i] + nums[j] == target) {
                cout << "[" << i << "," << j << "]" << endl;
                return 0;
            }
        }
    }
    return 0;
}
EOF

# Copy templates
cp /home/lightdesk/Projects/DSA-Visualiser/executor/templates/*.hpp "$TMPDIR/" 2>/dev/null || echo "No templates to copy"

# Compile in executor container
echo "Compiling..."
docker run --rm -v "$TMPDIR:/workspace" dsa-visualiser-executor:latest g++ -g -O0 -std=c++17 -Wall -Wextra -o /workspace/solution /workspace/solution.cpp

echo "Compilation successful!"

# Run trace
echo "Running trace..."
docker run --rm -v "$TMPDIR:/workspace" -e TRACE_MAX_STEPS=50 -e TRACE_OUTPUT=/workspace/trace.json dsa-visualiser-executor:latest gdb -batch -x /scripts/trace_collector.py --args /workspace/solution 2>&1

echo "Trace complete!"
echo "Trace output:"
cat "$TMPDIR/trace.json"

# Cleanup
rm -rf "$TMPDIR"
