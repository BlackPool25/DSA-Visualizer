/**
 * @file config.ts
 * @description Environment configuration management for the DSA Visualizer backend.
 * Loads configuration from environment variables with sensible defaults for development.
 * All configuration is validated at startup to fail fast on missing required values.
 */

/**
 * Application configuration object containing all environment-based settings.
 * These values control server behavior, Docker execution, and security limits.
 */
export const config = {
  /** Server port - defaults to 4000 for development */
  PORT: parseInt(process.env.PORT || "4000", 10),

  /** Node environment - 'development' or 'production' */
  NODE_ENV: (process.env.NODE_ENV || "development") as
    | "development"
    | "production",

  /** Docker image name for the code executor container */
  EXECUTOR_IMAGE: process.env.EXECUTOR_IMAGE || "dsa-executor:latest",

  /** Maximum time allowed for compilation in milliseconds (default: 30 seconds) */
  MAX_COMPILE_TIMEOUT_MS: parseInt(
    process.env.MAX_COMPILE_TIMEOUT_MS || "30000",
    10,
  ),

  /** Maximum time allowed for code execution in milliseconds (default: 5 seconds) */
  MAX_RUN_TIMEOUT_MS: parseInt(process.env.MAX_RUN_TIMEOUT_MS || "5000", 10),

  /** Maximum number of trace steps to capture (default: 5000) */
  MAX_TRACE_STEPS: parseInt(process.env.MAX_TRACE_STEPS || "5000", 10),

  /** Trace execution timeout in milliseconds (default: 120 seconds) */
  TRACE_TIMEOUT_MS: parseInt(process.env.TRACE_TIMEOUT_MS || "120000", 10),

  /** Memory budget for trace containers in MB (default: 1024MB) */
  TRACE_CONTAINER_MEMORY_MB: parseInt(
    process.env.TRACE_CONTAINER_MEMORY_MB || "1024",
    10,
  ),

  /** Directory for temporary files - defaults to system temp directory */
  TEMP_DIR: process.env.TEMP_DIR || "/tmp/dsa-visualizer",

  /** Rate limit for trace endpoint: requests per minute per IP */
  TRACE_RATE_LIMIT: parseInt(process.env.TRACE_RATE_LIMIT || "10", 10),

  /** Rate limit for compile/run endpoints: requests per minute per IP */
  COMPILE_RATE_LIMIT: parseInt(process.env.COMPILE_RATE_LIMIT || "30", 10),

  /** Maximum size of request body in bytes (default: 1MB) */
  MAX_REQUEST_SIZE: process.env.MAX_REQUEST_SIZE || "1mb",

  /** CORS origin - set to specific origin in production, '*' for development */
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
} as const;

/**
 * Validates that all required configuration values are present and valid.
 * Throws an error if critical configuration is missing.
 *
 * @throws Error if required configuration is missing or invalid
 */
export function validateConfig(): void {
  const requiredVars = ["EXECUTOR_IMAGE"];
  const missing = requiredVars.filter(
    (key) => !process.env[key] && !config[key as keyof typeof config],
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  // Validate numeric values are positive
  if (config.MAX_COMPILE_TIMEOUT_MS <= 0) {
    throw new Error("MAX_COMPILE_TIMEOUT_MS must be a positive number");
  }

  if (config.MAX_RUN_TIMEOUT_MS <= 0) {
    throw new Error("MAX_RUN_TIMEOUT_MS must be a positive number");
  }

  if (config.MAX_TRACE_STEPS <= 0 || config.MAX_TRACE_STEPS > 50000) {
    throw new Error("MAX_TRACE_STEPS must be between 1 and 50000");
  }

  if (config.TRACE_TIMEOUT_MS <= 0) {
    throw new Error("TRACE_TIMEOUT_MS must be a positive number");
  }

  if (
    config.TRACE_CONTAINER_MEMORY_MB <= 0 ||
    config.TRACE_CONTAINER_MEMORY_MB > 8192
  ) {
    throw new Error("TRACE_CONTAINER_MEMORY_MB must be between 1 and 8192");
  }

  console.log("✓ Configuration validated successfully");
}

/** Export type for configuration object */
export type Config = typeof config;
