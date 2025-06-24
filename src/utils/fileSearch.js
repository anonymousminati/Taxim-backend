/**
 * File search and media utilities for Manim video processing
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Find the most recently created MP4 file in a directory and subdirectories
 */
export function findLatestMP4File(searchDir) {
  let latestFile = null;
  let latestTime = 0;

  const searchRecursive = (dir) => {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          searchRecursive(itemPath);
        } else if (item.endsWith(".mp4")) {
          if (stat.mtime.getTime() > latestTime) {
            latestTime = stat.mtime.getTime();
            latestFile = itemPath;
          }
        }
      }
    } catch (error) {
      console.warn(`Could not search directory ${dir}:`, error.message);
    }
  };

  searchRecursive(searchDir);
  return latestFile;
}

/**
 * Find video file in media directory with various naming patterns
 */
export function findVideoInMediaDir(mediaDir, className, baseFileName) {
  const possiblePaths = [
    // Standard Manim output structure: media/videos/filename/quality/ClassName.mp4
    path.join(mediaDir, "videos", baseFileName, "480p15", `${className}.mp4`),
    path.join(mediaDir, "videos", baseFileName, "720p30", `${className}.mp4`),
    path.join(mediaDir, "videos", baseFileName, "1080p60", `${className}.mp4`),
    path.join(mediaDir, "videos", baseFileName, "low_quality", `${className}.mp4`),
    path.join(mediaDir, "videos", baseFileName, "medium_quality", `${className}.mp4`),
    path.join(mediaDir, "videos", baseFileName, "high_quality", `${className}.mp4`),
    // Alternative patterns
    path.join(mediaDir, "videos", `${className}.mp4`),
    path.join(mediaDir, `${className}.mp4`),
    path.join(mediaDir, `${baseFileName}.mp4`),
  ];

  for (const videoPath of possiblePaths) {
    if (fs.existsSync(videoPath)) {
      console.log(`Found video in media directory: ${videoPath}`);
      return videoPath;
    }
  }

  // If standard paths don't work, search recursively
  return findLatestMP4File(mediaDir);
}

/**
 * List directory contents recursively for debugging
 */
export function listDirectoryRecursive(dir, prefix = "", maxDepth = 3, currentDepth = 0) {
  try {
    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      console.log(`${prefix}... (max depth reached)`);
      return;
    }

    const items = fs.readdirSync(dir);
    items.forEach((item) => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        console.log(`${prefix}📁 ${item}/`);
        listDirectoryRecursive(itemPath, prefix + "  ", maxDepth, currentDepth + 1);
      } else {
        console.log(`${prefix}📄 ${item} (${stat.size} bytes)`);
      }
    });
  } catch (error) {
    console.warn(`Could not list directory ${dir}:`, error.message);
  }
}

/**
 * Generate unique temporary filename with UUID
 */
export function generateTempFilename(prefix = "temp", extension = ".py") {
  return `${prefix}_${uuidv4().slice(0, 8)}${extension}`;
}

/**
 * Get current timestamp utility
 */
export const getTimestamp = () => Date.now();

/**
 * Enhanced file cleanup with safety limits
 */
export async function safeFileCleanup(directory, maxAgeMs, maxFilesToDelete = 1000) {
  if (!fs.existsSync(directory)) {
    return { cleaned: 0, skipped: 0 };
  }

  const now = Date.now();
  const files = fs.readdirSync(directory);
  let cleanedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    // Safety check: don't delete too many files
    if (cleanedCount >= maxFilesToDelete) {
      console.warn(`Hit max deletion limit (${maxFilesToDelete}), stopping cleanup`);
      break;
    }

    try {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        const fileAge = now - stat.mtime.getTime();
        const hoursOld = Math.round(fileAge / (1000 * 60 * 60));

        if (fileAge > maxAgeMs) {
          fs.unlinkSync(filePath);
          cleanedCount++;
          console.log(`Removed ${file} (${hoursOld} hours old)`);
        } else {
          skippedCount++;
        }
      }
    } catch (fileError) {
      console.warn(`Failed to process file ${file}:`, fileError.message);
      skippedCount++;
    }
  }

  return { cleaned: cleanedCount, skipped: skippedCount };
}
