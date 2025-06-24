/**
 * Detailed LaTeX Error Analysis
 * This script identifies specific LaTeX errors we need to handle
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function testLatexErrors() {
  console.log('🔍 Detailed LaTeX Error Analysis...\n');

  const latexTests = [
    {
      name: 'Simple Math with Raw String',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"x^2 + y^2")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'success'
    },
    {
      name: 'Math without Raw String',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex("x^2 + y^2")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'warning_or_success'
    },
    {
      name: 'Complex Fraction with Raw String',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\frac{x^2 + y^2}{z}")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'success'
    },
    {
      name: 'Complex Fraction without Raw String',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex("\\frac{x^2 + y^2}{z}")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'error'
    },
    {
      name: 'Integration Formula',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'success'
    },
    {
      name: 'Invalid LaTeX Command',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\invalidcommand{x}")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'error'
    },
    {
      name: 'Matrix',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        matrix = MathTex(r"\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}")
        self.play(Write(matrix))
        self.wait(1)
      `,
      expected: 'success'
    },
    {
      name: 'Greek Letters',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\alpha + \\beta = \\gamma")
        self.play(Write(formula))
        self.wait(1)
      `,
      expected: 'success'
    }
  ];

  const results = [];

  for (let i = 0; i < latexTests.length; i++) {
    const test = latexTests[i];
    console.log(`\n${i + 1}. Testing: ${test.name}`);
    console.log(`   Expected: ${test.expected}`);

    const filename = `latex_test_${i + 1}.py`;
    
    try {
      // Save test file
      fs.writeFileSync(filename, test.code);

      // Test with detailed error output
      try {
        const { stdout, stderr } = await execAsync(`manim --dry_run "${filename}"`, { 
          timeout: 30000 
        });
        
        console.log('   ✅ Dry run: PASSED');
        if (stderr && stderr.includes('WARNING')) {
          console.log('   ⚠️  Has warnings:', stderr.substring(0, 150) + '...');
        }
        
        results.push({
          test: test.name,
          result: 'success',
          output: stdout || 'No output',
          warnings: stderr || 'No warnings'
        });
        
      } catch (error) {
        console.log('   ❌ Dry run: FAILED');
        console.log('   📝 Full error output:');
        
        // Get detailed error information
        const errorOutput = error.message || error.stderr || error.stdout || 'No error details';
        console.log('   ' + errorOutput.split('\n').slice(0, 10).join('\n   '));
        
        results.push({
          test: test.name,
          result: 'error',
          error: errorOutput,
          errorType: categorizeLatexError(errorOutput)
        });
        
        if (test.expected === 'error') {
          console.log('   ✅ Failed as expected');
        } else {
          console.log('   💥 Unexpected failure!');
        }
      }

    } catch (setupError) {
      console.log(`   💥 Setup error: ${setupError.message}`);
      results.push({
        test: test.name,
        result: 'setup_error',
        error: setupError.message
      });
    } finally {
      // Cleanup
      try {
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      } catch (cleanupError) {
        console.log(`   ⚠️  Cleanup error: ${cleanupError.message}`);
      }
    }
  }

  // Analysis
  console.log('\n' + '='.repeat(60));
  console.log('📊 LATEX ERROR ANALYSIS RESULTS');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.result === 'success').length;
  const errorCount = results.filter(r => r.result === 'error').length;
  const setupErrorCount = results.filter(r => r.result === 'setup_error').length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`Successful: ${successCount} ✅`);
  console.log(`Failed: ${errorCount} ❌`);
  console.log(`Setup Errors: ${setupErrorCount} 💥`);

  // Error categorization
  const errorTypes = {};
  results.filter(r => r.result === 'error').forEach(result => {
    const type = result.errorType || 'Unknown';
    errorTypes[type] = (errorTypes[type] || 0) + 1;
  });

  if (Object.keys(errorTypes).length > 0) {
    console.log('\n🔍 ERROR CATEGORIES:');
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} errors`);
    });
  }

  // Specific error patterns
  const errorPatterns = [];
  results.filter(r => r.result === 'error').forEach(result => {
    if (result.error.includes('LaTeX')) {
      errorPatterns.push('LaTeX compilation error');
    }
    if (result.error.includes('pdflatex')) {
      errorPatterns.push('pdflatex execution error');
    }
    if (result.error.includes('undefined control sequence')) {
      errorPatterns.push('Undefined LaTeX command');
    }
    if (result.error.includes('Missing $')) {
      errorPatterns.push('Missing math mode delimiters');
    }
    if (result.error.includes('Runaway argument')) {
      errorPatterns.push('Malformed LaTeX syntax');
    }
  });

  if (errorPatterns.length > 0) {
    console.log('\n🎯 SPECIFIC ERROR PATTERNS FOUND:');
    const uniquePatterns = [...new Set(errorPatterns)];
    uniquePatterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern}`);
    });
  }

  // Generate targeted recommendations
  console.log('\n💡 TARGETED RECOMMENDATIONS:');
  console.log('-'.repeat(40));

  const recommendations = [];

  if (errorTypes['LaTeX Error']) {
    recommendations.push('Implement automatic raw string conversion for MathTex');
    recommendations.push('Add LaTeX syntax validation before rendering');
    recommendations.push('Create fallback system for LaTeX compilation errors');
  }

  if (errorTypes['pdflatex Error']) {
    recommendations.push('Add pdflatex installation detection');
    recommendations.push('Provide clear error messages for LaTeX dependency issues');
  }

  if (errorTypes['Syntax Error']) {
    recommendations.push('Add LaTeX command validation');
    recommendations.push('Implement LaTeX syntax fixing');
  }

  if (recommendations.length === 0) {
    recommendations.push('LaTeX handling appears stable for basic cases');
    recommendations.push('Focus on edge case handling and user feedback');
  }

  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });

  // Save detailed report
  const reportPath = 'latex-error-analysis.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      successful: successCount,
      failed: errorCount,
      setupErrors: setupErrorCount
    },
    errorTypes,
    errorPatterns: [...new Set(errorPatterns)],
    recommendations,
    detailedResults: results
  }, null, 2));

  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  return results;
}

function categorizeLatexError(errorMessage) {
  if (errorMessage.includes('pdflatex') && errorMessage.includes('failed')) {
    return 'pdflatex Error';
  } else if (errorMessage.includes('LaTeX Error')) {
    return 'LaTeX Error';
  } else if (errorMessage.includes('undefined control sequence')) {
    return 'LaTeX Command Error';
  } else if (errorMessage.includes('Missing $')) {
    return 'Math Mode Error';
  } else if (errorMessage.includes('Runaway argument')) {
    return 'Syntax Error';
  } else if (errorMessage.includes('Emergency stop')) {
    return 'Critical LaTeX Error';
  } else {
    return 'Unknown Error';
  }
}

// Run the analysis
console.log('🚀 Starting Detailed LaTeX Error Analysis...');
testLatexErrors()
  .then(results => {
    console.log('\n🎉 LaTeX error analysis completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 LaTeX analysis failed:', error);
    process.exit(1);
  });
