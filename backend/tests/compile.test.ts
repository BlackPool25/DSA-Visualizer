/**
 * @file compile.test.ts
 * @description Integration tests for the /api/compile endpoint.
 * Tests successful compilation, compilation errors, and validation.
 */

import { describe, it, expect } from 'bun:test';

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:4000';

/**
 * Simple valid C++ program that prints "Hello, World!"
 */
const validCode = `
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
`;

/**
 * Invalid C++ code with a syntax error
 */
const invalidCode = `
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl
    return 0;
}
`;

describe('POST /api/compile', () => {
  it('should compile valid C++ code successfully', async () => {
    const response = await fetch(`${API_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: validCode,
        compiler: 'g++',
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.binaryId).toBeDefined();
    expect(typeof data.binaryId).toBe('string');
    expect(data.duration).toBeDefined();
    expect(typeof data.duration).toBe('number');
  });

  it('should return compilation errors for invalid code', async () => {
    const response = await fetch(`${API_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: invalidCode,
        compiler: 'g++',
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.errors).toBeDefined();
    expect(Array.isArray(data.errors)).toBe(true);
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.duration).toBeDefined();
  });

  it('should return 400 for empty code', async () => {
    const response = await fetch(`${API_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: '',
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });

  it('should return 400 for oversized code', async () => {
    const oversizedCode = 'x'.repeat(51 * 1024); // 51KB

    const response = await fetch(`${API_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: oversizedCode,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });
});

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const response = await fetch(`${API_URL}/api/health`);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeDefined();
  });
});
