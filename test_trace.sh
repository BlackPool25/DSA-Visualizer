#!/bin/bash
set -e

echo "=== Testing DSA Visualizer Trace Collection ==="
echo

# Two Sum solution
USER_CODE='class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> myDict;
        for(int i=0; i<nums.size(); i++){
            int diff = target - nums[i];
            if(myDict.count(diff)){
                return vector<int>{i, myDict[diff]};
            }
            myDict[nums[i]] = i;
        }
        return {};
    }
};'

# Correct test input - one parameter per line
TEST_INPUT="[2,7,11,15]
9"

echo "1. Generating harness for Two Sum..."
HARNESS_RESPONSE=$(curl -s -X POST http://localhost:4000/api/harness \
  -H "Content-Type: application/json" \
  --data-binary @- << EOF
{
  "slug": "two-sum",
  "userCode": $(echo "$USER_CODE" | jq -Rs .),
  "testInput": $(echo "$TEST_INPUT" | jq -Rs .)
}
EOF
)

echo "$HARNESS_RESPONSE" | jq -r '.data.harnessedCode' > /tmp/harness_code.cpp 2>/dev/null || true
SUCCESS=$(echo "$HARNESS_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" != "true" ]; then
    echo "❌ Harness generation failed!"
    echo "$HARNESS_RESPONSE" | jq .
    exit 1
fi

echo "✅ Harness generated successfully"
echo

echo "2. Compiling harnessed code..."
HARNESSED_CODE=$(cat /tmp/harness_code.cpp | jq -Rs .)

COMPILE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/compile \
  -H "Content-Type: application/json" \
  -d "{\"code\": $HARNESSED_CODE}")

echo "$COMPILE_RESPONSE" | jq .
SUCCESS=$(echo "$COMPILE_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" != "true" ]; then
    echo "❌ Compilation failed!"
    exit 1
fi

BINARY_ID=$(echo "$COMPILE_RESPONSE" | jq -r '.binaryId')
echo "✅ Compilation successful. Binary ID: $BINARY_ID"
echo

echo "3. Running code with test input..."
RUN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/run \
  -H "Content-Type: application/json" \
  --data-binary @- << EOF
{
  "binaryId": "$BINARY_ID",
  "stdin": $(echo "$TEST_INPUT" | jq -Rs .)
}
EOF
)

echo "$RUN_RESPONSE" | jq .
echo

echo "4. Generating execution trace..."
TRACE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/trace \
  -H "Content-Type: application/json" \
  --data-binary @- << EOF
{
  "code": $HARNESSED_CODE,
  "stdin": $(echo "$TEST_INPUT" | jq -Rs .),
  "maxSteps": 5000
}
EOF
)

# Save trace to file
echo "$TRACE_RESPONSE" > /tmp/trace_response.json

SUCCESS=$(echo "$TRACE_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
    echo "❌ Trace generation failed!"
    echo "$TRACE_RESPONSE" | jq .
    exit 1
fi

TOTAL_STEPS=$(echo "$TRACE_RESPONSE" | jq -r '.trace.totalSteps')
echo "✅ Trace generated successfully!"
echo "   Total steps: $TOTAL_STEPS"
echo

echo "5. Analyzing trace steps..."
# Show first 10 steps
echo "$TRACE_RESPONSE" | jq '.trace.steps[0:10] | .[] | {stepIndex, line, file: .file | split("/")[-1], function: .callStack[0].function, event}'

echo
echo "=== Checking for Solution::twoSum ==="
TWO_SUM_STEPS=$(echo "$TRACE_RESPONSE" | jq '[.trace.steps[] | select(.callStack[0].function | contains("twoSum"))] | length')
echo "Steps in twoSum function: $TWO_SUM_STEPS"

if [ "$TWO_SUM_STEPS" -gt "0" ]; then
    echo
    echo "✅ SUCCESS! twoSum function was traced. Sample steps:"
    echo "$TRACE_RESPONSE" | jq '.trace.steps[] | select(.callStack[0].function | contains("twoSum")) | {stepIndex, line, function: .callStack[0].function}' | head -20
fi

echo
echo "=== Test Complete ==="
echo "Full trace saved to: /tmp/trace_response.json"
