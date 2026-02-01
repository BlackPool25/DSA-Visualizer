/**
 * @file tempFiles.ts
 * @description Temporary file management utilities for storing source code,
 * compiled binaries, and input files during code execution.
 * All temporary files are created in isolated directories and cleaned up after use.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { logger } from './logger.js';

/**
 * Creates a unique temporary directory for a compilation/execution session.
 *
 * @returns Object containing the unique ID and directory path
 * @throws Error if directory creation fails
 */
export async function createTempDirectory(): Promise<{ id: string; dirPath: string }> {
  const id = uuidv4();
  const dirPath = path.join(config.TEMP_DIR, id);

  try {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug(`Created temp directory: ${dirPath}`);
    return { id, dirPath };
  } catch (error) {
    logger.error(`Failed to create temp directory: ${dirPath}`, { error });
    throw new Error(`Failed to create temp directory: ${error}`);
  }
}

/**
 * Writes source code to a temporary file.
 *
 * @param dirPath - Directory path where the file should be written
 * @param filename - Name of the file (e.g., 'solution.cpp')
 * @param content - Content to write to the file
 * @returns Full path to the created file
 * @throws Error if file write fails
 */
export async function writeSourceFile(dirPath: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(dirPath, filename);

  try {
    await fs.writeFile(filePath, content, 'utf8');
    logger.debug(`Wrote source file: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`Failed to write source file: ${filePath}`, { error });
    throw new Error(`Failed to write source file: ${error}`);
  }
}

/**
 * Writes input data to a temporary file for program execution.
 *
 * @param dirPath - Directory path where the file should be written
 * @param content - Input content to write
 * @returns Full path to the created input file
 * @throws Error if file write fails
 */
export async function writeInputFile(dirPath: string, content: string): Promise<string> {
  const filePath = path.join(dirPath, 'input.txt');

  try {
    await fs.writeFile(filePath, content, 'utf8');
    logger.debug(`Wrote input file: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error(`Failed to write input file: ${filePath}`, { error });
    throw new Error(`Failed to write input file: ${error}`);
  }
}

/**
 * Reads the contents of a file from the temporary directory.
 *
 * @param filePath - Path to the file to read
 * @returns File contents as string
 * @throws Error if file read fails
 */
export async function readTempFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    logger.error(`Failed to read temp file: ${filePath}`, { error });
    throw new Error(`Failed to read temp file: ${error}`);
  }
}

/**
 * Checks if a binary file exists in the temporary directory.
 *
 * @param binaryId - Unique identifier for the binary
 * @returns True if binary exists, false otherwise
 */
export async function binaryExists(binaryId: string): Promise<boolean> {
  const binaryPath = path.join(config.TEMP_DIR, binaryId, 'solution');

  try {
    await fs.access(binaryPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the full path to a binary file.
 *
 * @param binaryId - Unique identifier for the binary
 * @returns Full path to the binary
 */
export function getBinaryPath(binaryId: string): string {
  return path.join(config.TEMP_DIR, binaryId, 'solution');
}

/**
 * Gets the full path to a source file.
 *
 * @param binaryId - Unique identifier for the compilation
 * @returns Full path to the source file
 */
export function getSourcePath(binaryId: string): string {
  return path.join(config.TEMP_DIR, binaryId, 'solution.cpp');
}

/**
 * Cleans up a temporary directory and all its contents.
 *
 * @param binaryId - Unique identifier for the directory to clean up
 */
export async function cleanupTempDirectory(binaryId: string): Promise<void> {
  const dirPath = path.join(config.TEMP_DIR, binaryId);

  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug(`Cleaned up temp directory: ${dirPath}`);
  } catch (error) {
    // Log but don't throw - cleanup failures shouldn't break the flow
    logger.warn(`Failed to cleanup temp directory: ${dirPath}`, { error });
  }
}

/**
 * Validates that a binary ID is a valid UUID format to prevent path traversal attacks.
 *
 * @param id - The ID to validate
 * @returns True if valid UUID format, false otherwise
 */
export function isValidBinaryId(id: string): boolean {
  // UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
