/**
 * Practical Error Discovery Script
 * This script tests real error scenarios to identify probable errors we need to handle
 */

import ManimAgent from '../src/services/manimAgent.js';
import { 
  isLatexError, 
  handleLatexError, 
  createLatexFallback 
} from '../src/utils/latexUtils.js';
import path from 'path';
import fs from 'fs';

class ErrorDiscoveryTester {
  constructor() {
    this.errors = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    let prefix = 'ℹ️';
    if (type === 'error') {
      prefix = '❌';
    } else if (type === 'warn') {
      prefix = '⚠️';
    }
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  recordError(testName, error, expected = false) {
    this.errors.push({
      test: testName,
      error: error.message,
      stack: error.stack,
      expected,
      timestamp: new Date().toISOString()
    });

    if (!expected) {
      this.log(`Unexpected error in ${testName}: ${error.message}`, 'error');
    } else {
      this.log(`Expected error in ${testName}: ${error.message}`, 'warn');
    }
  }

  async runTest(testName, testFunction, expectError = false) {
    this.testResults.total++;
    this.log(`Running test: ${testName}`);

    try {
      await testFunction();
      if (expectError) {
        this.log(`Test ${testName} was expected to fail but passed`, 'warn');
        this.testResults.failed++;
      } else {
        this.log(`Test ${testName} passed ✅`);
        this.testResults.passed++;
      }
    } catch (error) {
      this.recordError(testName, error, expectError);
      if (expectError) {
        this.testResults.passed++;
      } else {
        this.testResults.failed++;
      }
    }
  }

  // Test 1: LaTeX Error Detection
  async testLatexErrorDetection() {
    const latexErrors = [
      'LaTeX Error: Missing $ inserted',
      'pdflatex failed with error',
      'RuntimeError: latex not found in PATH',
      'tex error: undefined control sequence'
    ];

    const nonLatexErrors = [
      'SyntaxError: invalid syntax',
      'ImportError: No module named manim',
      'TypeError: object is not callable'
    ];

    // Test LaTeX error detection
    for (const error of latexErrors) {
      if (!isLatexError(error)) {
        throw new Error(`Failed to detect LaTeX error: ${error}`);
      }
    }

    // Test non-LaTeX error detection
    for (const error of nonLatexErrors) {
      if (isLatexError(error)) {
        throw new Error(`Incorrectly detected non-LaTeX error as LaTeX: ${error}`);
      }
    }
  }

  // Test 2: Invalid Python Syntax
  async testInvalidPythonSyntax() {
    const agent = new ManimAgent();
    const invalidCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self)  # Missing colon
        circle = Circle()
        self.play(Create(circle)  # Missing closing parenthesis
    `;

    const result = await agent.testManimCode(invalidCode);
    if (result.success) {
      throw new Error('Invalid Python syntax was not detected');
    }
  }

  // Test 3: Missing Manim Imports
  async testMissingImports() {
    const agent = new ManimAgent();
    const codeWithoutImports = `
class TestAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
    `;

    const result = await agent.testManimCode(codeWithoutImports);
    if (result.success) {
      throw new Error('Missing imports were not detected');
    }
  }

  // Test 4: LaTeX Syntax Issues
  async testLatexSyntaxIssues() {
    const agent = new ManimAgent();
    const problematicLatexCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        # Problematic LaTeX - missing raw string
        formula = MathTex("\\frac{x^2}{y}")
        self.play(Write(formula))
    `;

    const errorMessage = 'LaTeX Error: Missing $ inserted';
    const fixedCode = handleLatexError(problematicLatexCode, errorMessage);
    
    if (!fixedCode || !fixedCode.includes('MathTex(r"')) {
      throw new Error('LaTeX error handling failed');
    }
  }
  // Test 5: System Requirements Check
  async testSystemRequirements() {
    const agent = new ManimAgent();
    const requirements = await agent.checkSystemRequirements();
    
    if (!requirements.hasOwnProperty('manim') || 
        !requirements.hasOwnProperty('ffmpeg')) {
      throw new Error('System requirements check incomplete');
    }

    this.log(`System check results: Manim: ${requirements.manim?.installed}, FFmpeg: ${requirements.ffmpeg?.installed}`);
  }

  // Test 6: File System Operations
  async testFileSystemOperations() {
    const agent = new ManimAgent();
    const testCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
    `;

    // Test saving file
    const filePath = await agent.savePythonFile(testCode, 'error_test.py');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Failed to save Python file');
    }

    // Test cleanup
    await agent.cleanup(filePath);
    
    if (fs.existsSync(filePath)) {
      throw new Error('Failed to cleanup Python file');
    }
  }

  // Test 7: Session Management
  async testSessionManagement() {
    const agent = new ManimAgent();
    const sessionId = 'test-session-123';

    // Create session
    const session = agent.getOrCreateSession(sessionId);
    if (!session) {
      throw new Error('Failed to create session');
    }

    // Add context
    agent.addSessionContext(sessionId, 'code', {
      code: 'test code',
      success: true
    });

    // Get session info
    const info = agent.getSessionInfo(sessionId);
    if (!info.exists) {
      throw new Error('Session info not found');
    }

    // Clear session
    const cleared = agent.clearSession(sessionId);
    if (!cleared) {
      throw new Error('Failed to clear session');
    }
  }

  // Test 8: Large Code Generation
  async testLargeCodeGeneration() {
    const agent = new ManimAgent();
    
    // Test very long prompt
    const longPrompt = 'Create a complex animation with ' + 'many objects '.repeat(100);
    
    try {
      const contextualPrompt = agent.buildContextualPrompt(longPrompt, 'test-session');
      if (contextualPrompt.length > 50000) { // Arbitrarily large threshold
        this.log(`Generated very long prompt: ${contextualPrompt.length} characters`, 'warn');
      }
    } catch (error) {
      // Expected if prompt is too long
      if (!error.message.includes('length')) {
        throw error;
      }
    }
  }

  // Test 9: Special Characters and Encoding
  async testSpecialCharacters() {
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

    const result = await agent.testManimCode(codeWithSpecialChars);
    this.log(`Special characters test result: ${result.success ? 'passed' : 'failed'}`);
  }

  // Test 10: Memory and Resource Limits
  async testResourceLimits() {
    const agent = new ManimAgent();
    
    // Test creating many sessions
    const sessions = [];
    for (let i = 0; i < 100; i++) {
      sessions.push(agent.getOrCreateSession(`session-${i}`));
    }

    // Check if session limit is enforced
    const activeSessions = agent.getActiveSessions();
    this.log(`Created ${sessions.length} sessions, active: ${activeSessions.length}`);

    // Cleanup
    activeSessions.forEach(id => agent.clearSession(id));
  }

  // Test 11: LaTeX Fallback System
  async testLatexFallback() {
    const complexLatexCode = `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\int_{-\\infty}^{\\infty} e^{-x^2} dx")
        plane = NumberPlane()
        axes = Axes()
        self.add(formula, plane, axes)
    `;

    const fallbackCode = createLatexFallback(complexLatexCode);
    
    if (fallbackCode.includes('MathTex') || 
        fallbackCode.includes('NumberPlane') || 
        fallbackCode.includes('Axes')) {
      throw new Error('LaTeX fallback did not replace problematic elements');
    }

    if (!fallbackCode.includes('Text(') || !fallbackCode.includes('Rectangle(')) {
      throw new Error('LaTeX fallback did not create proper replacements');
    }
  }

  // Test 12: Error Aggregation and Monitoring
  async testErrorMonitoring() {
    const agent = new ManimAgent();
    
    // Simulate some errors
    const testErrors = [
      new Error('Test error 1'),
      new Error('Test error 2'),
      new Error('Test error 3')
    ];

    testErrors.forEach(error => {
      agent.errorAggregator.add(error, { operation: 'test' });
    });

    const summary = agent.errorAggregator.getSummary();
    if (summary.total === 0) {
      throw new Error('Error aggregation not working');
    }

    // Test health status
    const health = agent.getHealthStatus();
    if (!health.system || !health.errors || !health.sessions) {
      throw new Error('Health status incomplete');
    }

    // Test performance metrics
    const metrics = agent.getPerformanceMetrics();
    if (!metrics.generation || !metrics.system) {
      throw new Error('Performance metrics incomplete');
    }
  }

  // Main test runner
  async runAllTests() {
    this.log('🚀 Starting Error Discovery Tests');
    this.log('=====================================');

    await this.runTest('LaTeX Error Detection', () => this.testLatexErrorDetection());
    await this.runTest('Invalid Python Syntax', () => this.testInvalidPythonSyntax(), true);
    await this.runTest('Missing Imports', () => this.testMissingImports(), true);
    await this.runTest('LaTeX Syntax Issues', () => this.testLatexSyntaxIssues());
    await this.runTest('System Requirements', () => this.testSystemRequirements());
    await this.runTest('File System Operations', () => this.testFileSystemOperations());
    await this.runTest('Session Management', () => this.testSessionManagement());
    await this.runTest('Large Code Generation', () => this.testLargeCodeGeneration());
    await this.runTest('Special Characters', () => this.testSpecialCharacters());
    await this.runTest('Resource Limits', () => this.testResourceLimits());
    await this.runTest('LaTeX Fallback', () => this.testLatexFallback());
    await this.runTest('Error Monitoring', () => this.testErrorMonitoring());

    this.printSummary();
    return this.generateErrorReport();
  }

  printSummary() {
    this.log('=====================================');
    this.log('🏁 Test Summary');
    this.log(`Total Tests: ${this.testResults.total}`);
    this.log(`Passed: ${this.testResults.passed} ✅`);
    this.log(`Failed: ${this.testResults.failed} ❌`);
    this.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
  }

  generateErrorReport() {
    const report = {
      summary: {
        totalTests: this.testResults.total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: ((this.testResults.passed / this.testResults.total) * 100).toFixed(1)
      },
      errors: this.errors,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    };

    // Save report to file
    const reportPath = path.join(process.cwd(), 'error-discovery-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`📊 Error report saved to: ${reportPath}`);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Analyze errors and generate recommendations
    const errorTypes = {};
    this.errors.forEach(error => {
      const type = this.categorizeError(error.error);
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      recommendations.push({
        type,
        count,
        suggestion: this.getRecommendationForErrorType(type)
      });
    });

    return recommendations;
  }

  categorizeError(errorMessage) {
    if (errorMessage.includes('LaTeX') || errorMessage.includes('latex')) {
      return 'LaTeX';
    } else if (errorMessage.includes('SyntaxError') || errorMessage.includes('syntax')) {
      return 'Python Syntax';
    } else if (errorMessage.includes('Import') || errorMessage.includes('module')) {
      return 'Import Error';
    } else if (errorMessage.includes('File') || errorMessage.includes('path')) {
      return 'File System';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('time')) {
      return 'Timeout';
    } else if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
      return 'Memory';
    } else {
      return 'Other';
    }
  }

  getRecommendationForErrorType(type) {
    const recommendations = {
      'LaTeX': 'Improve LaTeX error handling and fallback mechanisms',
      'Python Syntax': 'Add more comprehensive Python syntax validation',
      'Import Error': 'Enhance dependency checking and import validation',
      'File System': 'Strengthen file system error handling and permissions',
      'Timeout': 'Implement better timeout handling and async operations',
      'Memory': 'Add memory usage monitoring and limits',
      'Other': 'Add general error handling improvements'
    };

    return recommendations[type] || 'Review and improve error handling';
  }
}

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ErrorDiscoveryTester();
  
  tester.runAllTests()
    .then(report => {
      console.log('\n🎉 Error discovery testing completed!');
      console.log(`Check error-discovery-report.json for detailed results`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error discovery testing failed:', error);
      process.exit(1);
    });
}

export default ErrorDiscoveryTester;
