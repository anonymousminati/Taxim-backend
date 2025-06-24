/**
 * LaTeX utility functions for Manim code processing
 */

import { PROMPT_CONFIG } from '../prompts.js';

// Memoization cache for LaTeX error detection
const latexErrorCache = new Map();

/**
 * Common LaTeX error patterns
 */
export const LATEX_ERROR_PATTERNS = [
  /LaTeX Error/i,
  /tex error/i,
  /missing \$ inserted/i,
  /undefined control sequence/i,
  /pdflatex.*failed/i,
  /latex.*not found/i,
  /RuntimeError.*latex/i,
  /failed but did not produce a log file/i
];

/**
 * Check if an error message indicates a LaTeX-related issue (memoized)
 */
export function isLatexError(errorMessage) {
  // Create cache key from error message
  const cacheKey = errorMessage.substring(0, 200); // Limit key size
  
  if (latexErrorCache.has(cacheKey)) {
    return latexErrorCache.get(cacheKey);
  }
  
  const result = LATEX_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage));
  
  // Cache result (limit cache size to prevent memory leaks)
  if (latexErrorCache.size > 100) {
    const firstKey = latexErrorCache.keys().next().value;
    latexErrorCache.delete(firstKey);
  }
  
  latexErrorCache.set(cacheKey, result);
  return result;
}

/**
 * Handle LaTeX-specific errors and provide fixes
 */
export function handleLatexError(code, errorMessage) {
  if (!isLatexError(errorMessage)) {
    return null; // Not a LaTeX error
  }
  
  console.log('Detected LaTeX error, attempting automatic fixes...');
  let fixedCode = code;
  
  // Fix common LaTeX syntax issues
  fixedCode = fixedCode.replace(/MathTex\("([^"]*?)"\)/g, (match, content) => {
    // Ensure proper escaping
    const escaped = content.replace(/\\/g, '\\\\');
    return `MathTex(r"${escaped}")`;
  });
  
  // Fix single backslashes in raw strings
  fixedCode = fixedCode.replace(/MathTex\(r"([^"]*?)"\)/g, (match, content) => {
    if (!content.includes('\\\\')) {
      const fixed = content.replace(/\\/g, '\\\\');
      return `MathTex(r"${fixed}")`;
    }
    return match;
  });
  
  // Fix Tex objects similarly
  fixedCode = fixedCode.replace(/Tex\("([^"]*?)"\)/g, (match, content) => {
    const escaped = content.replace(/\\/g, '\\\\');
    return `Tex(r"${escaped}")`;
  });
  
  // Simplify complex LaTeX expressions that might be causing issues
  fixedCode = fixedCode.replace(/MathTex\(r"([^"]*?)"\)/g, (match, content) => {
    // Simplify very complex expressions
    if (content.length > 50) {
      return `MathTex(r"x^2")`;  // Fallback to simple expression
    }
    return match;
  });
  
  console.log('Applied LaTeX fixes to code');
  return fixedCode;
}

/**
 * Common regex replace function for LaTeX fallbacks
 */
function replaceLatexWithFallback(code, pattern, fallbackFn) {
  return code.replace(pattern, fallbackFn);
}

/**
 * Create fallback code when LaTeX completely fails
 */
export function createLatexFallback(code) {
  console.log('Creating LaTeX fallback code...');
  let fallbackCode = code;
  
  // Use configurable fallback expression
  const fallbackExpr = PROMPT_CONFIG.LATEX_FALLBACK_EXPR;
  
  // Replace MathTex with Text using common function
  fallbackCode = replaceLatexWithFallback(
    fallbackCode,
    /MathTex\([^)]+\)/g,
    () => 'Text("Math Expression", font_size=36)'
  );
  
  // Replace Tex with Text using common function
  fallbackCode = replaceLatexWithFallback(
    fallbackCode,
    /Tex\([^)]+\)/g,
    () => 'Text("LaTeX Text", font_size=36)'
  );
  
  // Replace NumberPlane with simple grid
  fallbackCode = replaceLatexWithFallback(
    fallbackCode,
    /NumberPlane\([^)]*\)/g,
    () => 'Rectangle(width=12, height=8).set_stroke(WHITE, 0.5)'
  );
  
  // Replace Axes with simple lines
  fallbackCode = replaceLatexWithFallback(
    fallbackCode,
    /Axes\([^)]*\)/g,
    () => 'VGroup(Line(LEFT*6, RIGHT*6), Line(DOWN*4, UP*4))'
  );
  
  // If specific math expressions failed, replace with simple fallback
  if (fallbackExpr !== 'x^2') {
    fallbackCode = replaceLatexWithFallback(
      fallbackCode,
      /MathTex\(r"[^"]*"\)/g,
      () => `MathTex(r"${fallbackExpr}")`
    );
  }
  
  console.log('Created LaTeX fallback code');
  return fallbackCode;
}

/**
 * Clear the LaTeX error cache (for testing or memory management)
 */
export function clearLatexErrorCache() {
  latexErrorCache.clear();
}
