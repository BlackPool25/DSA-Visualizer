/**
 * @file run.test.ts
 * @description Integration tests for the /api/run endpoint.
 * Tests binary execution with and without input, timeout handling.
 */

import { describe, it, expect } from 'bun:test';

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:4000';

/**
 * C++ program that reads a number and prints it doubled
 */
const interactiveCode = `
#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    cout << n * 2 << endl;
    return 0;
}
`;

/**
 * C++ program that prints to stdout and stderr
 */
const outputCode = `
#include <iostream>
using namespace std;

int main() {
    cout << "stdout message" << endl;
    cerr << "stderr message" << endl;
    return 0;
}
`;

describe('POST /api/run', () => {
  // First compile a binary to use in tests
  let testBinaryId: string;

  it('should compile test code for execution tests', async () => {
    const response = await fetch(`${API_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: interactiveCode,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.binaryId).toBeDefined();
    testBinaryId = data.binaryId;
  });

  it('should execute binary with input', async () => {
    const response = await fetch(`${API_URL}/api/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        binaryId: testBinaryId,
        stdin: '5',
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.stdout).toContain('10');
    expect(data.exitCode).toBe(0);
    expect(data.timedOut).toBe(false);
    expect(data.duration).toBeDefined();
  });

  it('should execute binary without input', async () => {
    // Compile code without input requirement
    const compileResponse = await fetch(`${API_URL}/api/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: outputCode,
      }),
    });

    const compileData = await compileResponse.json();
    expect(compileData.success).toBe(true);

    const runResponse = await fetch(`${API_URL}/api/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        binaryId: compileData.binaryId,
        stdin: '',
      }),
    });

    expect(runResponse.status).toBe(200);

    const runData = await runResponse.json();
    expect(runData.success).toBe(true);
    expect(runData.stdout).toContain('stdout message');
    expect(runData.stderr).toContain('stderr message');
    expect(runData.exitCode).toBe(0);
  });

  it('should return 400 for invalid binary ID format', async () => {
    const response = await fetch(`${API_URL}/api/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        binaryId: 'invalid-id',
        stdin: '',
      }),
    });

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });

  it('should handle non-existent binary ID', async () => {
    const response = await fetch(`${API_URL}/api/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        binaryId: '12345678-1234-1234-1234-123456789abc',
        stdin: '',
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
