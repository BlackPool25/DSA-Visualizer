/**
 * @file generator.ts
 * @description C++ harness code generator for LeetCode-style problem execution.
 *
 * This generator enables users to write only the Solution class (like on LeetCode),
 * without needing to write main(), input/output handling, or type deserializers.
 *
 * The harness wraps user code with:
 * - Standard headers (bits/stdc++.h, custom structures.hpp)
 * - Deserializers for complex types (ListNode*, TreeNode*, vector<T>, etc.)
 * - Serializers for output formatting (vectors, linked lists, trees)
 * - A main() function that reads JSON input, calls the solution method, and outputs results
 *
 * Example flow:
 * 1. User writes: class Solution { public: int twoSum(...) {...} };
 * 2. Generator adds: #include headers, deserializers, main() with I/O handling
 * 3. Result: Complete executable C++ program
 */

import type { FunctionSignature, Parameter } from "@dsa-visualizer/shared";
import {
  getDeserializerForType,
  getSerializerForType,
} from "./signature-parser.js";

/** Options for harness generation */
export interface HarnessOptions {
  /** User's Solution class code */
  userCode: string;
  /** Parsed function signature */
  signature: FunctionSignature;
  /** Test input as JSON array string */
  testInput: string;
}

/** Generated harness result */
export interface GeneratedHarness {
  /** Complete C++ source code */
  code: string;
  /** Whether generation succeeded */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Generates a complete C++ harness for running LeetCode-style solutions.
 *
 * This function transforms user's Solution class code into a complete executable program:
 * - Validates test input format (must be JSON array)
 * - Verifies parameter count matches function signature
 * - Wraps user code with necessary headers and helper functions
 * - Generates main() that handles input deserialization and output serialization
 *
 * @param options - Harness generation options
 * @returns Generated harness code with success status
 *
 * @example
 * Input: { userCode: "class Solution { int twoSum(...) }", signature: {...}, testInput: "[1,2,3]" }
 * Output: { success: true, code: "#include <bits/stdc++.h>\\n...\\nint main() {...}" }
 */
export function generateHarness(options: HarnessOptions): GeneratedHarness {
  try {
    const { userCode, signature, testInput } = options;

    // Parse test input to determine number of arguments
    let inputArray: unknown[];
    try {
      inputArray = JSON.parse(testInput);
      if (!Array.isArray(inputArray)) {
        throw new Error("Test input must be a JSON array");
      }
    } catch (error) {
      return {
        code: "",
        success: false,
        error: `Invalid test input JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Validate input count matches parameter count
    if (inputArray.length !== signature.parameters.length) {
      return {
        code: "",
        success: false,
        error: `Parameter count mismatch: expected ${signature.parameters.length}, got ${inputArray.length}`,
      };
    }

    // Generate the harness code
    const harnessCode = buildHarness(userCode, signature, inputArray.length);

    return {
      code: harnessCode,
      success: true,
    };
  } catch (error) {
    return {
      code: "",
      success: false,
      error: `Harness generation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Builds the complete harness C++ code by combining all components.
 *
 * Generated code structure:
 * 1. Headers: Standard library + custom structures/deserializers/serializers
 * 2. User's Solution class: Unchanged from input
 * 3. main() function:
 *    - Reads JSON input from stdin
 *    - Validates input array size matches parameter count
 *    - Deserializes each parameter to correct C++ type
 *    - Creates Solution instance and calls the target method
 *    - Serializes and outputs the result
 *
 * @param userCode - User's Solution class code
 * @param signature - Parsed function signature (return type, name, parameters)
 * @param paramCount - Number of parameters (for validation)
 * @returns Complete C++ source code ready for compilation
 */
/**
 * Builds the complete harness C++ code by combining all components.
 *
 * Generated code structure:
 * 1. Headers: Standard library + custom structures/deserializers/serializers
 * 2. User's Solution class: Unchanged from input
 * 3. main() function:
 *    - Reads each parameter on its own line from stdin
 *    - Uses appropriate parsing functions for each type
 *    - Creates Solution instance and calls the target method
 *    - Serializes and outputs the result
 *
 * Input Format: Each parameter on its own line, e.g.:
 *   [2,7,11,15]
 *   9
 *
 * @param userCode - User's Solution class code
 * @param signature - Parsed function signature (return type, name, parameters)
 * @param _paramCount - Number of parameters (unused, kept for API compatibility)
 * @returns Complete C++ source code ready for compilation
 */
function buildHarness(
  userCode: string,
  signature: FunctionSignature,
  _paramCount: number,
): string {
  const { returnType, functionName, parameters } = signature;

  // Generate input reading and deserialization for each parameter
  const inputReadingCode = parameters
    .map((param, index) => generateInputReading(param, index))
    .join("\n");

  // Generate function call arguments
  const callArgs = parameters.map((param) => param.name).join(", ");

  // Generate serializer for return value
  const serializerCall = generateSerializer(returnType);

  // Build the complete harness code with line-based input parsing
  return `#include <bits/stdc++.h>
#include "structures.hpp"
#include "deserializers.hpp"
#include "serializers.hpp"
using namespace std;

// ========== User's Solution Class ==========
// The user writes only this part (LeetCode-style)
${userCode}

// ========== Main Function (Auto-generated) ==========
// Handles input deserialization, solution invocation, and output serialization
int main() {
    // Note: I/O optimizations (ios::sync_with_stdio, cin.tie) are disabled
    // to avoid GDB stepping into STL functions during tracing.
    
    try {
        // Read and parse each parameter from stdin (one per line)
${indentLines(inputReadingCode, 8)}
        
        // Create solution instance and call the target method
        Solution solution;
${generateFunctionCall(returnType, functionName, callArgs, 8)}
        
        // Serialize result and output to stdout
${indentLines(serializerCall, 8)}
        
    } catch (const exception& e) {
        cerr << "Error: " << e.what() << endl;
        return 1;
    }
    
    return 0;
}
`;
}

/**
 * Generates input reading code for a single parameter.
 *
 * Each parameter is read from its own line using getline(),
 * then parsed using the appropriate function based on type:
 * - vector<int>: parseIntArray()
 * - int: stoi()
 * - double: stod()
 * - string: direct use (with quote stripping)
 * - ListNode*: buildList(parseIntArray())
 * - TreeNode*: buildTree(parseTreeArray())
 *
 * @param param - Parameter definition with type and name
 * @param index - Parameter index (for variable naming)
 * @returns C++ code lines that read and parse this parameter
 */
function generateInputReading(param: Parameter, index: number): string {
  // Remove const and reference qualifiers for variable declaration
  const typeWithoutRef = param.type
    .replace(/&/g, "")
    .replace(/const\s*/g, "")
    .trim();
  const lineVar = `line${index}`;

  // Generate the getline call
  const readLine = `string ${lineVar}; getline(cin, ${lineVar});`;

  // Generate the parsing call based on type
  const parseCall = generateParseCall(typeWithoutRef, param.name, lineVar);

  return `${readLine}\n${parseCall}`;
}

/**
 * Generates the parsing code for a specific C++ type.
 *
 * Maps types to their parsing functions:
 * - int: stoi()
 * - long/long long: stoll()
 * - double/float: stod()
 * - bool: parse "true"/"false"
 * - string: strip quotes
 * - vector<int>: parseIntArray()
 * - vector<vector<int>>: parseMatrix()
 * - ListNode*: buildList(parseIntArray())
 * - TreeNode*: buildTree(parseTreeArray())
 *
 * @param type - C++ type (without const/reference)
 * @param varName - Variable name to assign to
 * @param lineVar - Name of the string variable containing the input line
 * @returns C++ code line that parses and assigns the value
 */
function generateParseCall(
  type: string,
  varName: string,
  lineVar: string,
): string {
  // Normalize type for comparison (remove spaces)
  const normalized = type.replace(/\s+/g, "");

  // Primitive types
  if (normalized === "int") {
    return `int ${varName} = stoi(${lineVar});`;
  }
  if (normalized === "long" || normalized === "longlong") {
    return `long long ${varName} = stoll(${lineVar});`;
  }
  if (normalized === "double" || normalized === "float") {
    return `double ${varName} = stod(${lineVar});`;
  }
  if (normalized === "bool") {
    return `bool ${varName} = (${lineVar} == "true");`;
  }
  if (normalized === "string") {
    // Strip surrounding quotes if present
    return `string ${varName} = (${lineVar}.length() >= 2 && ${lineVar}[0] == '"') ? ${lineVar}.substr(1, ${lineVar}.length() - 2) : ${lineVar};`;
  }

  // Vector types
  if (normalized === "vector<int>") {
    return `vector<int> ${varName} = parseIntArray(${lineVar});`;
  }
  if (normalized === "vector<string>") {
    // TODO: Add parseStringArray when needed
    return `vector<string> ${varName}; // TODO: parse string array`;
  }
  if (normalized === "vector<double>" || normalized === "vector<float>") {
    // TODO: Add parseDoubleArray when needed
    return `vector<double> ${varName}; // TODO: parse double array`;
  }
  if (normalized.startsWith("vector<vector<")) {
    return `vector<vector<int>> ${varName} = parseMatrix(${lineVar});`;
  }

  // Data structure types
  if (normalized === "ListNode*") {
    return `ListNode* ${varName} = buildList(parseIntArray(${lineVar}));`;
  }
  if (normalized === "TreeNode*") {
    // buildTree expects vector<optional<int>> - for now use parseIntArray and handle nulls
    return `TreeNode* ${varName} = buildTree(parseTreeArray(${lineVar}));`;
  }

  // Fallback for unknown types
  return `${type} ${varName}; // TODO: add parser for type ${type}`;
}

/**
 * Generates deserializer code for a single parameter.
 *
 * Converts JSON input to the appropriate C++ type:
 * - int, double, string: Direct deserialization
 * - vector<T>: Array deserialization with element conversion
 * - ListNode*, TreeNode*: Complex structure deserialization
 *
 * @param param - Parameter definition with type and name
 * @param index - Parameter index in input array (0-based)
 * @returns C++ code line that deserializes this parameter
 *
 * @example
 * Input: { type: "vector<int>&", name: "nums" }, index: 0
 * Output: "vector<int> nums = deserializeVectorInt(inputs[0]);"
 */
function generateDeserializer(param: Parameter, index: number): string {
  const deserializer = getDeserializerForType(param.type);
  // Remove const and reference qualifiers for variable declaration
  const typeWithoutRef = param.type
    .replace(/&/g, "")
    .replace(/const/g, "")
    .trim();

  return `${typeWithoutRef} ${param.name} = ${deserializer}(inputs[${index}]);`;
}

/**
 * Generates function call code with proper return value handling.
 *
 * @param returnType - Function return type
 * @param functionName - Function name
 * @param args - Call arguments string
 * @param indent - Indentation level
 * @returns Function call code
 */
function generateFunctionCall(
  returnType: string,
  functionName: string,
  args: string,
  indent: number,
): string {
  const indentStr = " ".repeat(indent);

  if (returnType === "void") {
    return `${indentStr}solution.${functionName}(${args});`;
  }

  return `${indentStr}auto result = solution.${functionName}(${args});`;
}

/**
 * Generates serializer code for the return value.
 *
 * @param returnType - Return type string
 * @returns Serializer code
 */
function generateSerializer(returnType: string): string {
  if (returnType === "void") {
    return `cout << "null" << endl;`;
  }

  const serializer = getSerializerForType(returnType);
  return `cout << ${serializer}(result) << endl;`;
}

/**
 * Indents each line of code by the specified amount.
 *
 * @param code - Code to indent
 * @param spaces - Number of spaces to indent
 * @returns Indented code
 */
function indentLines(code: string, spaces: number): string {
  const indent = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? indent + line : line))
    .join("\n");
}
