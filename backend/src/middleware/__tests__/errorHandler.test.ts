/**
 * @file errorHandler.test.ts
 * @description Tests for Express error handling middleware
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  isAppError,
} from "../errorHandler.js";

describe("Error Classes", () => {
  describe("AppError", () => {
    it("should create operational error with default values", () => {
      const error = new AppError("Something went wrong");

      expect(error.message).toBe("Something went wrong");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("AppError");
    });

    it("should create error with custom status code", () => {
      const error = new AppError("Not found", 404);

      expect(error.statusCode).toBe(404);
    });

    it("should create non-operational error", () => {
      const error = new AppError("Bug!", 500, false);

      expect(error.isOperational).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("should create 400 validation error", () => {
      const error = new ValidationError("Invalid input");

      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
    });
  });

  describe("NotFoundError", () => {
    it("should create 404 not found error", () => {
      const error = new NotFoundError("User");

      expect(error.message).toBe("User not found");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });
  });

  describe("RateLimitError", () => {
    it("should create 429 rate limit error", () => {
      const error = new RateLimitError(60);

      expect(error.message).toBe("Too many requests");
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe("RateLimitError");
    });
  });

  describe("isAppError type guard", () => {
    it("should identify AppError instances", () => {
      const error = new AppError("test");
      expect(isAppError(error)).toBe(true);
    });

    it("should identify subclasses of AppError", () => {
      expect(isAppError(new ValidationError("test"))).toBe(true);
      expect(isAppError(new NotFoundError("test"))).toBe(true);
    });

    it("should return false for regular errors", () => {
      expect(isAppError(new Error("test"))).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });
  });
});
