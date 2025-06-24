/**
 * Enhanced error handling utilities for the Manim backend
 */

/**
 * Custom error classes for better error categorization
 */
export class ManimError extends Error {
  constructor(message, code = 'MANIM_ERROR', details = {}) {
    super(message);
    this.name = 'ManimError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class ManimRenderError extends ManimError {
  constructor(message, details = {}) {
    super(message, 'MANIM_RENDER_ERROR', details);
    this.name = 'ManimRenderError';
  }
}

export class ManimCodeError extends ManimError {
  constructor(message, details = {}) {
    super(message, 'MANIM_CODE_ERROR', details);
    this.name = 'ManimCodeError';
  }
}

export class ManimLatexError extends ManimError {
  constructor(message, details = {}) {
    super(message, 'MANIM_LATEX_ERROR', details);
    this.name = 'ManimLatexError';
  }
}

export class ManimTimeoutError extends ManimError {
  constructor(message, details = {}) {
    super(message, 'MANIM_TIMEOUT_ERROR', details);
    this.name = 'ManimTimeoutError';
  }
}

/**
 * Error classification utilities
 */
export const ErrorPatterns = {
  LATEX_ERRORS: [
    /latex.*error/i,
    /mathtext.*error/i,
    /missing.*tex/i,
    /latex.*failed/i,
    /tex.*not.*found/i,
    /invalid.*latex/i
  ],
  
  RENDER_ERRORS: [
    /rendering.*failed/i,
    /no.*video.*generated/i,
    /ffmpeg.*error/i,
    /output.*file.*not.*found/i,
    /manim.*command.*failed/i
  ],
  
  CODE_ERRORS: [
    /syntax.*error/i,
    /indentation.*error/i,
    /name.*error/i,
    /attribute.*error/i,
    /import.*error/i,
    /invalid.*syntax/i
  ],
  
  TIMEOUT_ERRORS: [
    /timeout/i,
    /timed.*out/i,
    /operation.*exceeded/i,
    /process.*killed/i
  ],
  
  DEPENDENCY_ERRORS: [
    /module.*not.*found/i,
    /package.*not.*installed/i,
    /command.*not.*found/i,
    /no.*such.*file/i
  ]
};

/**
 * Classify error type based on message patterns
 */
export function classifyError(error) {
  const message = error.message || error.toString();
  
  for (const [category, patterns] of Object.entries(ErrorPatterns)) {
    if (patterns.some(pattern => pattern.test(message))) {
      return category;
    }
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * Create appropriate error instance based on classification
 */
export function createTypedError(error, context = {}) {
  const classification = classifyError(error);
  const message = error.message || error.toString();
  const details = {
    originalError: error,
    classification,
    context,
    stack: error.stack
  };
  
  switch (classification) {
    case 'LATEX_ERRORS':
      return new ManimLatexError(message, details);
    case 'RENDER_ERRORS':
      return new ManimRenderError(message, details);
    case 'CODE_ERRORS':
      return new ManimCodeError(message, details);
    case 'TIMEOUT_ERRORS':
      return new ManimTimeoutError(message, details);
    default:
      return new ManimError(message, 'UNKNOWN_ERROR', details);
  }
}

/**
 * Error aggregator for collecting and analyzing multiple errors
 */
export class ErrorAggregator {
  constructor() {
    this.errors = [];
    this.startTime = Date.now();
  }
  
  add(error, context = {}) {
    const typedError = error instanceof ManimError ? error : createTypedError(error, context);
    this.errors.push({
      error: typedError,
      timestamp: Date.now(),
      context
    });
  }
  
  getByType(errorType) {
    return this.errors.filter(entry => 
      entry.error.name === errorType || entry.error.code === errorType
    );
  }
  
  getMostCommon() {
    const counts = {};
    this.errors.forEach(entry => {
      const type = entry.error.code;
      counts[type] = (counts[type] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => ({ type, count }));
  }
  
  getSummary() {
    const totalErrors = this.errors.length;
    const duration = Date.now() - this.startTime;
    const byType = this.getMostCommon();
    
    return {
      totalErrors,
      duration,
      errorsByType: byType,
      errorRate: totalErrors / (duration / 1000), // errors per second
      firstError: this.errors[0]?.error?.message,
      lastError: this.errors[this.errors.length - 1]?.error?.message
    };
  }
  
  clear() {
    this.errors = [];
    this.startTime = Date.now();
  }
}

/**
 * Enhanced error reporter with context and suggestions
 */
export class ErrorReporter {
  constructor(options = {}) {
    this.includeStack = options.includeStack || false;
    this.includeContext = options.includeContext || true;
    this.maxMessageLength = options.maxMessageLength || 500;
  }
  
  formatError(error, context = {}) {
    const typedError = error instanceof ManimError ? error : createTypedError(error, context);
    
    const report = {
      type: typedError.name,
      code: typedError.code,
      message: this._truncateMessage(typedError.message),
      timestamp: typedError.timestamp,
      classification: classifyError(typedError)
    };
    
    if (this.includeContext && context) {
      report.context = context;
    }
    
    if (this.includeStack && typedError.stack) {
      report.stack = typedError.stack;
    }
    
    // Add suggestions based on error type
    report.suggestions = this._getSuggestions(typedError);
    
    return report;
  }
  
  _truncateMessage(message) {
    if (message.length <= this.maxMessageLength) {
      return message;
    }
    return message.substring(0, this.maxMessageLength - 3) + '...';
  }
  
  _getSuggestions(error) {
    const suggestions = [];
    
    if (error instanceof ManimLatexError) {
      suggestions.push(
        'Try simplifying LaTeX expressions',
        'Check for missing LaTeX packages',
        'Use raw strings (r"") for LaTeX',
        'Consider using MathTex instead of Tex'
      );
    } else if (error instanceof ManimRenderError) {
      suggestions.push(
        'Check if Manim is properly installed',
        'Verify the scene class name',
        'Try reducing animation complexity',
        'Check available disk space'
      );
    } else if (error instanceof ManimCodeError) {
      suggestions.push(
        'Check Python syntax',
        'Verify all imports are correct',
        'Ensure proper indentation',
        'Check for typos in class/method names'
      );
    } else if (error instanceof ManimTimeoutError) {
      suggestions.push(
        'Simplify the animation',
        'Reduce animation duration',
        'Check system resources',
        'Try splitting into smaller scenes'
      );
    }
    
    return suggestions;
  }
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandling() {
  const errorReporter = new ErrorReporter({ includeStack: true });
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', errorReporter.formatError(error));
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', errorReporter.formatError(reason));
  });
}

/**
 * Safe async operation wrapper
 */
export async function safeAsync(fn, fallback = null, context = {}) {
  try {
    return await fn();
  } catch (error) {
    const typedError = createTypedError(error, context);
    console.error('Safe async operation failed:', typedError.message);
    
    if (typeof fallback === 'function') {
      try {
        return await fallback(typedError);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError.message);
        throw typedError;
      }
    }
    
    return fallback;
  }
}

/**
 * Error recovery strategies
 */
export const RecoveryStrategies = {
  /**
   * Retry with simplified parameters
   */
  simplify: async (originalFn, error, context) => {
    console.log('Attempting simplified recovery...');
    // Implementation would depend on the specific function
    return null;
  },
  
  /**
   * Use cached/fallback data
   */
  useFallback: async (fallbackData, error, context) => {
    console.log('Using fallback data for recovery...');
    return fallbackData;
  },
  
  /**
   * Reset state and retry
   */
  reset: async (resetFn, originalFn, error, context) => {
    console.log('Resetting state for recovery...');
    await resetFn();
    return await originalFn();
  }
};
