/**
 * Test Enhanced Error Handling
 * Validates the improved LaTeX error handling system
 */

import { categorizeError, applyProgressiveErrorHandling, generateErrorExplanation } from '../src/utils/enhancedErrorHandling.js';

async function testEnhancedErrorHandling() {
  console.log('🧪 Testing Enhanced Error Handling System\n');

  // Test 1: LaTeX Error Categorization
  console.log('1. Testing LaTeX error categorization...');
  const latexError = "LaTeX Error: Undefined control sequence \\invalidcommand";
  const errorInfo = categorizeError(latexError);
  
  console.log('Error Info:', {
    type: errorInfo.type,
    category: errorInfo.category,
    severity: errorInfo.severity,
    recoverable: errorInfo.recoverable
  });
  
  if (errorInfo.category === 'LaTeX') {
    console.log('✅ LaTeX error correctly categorized');
  } else {
    console.log('❌ LaTeX error categorization failed');
  }

  // Test 2: Progressive Error Handling
  console.log('\n2. Testing progressive error handling...');
  const sampleCode = `
from manim import *

class TestScene(Scene):
    def construct(self):
        equation = MathTex(r"\\invalidcommand{x^2 + y^2 = z^2}")
        self.play(Write(equation))
`;

  const levels = [1, 2, 3];
  for (const level of levels) {
    console.log(`\n  Level ${level} Fix:`);
    const fix = applyProgressiveErrorHandling(sampleCode, errorInfo, level);
    console.log(`  Applied fixes: ${fix.appliedFixes.length > 0 ? fix.appliedFixes.join(', ') : 'Standard fixes'}`);
    
    // Check if LaTeX was replaced in level 3
    if (level === 3 && !fix.code.includes('MathTex')) {
      console.log('  ✅ Level 3 fallback successfully replaced LaTeX');
    }
  }

  // Test 3: Error Explanation Generation
  console.log('\n3. Testing error explanation generation...');
  const explanation = generateErrorExplanation(errorInfo, 2);
  console.log('Generated explanation:');
  console.log(explanation);
  
  if (explanation.includes('LaTeX') && explanation.includes('Attempt 2')) {
    console.log('✅ Error explanation correctly generated');
  } else {
    console.log('❌ Error explanation generation failed');
  }

  // Test 4: Non-LaTeX Error Handling
  console.log('\n4. Testing non-LaTeX error categorization...');
  const pythonError = "SyntaxError: invalid syntax at line 5";
  const pythonErrorInfo = categorizeError(pythonError);
  
  if (pythonErrorInfo.category === 'Python') {
    console.log('✅ Python error correctly categorized');
  } else {
    console.log('❌ Python error categorization failed');
  }

  console.log('\n✨ Enhanced Error Handling Test Complete!\n');
}

// Run the test
testEnhancedErrorHandling().catch(console.error);
