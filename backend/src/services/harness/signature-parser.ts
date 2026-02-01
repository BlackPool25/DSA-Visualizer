/**
 * @file signature-parser.ts
 * @description C++ function signature parser for LeetCode code snippets.
 * Extracts return type, function name, and parameters from C++ method signatures.
 */

import type { FunctionSignature, Parameter } from '@dsa-visualizer/shared';

/**
 * Parses a C++ function signature from LeetCode code snippet.
 * Handles common LeetCode types: int, string, vector<T>, ListNode*, TreeNode*,
 * vector<vector<T>>, const references, etc.
 *
 * @param codeSnippet - C++ code snippet containing the function signature
 * @returns Parsed function signature
 * @throws Error if signature cannot be parsed
 */
export function parseSignature(codeSnippet: string): FunctionSignature {
  // Find the Solution class and extract the public method
  const classMatch = codeSnippet.match(/class\s+Solution\s*\{[^}]*public:\s*([^}]+)\}/);
  if (!classMatch) {
    throw new Error('Could not find Solution class with public section');
  }

  const publicSection = classMatch[1];

  // Find function signature pattern: return_type function_name(params)
  // Handles: int func(...), vector<int> func(...), string func(...), etc.
  const signatureRegex = /(\S+(?:\s*<[^>]+>)?\s*(?:\*?\s*)?)\s+(\w+)\s*\(([^)]*)\)\s*\{/;
  const match = publicSection.match(signatureRegex);

  if (!match) {
    throw new Error('Could not parse function signature from code snippet');
  }

  const [, returnTypeRaw, functionName, paramsRaw] = match;

  // Clean up return type (remove extra spaces)
  const returnType = returnTypeRaw.trim().replace(/\s+/g, ' ');

  // Parse parameters
  const parameters = parseParameters(paramsRaw);

  return {
    returnType,
    functionName,
    parameters,
  };
}

/**
 * Parses the parameter list from a function signature.
 *
 * @param paramsRaw - Raw parameter string (e.g., "int x, string& y")
 * @returns Array of parsed parameters
 */
function parseParameters(paramsRaw: string): Parameter[] {
  if (!paramsRaw.trim()) {
    return [];
  }

  const parameters: Parameter[] = [];

  // Split by commas, but be careful with template types like vector<vector<int>>
  const params = splitParams(paramsRaw);

  for (const param of params) {
    const parsed = parseSingleParameter(param.trim());
    if (parsed) {
      parameters.push(parsed);
    }
  }

  return parameters;
}

/**
 * Splits parameter string by commas, handling nested template types.
 *
 * @param paramsRaw - Raw parameter string
 * @returns Array of individual parameter strings
 */
function splitParams(paramsRaw: string): string[] {
  const params: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of paramsRaw) {
    if (char === '<') {
      depth++;
      current += char;
    } else if (char === '>') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      params.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  return params;
}

/**
 * Parses a single parameter into type and name.
 *
 * @param param - Single parameter string (e.g., "vector<int>& nums")
 * @returns Parsed parameter or null if invalid
 */
function parseSingleParameter(param: string): Parameter | null {
  if (!param) {
    return null;
  }

  // Handle common patterns:
  // - int x
  // - string& s
  // - const string& s
  // - vector<int>& nums
  // - ListNode* head
  // - TreeNode* root
  // - vector<vector<int>>& grid

  // Remove const qualifier for parsing
  const withoutConst = param.replace(/^const\s+/, '');

  // Match pattern: type name, type& name, type* name, etc.
  // Type can include template parameters: vector<int>, vector<vector<int>>
  const paramRegex = /(.+?)([&*])?\s+(\w+)$/;
  const match = withoutConst.match(paramRegex);

  if (!match) {
    // Try simpler pattern without trailing name (edge case)
    const simpleMatch = param.match(/(.+)$/);
    if (simpleMatch) {
      return {
        type: param,
        name: `arg${Math.random().toString(36).substr(2, 4)}`,
      };
    }
    return null;
  }

  let type = match[1].trim();
  const pointerOrRef = match[2] || '';
  const name = match[3];

  // Re-add const if it was present
  if (param.startsWith('const ')) {
    type = `const ${type}`;
  }

  // Add pointer or reference back to type
  type = `${type}${pointerOrRef}`;

  return { type, name };
}

/**
 * Determines the deserializer function name for a given C++ type.
 *
 * @param type - C++ type string
 * @returns Name of deserializer function to use
 */
export function getDeserializerForType(type: string): string {
  const normalizedType = type
    .replace(/const\s+/g, '')
    .replace(/&/g, '')
    .replace(/\s+/g, '');

  // Handle basic types
  if (normalizedType === 'int') {
    return 'deserializeInt';
  }
  if (normalizedType === 'long' || normalizedType === 'longlong') {
    return 'deserializeLong';
  }
  if (normalizedType === 'double' || normalizedType === 'float') {
    return 'deserializeDouble';
  }
  if (normalizedType === 'string') {
    return 'deserializeString';
  }
  if (normalizedType === 'bool') {
    return 'deserializeBool';
  }

  // Handle pointer types (TreeNode*, ListNode*)
  if (normalizedType.includes('TreeNode*')) {
    return 'deserializeTreeNode';
  }
  if (normalizedType.includes('ListNode*')) {
    return 'deserializeListNode';
  }

  // Handle vector types
  if (normalizedType.startsWith('vector<')) {
    // Extract inner type
    const innerMatch = normalizedType.match(/vector<(.*)>/);
    if (innerMatch) {
      const innerType = innerMatch[1];

      // Check for nested vector (2D array)
      if (innerType.startsWith('vector<')) {
        return 'deserialize2DVector';
      }

      // Map to appropriate vector deserializer
      if (innerType === 'int') {
        return 'deserializeIntVector';
      }
      if (innerType === 'string') {
        return 'deserializeStringVector';
      }
      if (innerType === 'double' || innerType === 'float') {
        return 'deserializeDoubleVector';
      }
    }
    return 'deserializeVector';
  }

  // Default fallback
  return 'deserializeJson';
}

/**
 * Determines the serializer function name for a given C++ return type.
 *
 * @param type - C++ return type string
 * @returns Name of serializer function to use
 */
export function getSerializerForType(type: string): string {
  const normalizedType = type
    .replace(/const\s+/g, '')
    .replace(/&/g, '')
    .replace(/\s+/g, '');

  // Handle basic types
  if (normalizedType === 'int' || normalizedType === 'long' || normalizedType === 'longlong') {
    return 'serializePrimitive';
  }
  if (normalizedType === 'double' || normalizedType === 'float') {
    return 'serializePrimitive';
  }
  if (normalizedType === 'string') {
    return 'serializeString';
  }
  if (normalizedType === 'bool') {
    return 'serializePrimitive';
  }

  // Handle void
  if (normalizedType === 'void') {
    return 'serializeVoid';
  }

  // Handle pointer types
  if (normalizedType.includes('TreeNode*')) {
    return 'serializeTreeNode';
  }
  if (normalizedType.includes('ListNode*')) {
    return 'serializeListNode';
  }

  // Handle vector types
  if (normalizedType.startsWith('vector<')) {
    const innerMatch = normalizedType.match(/vector<(.*)>/);
    if (innerMatch && innerMatch[1].startsWith('vector<')) {
      return 'serialize2DVector';
    }
    return 'serializeVector';
  }

  // Default fallback
  return 'serializeJson';
}
