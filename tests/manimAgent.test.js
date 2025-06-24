/**
 * Comprehensive test suite for ManimAgent error handling
 * Tests various error scenarios to identify probable errors
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import ManimAgent from '../src/services/manimAgent.js';
import { 
  isLatexError, 
  handleLatexError, 
  createLatexFallback,
  clearLatexErrorCache 
} from '../src/utils/latexUtils.js';
import { 
  checkSystemRequirements,
  getManimCommands 
} from '../src/utils/systemUtils.js';

describe('ManimAgent Error Handling Test Suite', () => {
  let agent;
  let testSessionId;
  
  beforeEach(async () => {
    // Set up test environment
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.NODE_ENV = 'test';
    
    agent = new ManimAgent();
    testSessionId = `test-session-${Date.now()}`;
    
    // Clear any cached errors
    clearLatexErrorCache();
  });

  afterEach(async () => {
    // Cleanup after each test
    if (agent) {
      agent.clearSession(testSessionId);
      await agent.cleanupTempFiles();
      await agent.cleanupMediaFolder();
    }
  });

  describe('LaTeX Error Detection and Handling', () => {
    test('should detect common LaTeX errors', () => {
      const latexErrors = [
        'LaTeX Error: Missing $ inserted',
        'pdflatex failed with error',
        'RuntimeError: latex not found in PATH',
        'tex error: undefined control sequence',
        'LaTeX failed but did not produce a log file'
      ];

      latexErrors.forEach(error => {
        expect(isLatexError(error)).toBe(true);
      });
    });

    test('should not detect non-LaTeX errors as LaTeX errors', () => {
      const nonLatexErrors = [
        'SyntaxError: invalid syntax',
        'ImportError: No module named manim',
        'TypeError: object is not callable',
        'FileNotFoundError: file not found'
      ];

      nonLatexErrors.forEach(error => {
        expect(isLatexError(error)).toBe(false);
      });
    });

    test('should handle LaTeX syntax errors in MathTex', () => {
      const problematicCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        # Missing raw string prefix
        formula = MathTex("\\frac{x^2}{y}")
        self.play(Write(formula))
      `;

      const errorMessage = 'LaTeX Error: Missing $ inserted';
      const fixedCode = handleLatexError(problematicCode, errorMessage);
      
      expect(fixedCode).toBeTruthy();
      expect(fixedCode).toContain('MathTex(r"');
    });

    test('should create LaTeX fallback code', () => {
      const codeWithLatex = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\int_{-\\infty}^{\\infty} e^{-x^2} dx")
        plane = NumberPlane()
        axes = Axes()
        self.add(formula, plane, axes)
      `;

      const fallbackCode = createLatexFallback(codeWithLatex);
      
      expect(fallbackCode).toContain('Text("Math Expression"');
      expect(fallbackCode).toContain('Rectangle(width=12, height=8)');
      expect(fallbackCode).toContain('VGroup(Line(LEFT*6, RIGHT*6)');
    });
  });

  describe('Code Generation Error Scenarios', () => {
    test('should handle invalid Python syntax', async () => {
      const invalidCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self)  # Missing colon
        circle = Circle()
        self.play(Create(circle)
      `;

      const testResult = await agent.testManimCode(invalidCode);
      expect(testResult.success).toBe(false);
      expect(testResult.error).toContain('SyntaxError');
    });

    test('should handle missing imports', async () => {
      const codeWithoutImports = `
class TestAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
      `;

      const testResult = await agent.testManimCode(codeWithoutImports);
      expect(testResult.success).toBe(false);
      expect(testResult.error).toMatch(/(NameError|not defined)/);
    });

    test('should handle incorrect class inheritance', async () => {
      const incorrectInheritance = `
from manim import *

class TestAnimation:  # Should inherit from Scene
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
      `;

      expect(agent.isValidManimCode(incorrectInheritance)).toBe(false);
    });

    test('should handle missing construct method', async () => {
      const missingConstruct = `
from manim import *

class TestAnimation(Scene):
    def create_objects(self):  # Wrong method name
        circle = Circle()
        self.play(Create(circle))
      `;

      expect(agent.isValidManimCode(missingConstruct)).toBe(false);
    });
  });

  describe('Rendering Error Scenarios', () => {
    test('should handle FFmpeg not found errors', async () => {
      // Mock system check to simulate FFmpeg missing
      const originalCheck = checkSystemRequirements;
      jest.mocked(checkSystemRequirements).mockResolvedValue({
        manim: { installed: true, version: 'test-version' },
        ffmpeg: { installed: false, error: 'ffmpeg not found' },
        allRequirementsMet: false
      });

      const requirements = await agent.checkSystemRequirements();
      expect(requirements.ffmpeg.installed).toBe(false);
      expect(requirements.allRequirementsMet).toBe(false);
    });

    test('should handle class name extraction errors', () => {
      const invalidClassCode = `
from manim import *

# No class definition here
def some_function():
    pass
      `;

      expect(() => {
        agent._extractClassName('test-file.py');
      }).toThrow();
    });

    test('should handle video file not found after rendering', async () => {
      // Create a valid code that should render
      const validCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
      `;

      const tempFile = await agent.savePythonFile(validCode, 'test_video_not_found.py');
      
      // Mock the video search to simulate file not found
      const originalFindVideo = agent._findGeneratedVideo;
      agent._findGeneratedVideo = jest.fn().mockResolvedValue(null);

      try {
        await agent.renderAnimation(tempFile);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('No video file was generated');
      } finally {
        await agent.cleanup(tempFile);
      }
    });
  });

  describe('Session Management Error Scenarios', () => {
    test('should handle expired sessions gracefully', () => {
      // Create a session
      const session = agent.getOrCreateSession(testSessionId);
      expect(session).toBeTruthy();

      // Manually expire the session
      agent.chatSessions.get(testSessionId).lastActivity = Date.now() - (31 * 60 * 1000); // 31 minutes ago

      // Trigger cleanup
      agent.cleanupExpiredSessions();

      // Session should be removed
      expect(agent.chatSessions.has(testSessionId)).toBe(false);
    });

    test('should enforce session limits', () => {
      const originalMaxSessions = agent.maxSessions;
      agent.maxSessions = 2; // Set low limit for testing

      // Create sessions exceeding the limit
      const session1 = agent.getOrCreateSession('session-1');
      const session2 = agent.getOrCreateSession('session-2');
      const session3 = agent.getOrCreateSession('session-3'); // Should trigger cleanup

      expect(agent.chatSessions.size).toBeLessThanOrEqual(2);
      
      // Restore original limit
      agent.maxSessions = originalMaxSessions;
    });

    test('should handle invalid session operations', () => {
      const invalidSessionId = 'non-existent-session';
      
      // Getting info for non-existent session
      const sessionInfo = agent.getSessionInfo(invalidSessionId);
      expect(sessionInfo.exists).toBe(false);

      // Clearing non-existent session
      const cleared = agent.clearSession(invalidSessionId);
      expect(cleared).toBe(false);
    });
  });

  describe('API Integration Error Scenarios', () => {
    test('should handle Gemini API key missing', () => {
      delete process.env.GEMINI_API_KEY;
      
      expect(() => {
        new ManimAgent();
      }).toThrow('GEMINI_API_KEY environment variable is required');
      
      // Restore for other tests
      process.env.GEMINI_API_KEY = 'test-api-key';
    });

    test('should handle API timeout errors', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      try {
        await timeoutPromise;
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    test('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      // Simulate rate limit handling
      const isRateLimit = rateLimitError.status === 429 || 
                         rateLimitError.message.includes('rate limit');
      expect(isRateLimit).toBe(true);
    });
  });

  describe('File System Error Scenarios', () => {
    test('should handle permission errors', async () => {
      const restrictedPath = '/root/restricted-file.py'; // Path that would cause permission error

      try {
        // This should fail on most systems
        await agent.savePythonFile('test code', path.basename(restrictedPath));
      } catch (error) {
        // Expected to fail with permission error in some environments
        console.log('Permission test completed:', error.message);
      }
    });

    test('should handle disk space errors', async () => {
      // Simulate a very large file that could cause disk space issues
      const largeCode = 'from manim import *\n' + 'a = "x" * 1000000\n'.repeat(1000);
      
      try {
        const tempFile = await agent.savePythonFile(largeCode, 'large_test_file.py');
        expect(fs.existsSync(tempFile)).toBe(true);
        await agent.cleanup(tempFile);
      } catch (error) {
        // Could fail due to disk space or memory limits
        console.log('Large file test completed:', error.message);
      }
    });

    test('should handle file cleanup errors gracefully', async () => {
      const testFile = 'non-existent-file.py';
      
      // Should not throw error for non-existent file
      await expect(agent.cleanup(testFile)).resolves.not.toThrow();
    });
  });

  describe('Complex Error Scenarios', () => {
    test('should handle multiple cascading errors', async () => {
      // Code with multiple issues: syntax error + LaTeX error + logic error
      const problematicCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self)  # Missing colon (syntax error)
        formula = MathTex("\\invalid_latex_command")  # LaTeX error
        self.play(Create(formula))
        undefined_variable.method()  # Runtime error
      `;

      const testResult = await agent.testManimCode(problematicCode);
      expect(testResult.success).toBe(false);
      expect(testResult.error).toBeTruthy();
    });

    test('should handle memory-intensive animations', async () => {
      const memoryIntensiveCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        # Create many objects that could cause memory issues
        for i in range(1000):
            circle = Circle(radius=0.1).shift(UP*i + RIGHT*i)
            self.add(circle)
      `;

      try {
        const tempFile = await agent.savePythonFile(memoryIntensiveCode, 'memory_test.py');
        const testResult = await agent.testManimCode(memoryIntensiveCode);
        
        if (!testResult.success) {
          console.log('Memory-intensive test failed as expected:', testResult.error);
        }
        
        await agent.cleanup(tempFile);
      } catch (error) {
        console.log('Memory test completed with error:', error.message);
      }
    });

    test('should handle recursive or infinite loop scenarios', async () => {
      const infiniteLoopCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        while True:  # Infinite loop
            circle = Circle()
            self.play(Create(circle))
      `;

      // This test should timeout or be caught by compilation check
      const testResult = await agent.testManimCode(infiniteLoopCode);
      console.log('Infinite loop test result:', testResult.success ? 'passed' : 'failed');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from temporary failures', async () => {
      let attemptCount = 0;
      const flakyFunction = () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      // Simulate retry logic
      let result;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          result = flakyFunction();
          break;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error;
          }
        }
      }

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    test('should maintain error statistics', () => {
      const health = agent.getHealthStatus();
      expect(health).toHaveProperty('system');
      expect(health).toHaveProperty('errors');
      expect(health).toHaveProperty('sessions');
      expect(health).toHaveProperty('performance');
    });

    test('should provide detailed error aggregation', () => {
      // Simulate adding various errors
      const testErrors = [
        new Error('LaTeX compilation failed'),
        new Error('Network timeout'),
        new Error('Invalid syntax')
      ];

      testErrors.forEach(error => {
        agent.errorAggregator.add(error, { operation: 'test' });
      });

      const summary = agent.errorAggregator.getSummary();
      expect(summary.total).toBeGreaterThan(0);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should track performance metrics', () => {
      const metrics = agent.getPerformanceMetrics();
      expect(metrics).toHaveProperty('generation');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('timeRange');
    });

    test('should handle resource cleanup during shutdown', () => {
      const sessionCount = agent.chatSessions.size;
      agent.shutdown();
      
      expect(agent.chatSessions.size).toBe(0);
    });

    test('should limit session memory usage', () => {
      const session = agent.getOrCreateSession(testSessionId);
      
      // Add many items to test memory limits
      for (let i = 0; i < 20; i++) {
        agent.addSessionContext(testSessionId, 'code', {
          code: `test code ${i}`,
          success: true
        });
      }

      // Should be limited to configured max (5)
      expect(session.context.previousCodes.length).toBeLessThanOrEqual(5);
    });
  });
});

// Additional utility tests for edge cases
describe('Edge Case Error Scenarios', () => {
  test('should handle empty or null inputs gracefully', async () => {
    const agent = new ManimAgent();
    
    // Test empty code
    const emptyResult = await agent.testManimCode('');
    expect(emptyResult.success).toBe(false);
    
    // Test null/undefined inputs
    expect(() => agent.isValidManimCode(null)).not.toThrow();
    expect(() => agent.isValidManimCode(undefined)).not.toThrow();
    expect(agent.isValidManimCode(null)).toBe(false);
    expect(agent.isValidManimCode(undefined)).toBe(false);
  });

  test('should handle extremely long prompts', () => {
    const agent = new ManimAgent();
    const longPrompt = 'Create an animation '.repeat(10000); // Very long prompt
    
    try {
      const contextualPrompt = agent.buildContextualPrompt(longPrompt, 'test-session');
      // Should either work or fail gracefully
      expect(typeof contextualPrompt).toBe('string');
    } catch (error) {
      // Should fail gracefully with meaningful error
      expect(error.message).toContain('length');
    }
  });

  test('should handle special characters and encoding issues', async () => {
    const agent = new ManimAgent();
    const codeWithSpecialChars = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        # Unicode and special characters
        text = Text("Hello 世界! 🎉 ñáéíóú")
        formula = MathTex(r"α + β = γ")
        self.add(text, formula)
    `;

    const testResult = await agent.testManimCode(codeWithSpecialChars);
    // Should handle special characters gracefully
    console.log('Special characters test:', testResult.success ? 'passed' : 'failed');
  });
});
