/**
 * Retry utilities for robust error handling and recovery
 */

/**
 * Execute a function with exponential backoff retry
 */
export async function executeWithRetry(
  fn,
  maxRetries = 3,
  initialDelay = 1000,
  backoffMultiplier = 2,
  shouldRetry = () => true
) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      return { success: true, result, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      
      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        break;
      }
      
      // Don't delay after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return {
    success: false,
    error: lastError,
    attempts: maxRetries
  };
}

/**
 * Execute multiple strategies in sequence until one succeeds
 */
export async function executeWithFallback(strategies, context = {}) {
  const results = [];
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    try {
      console.log(`Trying strategy ${i + 1}/${strategies.length}: ${strategy.name || 'unnamed'}`);
      const result = await strategy.execute(context);
      
      return {
        success: true,
        result,
        strategyUsed: i,
        strategyName: strategy.name,
        attempts: results.length + 1
      };
    } catch (error) {
      console.error(`Strategy ${i + 1} failed:`, error.message);
      results.push({
        strategy: strategy.name || `Strategy ${i + 1}`,
        error: error.message
      });
      
      // If this strategy has a condition to skip further attempts
      if (strategy.stopOnFailure) {
        break;
      }
    }
  }
  
  return {
    success: false,
    attempts: results.length,
    errors: results
  };
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5; // failure threshold
    this.timeout = options.timeout || 60000; // reset timeout (1 minute)
    this.monitor = options.monitor || 10000; // monitoring window (10 seconds)
    
    this.failures = 0;
    this.lastFailTime = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = 'HALF_OPEN';
        console.log('Circuit breaker: Switching to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - too many recent failures');
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        console.log('Circuit breaker: Reset to CLOSED state after successful call');
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  recordFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker: Switching to OPEN state after ${this.failures} failures`);
    }
  }
  
  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailTime = 0;
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime,
      isHealthy: this.state === 'CLOSED'
    };
  }
}

/**
 * Rate limiter to prevent overwhelming external services
 */
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  async execute(fn) {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);
      
      console.log(`Rate limit reached, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Recursive call after waiting
      return this.execute(fn);
    }
    
    this.requests.push(now);
    return await fn();
  }
  
  getStatus() {
    const now = Date.now();
    const activeRequests = this.requests.filter(time => now - time < this.windowMs);
    
    return {
      activeRequests: activeRequests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      available: this.maxRequests - activeRequests.length
    };
  }
}

/**
 * Timeout wrapper with graceful cancellation
 */
export async function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
  let timeoutHandle;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${timeoutMessage} after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Retry specific error types with different strategies
 */
export function createRetryCondition(retryableErrors = [], maxRetries = 3) {
  const attemptCounts = new Map();
  
  return (error, attempt) => {
    const errorType = error.constructor.name;
    const errorMessage = error.message.toLowerCase();
    
    // Check if this error type is retryable
    const isRetryable = retryableErrors.some(pattern => {
      if (typeof pattern === 'string') {
        return errorMessage.includes(pattern.toLowerCase());
      }
      if (pattern instanceof RegExp) {
        return pattern.test(errorMessage);
      }
      if (typeof pattern === 'function') {
        return pattern(error);
      }
      return false;
    });
    
    if (!isRetryable) {
      console.log(`Error type '${errorType}' is not retryable: ${error.message}`);
      return false;
    }
    
    // Track attempts per error type
    const count = attemptCounts.get(errorType) || 0;
    attemptCounts.set(errorType, count + 1);
    
    const shouldRetry = attempt < maxRetries - 1;
    if (!shouldRetry) {
      console.log(`Max retries reached for error type '${errorType}'`);
    }
    
    return shouldRetry;
  };
}
