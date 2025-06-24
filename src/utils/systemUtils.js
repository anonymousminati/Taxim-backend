/**
 * System requirements and installation check utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check Manim installation
 */
export async function checkManimInstallation() {
  try {
    const { stdout } = await execAsync("manim --version");
    return {
      installed: true,
      version: stdout.trim(),
    };
  } catch (error) {
    return {
      installed: false,
      error: error.message,
    };
  }
}

/**
 * Check FFmpeg installation
 */
export async function checkFFmpegInstallation() {
  try {
    const { stdout } = await execAsync("ffmpeg -version");
    const versionLine = stdout.split("\n")[0];
    return {
      installed: true,
      version: versionLine.trim(),
    };
  } catch (error) {
    return {
      installed: false,
      error: error.message,
    };
  }
}

/**
 * Check LaTeX installation
 */
export async function checkLatexInstallation() {
  try {
    const { stdout } = await execAsync("pdflatex --version");
    return {
      installed: true,
      version: stdout.split('\n')[0].trim()
    };
  } catch (error) {
    return {
      installed: false,
      error: error.message
    };
  }
}

/**
 * Check all system requirements
 */
export async function checkSystemRequirements() {
  const [manim, ffmpeg, latex] = await Promise.all([
    checkManimInstallation(),
    checkFFmpegInstallation(),
    checkLatexInstallation()
  ]);

  return {
    manim,
    ffmpeg,
    latex,
    allRequirementsMet: manim.installed && ffmpeg.installed && latex.installed,
  };
}

/**
 * Optimized Manim command variations for rendering
 * Reduced from 4 to 3 most reliable commands
 */
export function getManimCommands(pythonFilePath, className) {
  return [
    // Default recommended (with caching disabled to prevent stale renders)
    `manim -pql --disable_caching ${JSON.stringify(pythonFilePath)} ${className}`,
    // Legacy format fallback
    `manim -p -ql --disable_caching ${JSON.stringify(pythonFilePath)} ${className}`,
    // Python module fallback (most compatible)
    `python -m manim -pql --disable_caching ${JSON.stringify(pythonFilePath)} ${className}`,
  ];
}
