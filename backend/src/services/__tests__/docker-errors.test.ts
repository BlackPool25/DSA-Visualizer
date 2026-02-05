/**
 * @file docker-errors.test.ts
 * @description Tests for Docker error classes
 */

import { describe, it, expect } from "bun:test";
import {
  DockerExecutionError,
  DockerTimeoutError,
  DockerConnectionError,
  DockerImageNotFoundError,
  DockerOutputLimitError,
  isDockerExecutionError,
  isDockerTimeoutError,
  isDockerConnectionError,
} from "../docker-errors.js";

describe("Docker Errors", () => {
  describe("DockerExecutionError", () => {
    it("should create error with all properties", () => {
      const error = new DockerExecutionError(
        "Command failed",
        1,
        "stdout content",
        "stderr content",
        1000,
      );

      expect(error.message).toBe("Command failed");
      expect(error.exitCode).toBe(1);
      expect(error.stdout).toBe("stdout content");
      expect(error.stderr).toBe("stderr content");
      expect(error.duration).toBe(1000);
      expect(error.name).toBe("DockerExecutionError");
    });

    it("should provide summary for logging", () => {
      const error = new DockerExecutionError(
        "Command failed",
        1,
        "stdout",
        "stderr",
        1000,
      );

      const summary = error.getSummary();
      expect(summary.name).toBe("DockerExecutionError");
      expect(summary.exitCode).toBe(1);
      expect(summary.duration).toBe(1000);
    });
  });

  describe("DockerTimeoutError", () => {
    it("should create timeout error with timeoutMs", () => {
      const error = new DockerTimeoutError("stdout", "stderr", 5000, 30000);

      expect(error.message).toBe("Execution timed out after 30000ms");
      expect(error.exitCode).toBe(124);
      expect(error.timeoutMs).toBe(30000);
      expect(error.name).toBe("DockerTimeoutError");
    });
  });

  describe("DockerConnectionError", () => {
    it("should create connection error", () => {
      const originalError = new Error("Connection refused");
      const error = new DockerConnectionError(
        "Docker not accessible",
        originalError,
      );

      expect(error.message).toBe("Docker not accessible");
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe("DockerConnectionError");
    });
  });

  describe("DockerImageNotFoundError", () => {
    it("should create image not found error", () => {
      const error = new DockerImageNotFoundError("my-image:latest");

      expect(error.message).toContain("my-image:latest");
      expect(error.message).toContain("docker-compose build");
      expect(error.name).toBe("DockerImageNotFoundError");
    });
  });

  describe("DockerOutputLimitError", () => {
    it("should create output limit error", () => {
      const error = new DockerOutputLimitError(
        "stdout",
        "stderr",
        1000,
        10 * 1024 * 1024,
      );

      expect(error.message).toContain("10");
      expect(error.limitBytes).toBe(10 * 1024 * 1024);
      expect(error.name).toBe("DockerOutputLimitError");
    });
  });

  describe("Type Guards", () => {
    it("should identify DockerExecutionError", () => {
      const error = new DockerExecutionError("test", 1, "", "", 0);
      expect(isDockerExecutionError(error)).toBe(true);
      expect(isDockerExecutionError(new Error())).toBe(false);
    });

    it("should identify DockerTimeoutError", () => {
      const error = new DockerTimeoutError("", "", 0, 1000);
      expect(isDockerTimeoutError(error)).toBe(true);
      expect(isDockerTimeoutError(new Error())).toBe(false);
    });

    it("should identify DockerConnectionError", () => {
      const error = new DockerConnectionError("test");
      expect(isDockerConnectionError(error)).toBe(true);
      expect(isDockerConnectionError(new Error())).toBe(false);
    });
  });
});
