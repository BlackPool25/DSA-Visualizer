/**
 * @file sanitize.ts
 * @description Input sanitization utilities to prevent security vulnerabilities.
 * Includes validation for code size, input size, and content filtering.
 */

import { config } from '../config.js';

/** Maximum allowed code size in bytes (50KB) */
const MAX_CODE_SIZE = 50 * 1024;

/** Maximum allowed input size in bytes (1MB) */
const MAX_INPUT_SIZE = 1024 * 1024;

/** Maximum allowed trace steps */
const MAX_TRACE_STEPS_LIMIT = 5000;

/** Patterns that might indicate malicious code attempts */
const DANGEROUS_PATTERNS = [
  /system\s*\(/gi,        // system() calls
  /popen\s*\(/gi,         // popen() calls
  /exec\s*\(/gi,          // exec family calls
  /fork\s*\(/gi,          // fork() calls
  /#include\s*<unistd\.h>/gi,  // unistd.h for system calls
];

/**
 * Validates that code size is within acceptable limits.
 *
 * @param code - The code to validate
 * @returns Object with valid flag and optional error message
 */
export function validateCodeSize(code: string): { valid: boolean; error?: string } {
  const size = Buffer.byteLength(code, 'utf8');

  if (size === 0) {
    return { valid: false, error: 'Code cannot be empty' };
  }

  if (size > MAX_CODE_SIZE) {
    return { valid: false, error: `Code size (${size} bytes) exceeds maximum allowed (${MAX_CODE_SIZE} bytes)` };
  }

  return { valid: true };
}

/**
 * Validates that input size is within acceptable limits.
 *
 * @param input - The input to validate
 * @returns Object with valid flag and optional error message
 */
export function validateInputSize(input: string): { valid: boolean; error?: string } {
  const size = Buffer.byteLength(input, 'utf8');

  if (size > MAX_INPUT_SIZE) {
    return { valid: false, error: `Input size (${size} bytes) exceeds maximum allowed (${MAX_INPUT_SIZE} bytes)` };
  }

  return { valid: true };
}

/**
 * Validates that maxSteps is within acceptable range.
 *
 * @param maxSteps - The requested maximum steps
 * @returns Object with valid flag and optional error message
 */
export function validateMaxSteps(maxSteps: number): { valid: boolean; error?: string } {
  if (typeof maxSteps !== 'number' || isNaN(maxSteps)) {
    return { valid: false, error: 'maxSteps must be a valid number' };
  }

  if (maxSteps < 1) {
    return { valid: false, error: 'maxSteps must be at least 1' };
  }

  if (maxSteps > MAX_TRACE_STEPS_LIMIT) {
    return { valid: false, error: `maxSteps cannot exceed ${MAX_TRACE_STEPS_LIMIT}` };
  }

  return { valid: true };
}

/**
 * Scans code for potentially dangerous patterns.
 * Note: This is a basic check and should not be relied upon as the sole security measure.
 * The Docker container security settings provide the primary defense.
 *
 * @param code - The code to scan
 * @returns Object with safe flag and optional warning message
 */
export function scanForDangerousPatterns(code: string): { safe: boolean; warning?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return {
        safe: false,
        warning: 'Code contains potentially dangerous patterns. These will be blocked by the sandbox.',
      };
    }
  }

  return { safe: true };
}

/**
 * Sanitizes a string by removing null bytes and control characters
 * that could cause issues in file operations.
 *
 * @param input - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  // Remove null bytes and control characters (except common whitespace)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
