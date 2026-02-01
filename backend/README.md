# DSA Visualizer Backend

Express.js API server for the DSA Visualizer application. Provides endpoints for code compilation, execution tracing, and LeetCode problem integration.

## Overview

The backend serves as the central API layer that:
- Compiles C++ code using the executor Docker container
- Generates execution traces via GDB
- Integrates with LeetCode's GraphQL API for problem fetching
- Generates C++ harness code for LeetCode problems
- Manages rate limiting and request validation

## Quick Start

```bash
# Install dependencies
bun install

# Development mode with hot reload
bun run dev

# Production build
bun run build
bun run start

# Run tests
bun test

# Type checking
bun run typecheck
```

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main entry point, Express setup
│   ├── config.ts             # Environment configuration
│   ├── routes/               # API route handlers
│   │   ├── index.ts          # Route aggregator
│   │   ├── compile.ts        # POST /api/compile
│   │   ├── run.ts            # POST /api/run
│   │   ├── trace.ts          # POST /api/trace
│   │   ├── problems.ts       # GET /api/problems
│   │   └── harness.ts        # POST /api/harness
│   ├── services/             # Business logic
│   │   ├── compiler.ts       # C++ compilation service
│   │   ├── executor.ts       # Docker execution service
│   │   ├── tracer.ts         # GDB trace generation
│   │   ├── leetcode/         # LeetCode GraphQL client
│   │   │   ├── client.ts     # GraphQL API client
│   │   │   └── index.ts      # Service exports
│   │   └── harness/          # Harness generator
│   │       ├── generator.ts  # C++ harness generator
│   │       ├── signature-parser.ts  # C++ signature parser
│   │       └── index.ts      # Service exports
│   ├── middleware/           # Express middleware
│   │   ├── validation.ts     # Zod request validation
│   │   ├── rateLimiter.ts    # Rate limiting
│   │   └── errorHandler.ts   # Global error handler
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── tests/                    # Test suites
├── Dockerfile                # Production Docker image
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

## API Endpoints

### Core Endpoints

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/compile` | Compile C++ code | 30/min |
| POST | `/api/run` | Execute compiled binary | 30/min |
| POST | `/api/trace` | Generate GDB execution trace | 10/min |
| GET | `/api/health` | Health check with Docker status | 60/min |

### LeetCode Integration Endpoints

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/api/problems` | List LeetCode problems (paginated, filterable) | 30/min |
| GET | `/api/problems/:slug` | Get single problem details | 30/min |
| POST | `/api/harness` | Generate C++ harness code for problem | 30/min |

## LeetCode Integration

### LeetCode GraphQL Client

Located in `src/services/leetcode/`, the client provides:

- **GraphQL API Communication**: Communicates with LeetCode's public GraphQL endpoint (`https://leetcode.com/graphql`)
- **Problem Fetching**: Fetches problem lists and individual problem details
- **Error Handling**: Custom error types for rate limiting and API failures
- **Type Safety**: Full TypeScript interfaces for problem data

**Key Features:**
- Fetches problem metadata (ID, title, difficulty, tags)
- Retrieves HTML problem descriptions
- Extracts code snippets for multiple languages
- Parses sample test cases
- Handles LeetCode rate limiting (429 responses)

**API Functions:**

```typescript
// Fetch paginated problem list
fetchProblemList(
  page: number,
  pageSize: number,
  difficulty?: 'Easy' | 'Medium' | 'Hard',
  tags?: string[]
): Promise<ProblemSummary[]>

// Fetch detailed problem information
fetchProblem(titleSlug: string): Promise<ProblemDetails>
```

### C++ Harness Generator

Located in `src/services/harness/`, the harness generator creates complete executable C++ code for LeetCode problems.

**Purpose:** LeetCode problems provide Solution class templates, but they need a main function and input parsing to be executable. The harness generator bridges this gap.

**Components:**

1. **Signature Parser** (`signature-parser.ts`):
   - Parses C++ function signatures from LeetCode code snippets
   - Extracts return type, function name, and parameters
   - Handles complex types: `vector<int>`, `ListNode*`, `TreeNode*`, `const string&`, etc.
   - Maps types to appropriate deserializer/serializer functions

2. **Harness Generator** (`generator.ts`):
   - Generates complete C++ source code
   - Includes user Solution class
   - Deserializes JSON input to C++ types
   - Calls the solution method
   - Serializes result back to JSON

**Supported Types:**

| C++ Type | Deserializer | Serializer |
|----------|--------------|------------|
| `int` | `deserializeInt` | `serializePrimitive` |
| `long`/`long long` | `deserializeLong` | `serializePrimitive` |
| `double`/`float` | `deserializeDouble` | `serializePrimitive` |
| `string` | `deserializeString` | `serializeString` |
| `bool` | `deserializeBool` | `serializePrimitive` |
| `vector<int>` | `deserializeIntVector` | `serializeVector` |
| `vector<string>` | `deserializeStringVector` | `serializeVector` |
| `vector<vector<T>>` | `deserialize2DVector` | `serialize2DVector` |
| `ListNode*` | `deserializeListNode` | `serializeListNode` |
| `TreeNode*` | `deserializeTreeNode` | `serializeTreeNode` |

**Example Harness Output:**

```cpp
#include <bits/stdc++.h>
#include "structures.hpp"
#include "deserializers.hpp"
#include "serializers.hpp"
using namespace std;

// User's Solution class
class Solution {
public:
    int add(int a, int b) {
        return a + b;
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    string jsonInput;
    getline(cin, jsonInput);
    
    try {
        vector<json> inputs = parseJsonArray(jsonInput);
        
        int a = deserializeInt(inputs[0]);
        int b = deserializeInt(inputs[1]);
        
        Solution solution;
        auto result = solution.add(a, b);
        
        cout << serializePrimitive(result) << endl;
        
    } catch (const exception& e) {
        cerr << "Error: " << e.what() << endl;
        return 1;
    }
    
    return 0;
}
```

## API Reference

### GET /api/problems

Fetch paginated list of LeetCode problems.

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | number | Page number (1-indexed) | 1 |
| `pageSize` | number | Items per page (max 100) | 20 |
| `difficulty` | string | Filter by difficulty (Easy/Medium/Hard) | - |
| `tags` | string | Comma-separated topic tags | - |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "titleSlug": "two-sum",
      "title": "Two Sum",
      "difficulty": "Easy",
      "topicTags": ["array", "hash-table"]
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "count": 20
  }
}
```

### GET /api/problems/:slug

Fetch detailed information for a specific problem.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "titleSlug": "two-sum",
    "title": "Two Sum",
    "difficulty": "Easy",
    "content": "<p>Given an array...</p>",
    "topicTags": ["array", "hash-table"],
    "codeSnippets": {
      "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        ...\n    }\n};"
    },
    "sampleTestCases": [
      {
        "input": "[2,7,11,15]\n9",
        "expectedOutput": "[0,1]"
      }
    ]
  }
}
```

### POST /api/harness

Generate C++ harness code for a LeetCode problem.

**Request Body:**

```json
{
  "problemSlug": "two-sum",
  "userCode": "class Solution { ... }",  // Optional
  "testInput": "[[2,7,11,15], 9]"          // JSON array
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "code": "// Complete C++ source code...",
    "problem": {
      "title": "Two Sum",
      "titleSlug": "two-sum",
      "difficulty": "Easy"
    },
    "signature": {
      "returnType": "vector<int>",
      "functionName": "twoSum",
      "parameters": [
        { "type": "vector<int>&", "name": "nums" },
        { "type": "int", "name": "target" }
      ]
    }
  }
}
```

## Configuration

Environment variables (defined in `.env`):

```env
# Server
PORT=4000
NODE_ENV=development

# Docker
EXECUTOR_IMAGE=dsa-visualizer-executor:latest

# Timeouts
MAX_COMPILE_TIMEOUT_MS=30000
MAX_RUN_TIMEOUT_MS=5000
MAX_TRACE_STEPS=1000

# Rate Limiting
TRACE_RATE_LIMIT=10
COMPILE_RATE_LIMIT=30

# Security
CORS_ORIGIN=*
MAX_REQUEST_SIZE=1mb
```

## Architecture Notes

### Middleware Pipeline

The Express app uses the following middleware order (important for correct operation):

1. **helmet()** - Security headers (CSP, HSTS, etc.)
2. **cors()** - Cross-origin request handling
3. **express.json()** - Request body parsing with size limits
4. **Rate Limiters** - Request throttling per endpoint
5. **Route Handlers** - Business logic execution
6. **Error Handler** - Global error handling (must be last)

### LeetCode API Considerations

**Rate Limiting:**
- LeetCode's GraphQL API has unofficial rate limits
- The client catches 429 responses and throws `RateLimitError`
- Backend returns 502 Bad Gateway with meaningful error messages

**Caching Strategy:**
- Problem data is fetched fresh on each request (no caching)
- Consider adding Redis for caching problem metadata in production

**Error Resilience:**
- GraphQL errors are parsed and reported
- Network failures are caught and logged
- Invalid problem slugs return 404

### Harness Generation Flow

```
POST /api/harness
        |
        v
Fetch Problem from LeetCode
        |
        v
Extract C++ Code Snippet
        |
        v
Parse Function Signature
        |
        v
Generate Deserializers (per param type)
        |
        v
Generate Function Call
        |
        v
Generate Serializer (per return type)
        |
        v
Assemble Complete C++ Source
```

### Security Considerations

- All inputs validated with Zod schemas
- Code size limits (50KB for code, 1MB for input)
- Rate limiting prevents abuse
- Docker container runs with no network, read-only filesystem
- Binary IDs use UUID v4 to prevent path traversal

## Testing

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test
bun test tests/problems.test.ts
```

## Development

### Adding New LeetCode Types

To add support for a new C++ type in the harness generator:

1. **Update `signature-parser.ts`:**
   - Add type detection in `getDeserializerForType()`
   - Add type detection in `getSerializerForType()`

2. **Update executor templates:**
   - Add deserializer function in `executor/templates/deserializers.hpp`
   - Add serializer function in `executor/templates/serializers.hpp`

3. **Add test cases** for the new type

### Debugging Harness Generation

Enable debug logging:

```typescript
// In src/services/harness/generator.ts
logger.debug('Generating harness', { problemSlug, signature });
```

Run with debug output:
```bash
DEBUG=* bun run dev
```

## Integration with Frontend

The LeetCode endpoints are designed to work with the frontend's problem browser:

1. **Problem List** (`GET /api/problems`): Populates the problem browser grid
2. **Problem Details** (`GET /api/problems/:slug`): Shows problem description and starter code
3. **Harness Generation** (`POST /api/harness`): Converts solution code to executable form for tracing

## License

MIT - See main project LICENSE file
