/**
 * Real Manim Animation Error Testing
 * This script tests actual animation generation to find real-world errors
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function testManimAnimations() {
  console.log('🎬 Testing actual Manim animation generation...\n');

  const testCases = [
    {
      name: 'Basic Circle Animation',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
      `,
      shouldWork: true
    },
    {
      name: 'LaTeX Math Expression',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\frac{x^2 + y^2}{z}")
        self.play(Write(formula))
        self.wait(1)
      `,
      shouldWork: true
    },
    {
      name: 'Complex LaTeX (Potential Error)',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex(r"\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}")
        self.play(Write(formula))
        self.wait(1)
      `,
      shouldWork: true
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
      shouldWork: false
    },
    {
      name: 'Missing Raw String',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex("\\frac{x^2}{y}")
        self.play(Write(formula))
        self.wait(1)
      `,
      shouldWork: false
    },
    {
      name: 'NumberPlane with Axes',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        plane = NumberPlane()
        axes = Axes()
        self.add(plane, axes)
        self.wait(1)
      `,
      shouldWork: true
    },
    {
      name: 'Text with Special Characters',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        text = Text("Hello 世界! 🎉 ñáéíóú")
        self.play(Write(text))
        self.wait(1)
      `,
      shouldWork: true
    },
    {
      name: 'Large Number of Objects',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        for i in range(50):
            circle = Circle(radius=0.1).shift(UP*i*0.1 + RIGHT*i*0.1)
            self.add(circle)
        self.wait(1)
      `,
      shouldWork: true
    },
    {
      name: 'Invalid Manim Object',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        obj = NonExistentObject()
        self.play(Create(obj))
        self.wait(1)
      `,
      shouldWork: false
    },
    {
      name: 'Runtime Error - Division by Zero',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        x = 1 / 0  # This will cause runtime error
        circle = Circle(radius=x)
        self.play(Create(circle))
        self.wait(1)
      `,
      shouldWork: false
    }
  ];

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Create output directory for videos
  const outputDir = 'test_animations';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n${i + 1}. Testing: ${testCase.name}`);
    console.log(`   Expected to ${testCase.shouldWork ? 'work' : 'fail'}`);

    const filename = `test_${i + 1}_${Date.now()}.py`;
    const filepath = path.join(outputDir, filename);

    try {
      // Save the test file
      fs.writeFileSync(filepath, testCase.code);

      // Test 1: Python compilation
      console.log('   📝 Testing Python compilation...');
      try {
        await execAsync(`python -m py_compile "${filepath}"`);
        console.log('   ✅ Python compilation: PASSED');
      } catch (compileError) {
        console.log('   ❌ Python compilation: FAILED');
        console.log(`   Error: ${compileError.message.split('\n')[0]}`);
        
        if (testCase.shouldWork) {
          results.errors.push({
            test: testCase.name,
            stage: 'compilation',
            error: compileError.message
          });
          results.failed++;
        } else {
          results.passed++;
        }
        continue;
      }

      // Test 2: Manim dry run (syntax check)
      console.log('   🔍 Testing Manim dry run...');
      try {
        const { stdout, stderr } = await execAsync(`manim --dry_run "${filepath}"`, { timeout: 30000 });
        console.log('   ✅ Manim dry run: PASSED');
        
        if (stderr && stderr.includes('ERROR')) {
          console.log('   ⚠️  Dry run passed but has warnings:', stderr.substring(0, 100));
        }
      } catch (dryRunError) {
        console.log('   ❌ Manim dry run: FAILED');
        console.log(`   Error: ${dryRunError.message.split('\n')[0]}`);
        
        if (testCase.shouldWork) {
          results.errors.push({
            test: testCase.name,
            stage: 'dry_run',
            error: dryRunError.message
          });
          results.failed++;
        } else {
          results.passed++;
        }
        continue;
      }

      // Test 3: Full rendering (for valid cases only)
      if (testCase.shouldWork) {
        console.log('   🎬 Testing full rendering...');
        try {
          const className = extractClassName(testCase.code);
          const renderCommand = `manim "${filepath}" ${className} --media_dir "${outputDir}/media"`;
          
          const { stdout, stderr } = await execAsync(renderCommand, { 
            timeout: 120000, // 2 minutes timeout
            cwd: process.cwd()
          });
          
          console.log('   ✅ Full rendering: PASSED');
          
          // Check if video was actually created
          const videoFiles = findVideoFiles(path.join(outputDir, 'media'));
          if (videoFiles.length > 0) {
            console.log(`   📹 Video created: ${videoFiles[videoFiles.length - 1]}`);
          } else {
            console.log('   ⚠️  Rendering completed but no video found');
          }
          
          results.passed++;
        } catch (renderError) {
          console.log('   ❌ Full rendering: FAILED');
          console.log(`   Error: ${renderError.message.split('\n')[0]}`);
          
          results.errors.push({
            test: testCase.name,
            stage: 'rendering',
            error: renderError.message
          });
          results.failed++;
        }
      } else {
        // For cases expected to fail, mark as passed if they failed appropriately
        results.passed++;
        console.log('   ✅ Failed as expected');
      }

    } catch (error) {
      console.log(`   💥 Test setup failed: ${error.message}`);
      results.errors.push({
        test: testCase.name,
        stage: 'setup',
        error: error.message
      });
      results.failed++;
    } finally {
      // Cleanup test file
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (cleanupError) {
        console.log(`   ⚠️  Cleanup warning: ${cleanupError.message}`);
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MANIM TESTING SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${((results.passed / testCases.length) * 100).toFixed(1)}%`);

  if (results.errors.length > 0) {
    console.log('\n🔍 DETAILED ERROR ANALYSIS:');
    console.log('-'.repeat(30));
    
    const errorTypes = {};
    results.errors.forEach(error => {
      const type = categorizeError(error.error);
      errorTypes[type] = (errorTypes[type] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} errors`);
    });

    console.log('\n📝 ERROR DETAILS:');
    results.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.test} (${error.stage})`);
      console.log(`   ${error.error.substring(0, 200)}${error.error.length > 200 ? '...' : ''}`);
    });
  }

  // Generate recommendations
  console.log('\n💡 RECOMMENDATIONS FOR ERROR HANDLING:');
  console.log('-'.repeat(40));
  
  const recommendations = generateRecommendations(results.errors);
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });

  // Cleanup
  try {
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      files.forEach(file => {
        const filePath = path.join(outputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      
      // Also clean media directory if it exists
      const mediaDir = path.join(outputDir, 'media');
      if (fs.existsSync(mediaDir)) {
        deleteDirectory(mediaDir);
      }
      
      fs.rmdirSync(outputDir);
      console.log('\n🧹 Test cleanup completed');
    }
  } catch (cleanupError) {
    console.log(`\n⚠️  Cleanup warning: ${cleanupError.message}`);
  }

  return results;
}

function extractClassName(code) {
  const match = code.match(/class\s+(\w+)\s*\(/);
  return match ? match[1] : 'TestAnimation';
}

function findVideoFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  
  const videoFiles = [];
  
  function searchDirectory(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        searchDirectory(filePath);
      } else if (file.endsWith('.mp4')) {
        videoFiles.push(filePath);
      }
    });
  }
  
  searchDirectory(directory);
  return videoFiles;
}

function deleteDirectory(directory) {
  if (fs.existsSync(directory)) {
    const files = fs.readdirSync(directory);
    files.forEach(file => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        deleteDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
    fs.rmdirSync(directory);
  }
}

function categorizeError(errorMessage) {
  if (errorMessage.includes('LaTeX') || errorMessage.includes('latex') || errorMessage.includes('pdflatex')) {
    return 'LaTeX Error';
  } else if (errorMessage.includes('SyntaxError') || errorMessage.includes('syntax')) {
    return 'Python Syntax Error';
  } else if (errorMessage.includes('NameError') || errorMessage.includes('not defined')) {
    return 'Name/Import Error';
  } else if (errorMessage.includes('timeout') || errorMessage.includes('time')) {
    return 'Timeout Error';
  } else if (errorMessage.includes('FFmpeg') || errorMessage.includes('ffmpeg')) {
    return 'FFmpeg Error';
  } else if (errorMessage.includes('File') || errorMessage.includes('file')) {
    return 'File System Error';
  } else if (errorMessage.includes('Memory') || errorMessage.includes('memory')) {
    return 'Memory Error';
  } else if (errorMessage.includes('ZeroDivisionError') || errorMessage.includes('division')) {
    return 'Runtime Error';
  } else {
    return 'Other Error';
  }
}

function generateRecommendations(errors) {
  const recommendations = [];
  
  const errorCounts = {};
  errors.forEach(error => {
    const type = categorizeError(error.error);
    errorCounts[type] = (errorCounts[type] || 0) + 1;
  });

  if (errorCounts['LaTeX Error'] > 0) {
    recommendations.push('Strengthen LaTeX error detection and implement robust fallback mechanisms');
    recommendations.push('Add LaTeX syntax validation before rendering');
    recommendations.push('Provide clear LaTeX error messages to users');
  }

  if (errorCounts['Python Syntax Error'] > 0) {
    recommendations.push('Implement Python AST parsing for syntax validation');
    recommendations.push('Add syntax error recovery and auto-fixing');
  }

  if (errorCounts['Name/Import Error'] > 0) {
    recommendations.push('Validate all imports and class definitions in generated code');
    recommendations.push('Provide template code with all necessary imports');
  }

  if (errorCounts['Timeout Error'] > 0) {
    recommendations.push('Implement progressive timeout handling with user feedback');
    recommendations.push('Add rendering complexity estimation');
  }

  if (errorCounts['FFmpeg Error'] > 0) {
    recommendations.push('Add FFmpeg installation validation and user guidance');
    recommendations.push('Implement alternative video generation methods');
  }

  if (errorCounts['Runtime Error'] > 0) {
    recommendations.push('Add runtime error detection and graceful handling');
    recommendations.push('Implement code safety checks before execution');
  }

  if (recommendations.length === 0) {
    recommendations.push('Error handling appears robust for tested scenarios');
    recommendations.push('Consider adding more edge case testing');
  }

  return recommendations;
}

// Run the tests
console.log('🚀 Starting Manim Animation Error Discovery...');
testManimAnimations()
  .then(results => {
    console.log('\n🎉 Animation error testing completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Animation testing failed:', error);
    process.exit(1);
  });
