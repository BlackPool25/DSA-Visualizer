/**
 * @file trace.test.ts
 * @description Integration tests for the /api/trace endpoint.
 * Tests trace generation for valid code, compilation errors, and step limits.
 */

import { describe, it, expect } from 'bun:test';

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:4000';

/**
 * Simple C++ program for trace testing
 */
const traceableCode = `
#include <iostream>
using namespace std;

int main() {
    int a = 5;
    int b = 10;
    int sum = a + b;
    cout << sum << endl;
    return 0;
}
`;

/**
 * Invalid C++ code
 */
const invalidCode = `
#include <iostream>

int main() {
    cout << "Missing semicolon"
    return 0;
}
`;

describe('POST /api/trace', () => {
  it('should generate trace for valid code', async () => {
    const response = await fetch(`${API_URL}/api/trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: traceableCode,
        maxSteps: 100,
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.trace).toBeDefined();
    expect(data.trace.steps).toBeDefined();
    expect(Array.isArray(data.trace.steps)).toBe(true);
    expect(data.trace.totalSteps).toBeGreaterThan(0);
    expect(data.trace.executionTime).toBeDefined();
    expect(data.duration).toBeDefined();
  });

  it('should return compilation errors for invalid code', async () => {
    const response = await fetch(`${API_URL}/api/trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: invalidCode,
        maxSteps: 100,
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Compilation failed');
    expect(data.compileErrors).toBeDefined();
    expect(Array.isArray(data.compileErrors)).toBe(true);
  });

  it('should respect maxSteps limit', async () => {
    const response = await fetch(`${API_URL}/api/trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: traceableCode,
        maxSteps: 10,
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    if (data.success) {
      expect(data.trace.totalSteps).toBeLessThanOrEqual(10);
    }
  });

  it('should return 400 for empty code', async () => {
    const response = await fetch(`${API_URL}/api/trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: '',
        maxSteps: 100,
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });

  it('should return 400 for invalid maxSteps', async () => {
    const response = await fetch(`${API_URL}/api/trace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: traceableCode,
        maxSteps: 10000, // Exceeds maximum
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });
});
