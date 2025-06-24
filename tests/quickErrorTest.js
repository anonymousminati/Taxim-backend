/**
 * Quick Error Testing Script
 * Run this to identify real errors we need to handle
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function testBasicErrors() {
  console.log('🔍 Testing for probable errors...\n');

  // Test 1: Check if backend is running
  console.log('1. Testing backend connectivity...');
  try {
    const { stdout } = await execAsync('curl -s http://localhost:3001/health');
    console.log('✅ Backend is running');
    console.log('Response:', stdout);
  } catch (error) {
    console.log('❌ Backend connection failed:', error.message);
    console.log('💡 Make sure to run: npm run dev in backend directory');
  }

  // Test 2: Check system requirements
  console.log('\n2. Testing system requirements...');
  
  // Check Python
  try {
    const { stdout } = await execAsync('python --version');
    console.log('✅ Python found:', stdout.trim());
  } catch (error) {
    console.log('❌ Python not found:', error.message);
  }

  // Check Manim
  try {
    const { stdout } = await execAsync('manim --version');
    console.log('✅ Manim found:', stdout.trim());
  } catch (error) {
    console.log('❌ Manim not found:', error.message);
  }

  // Check FFmpeg
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    console.log('✅ FFmpeg found:', stdout.split('\n')[0]);
  } catch (error) {
    console.log('❌ FFmpeg not found:', error.message);
  }

  // Check LaTeX
  try {
    const { stdout } = await execAsync('pdflatex --version');
    console.log('✅ LaTeX found:', stdout.split('\n')[0]);
  } catch (error) {
    console.log('❌ LaTeX not found:', error.message);
  }

  // Test 3: Test problematic Manim code
  console.log('\n3. Testing problematic Manim code...');
  
  const problematicCodes = [
    {
      name: 'Syntax Error',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self)  # Missing colon
        circle = Circle()
        self.play(Create(circle))
      `
    },
    {
      name: 'LaTeX Error',
      code: `
from manim import *

class TestAnimation(Scene):
    def construct(self):
        formula = MathTex("\\frac{x^2}{y}")  # Missing raw string
        self.play(Write(formula))
      `
    },
    {
      name: 'Import Error',
      code: `
class TestAnimation(Scene):  # Missing import
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
      `
    },
    {
      name: 'Invalid Class',
      code: `
from manim import *

class TestAnimation:  # Should inherit from Scene
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
      `
    }
  ];

  for (const test of problematicCodes) {
    console.log(`\n   Testing: ${test.name}`);
    
    // Save test file
    const tempFile = `temp_test_${Date.now()}.py`;
    fs.writeFileSync(tempFile, test.code);
    
    try {
      // Test Python compilation
      await execAsync(`python -m py_compile ${tempFile}`);
      console.log(`   ✅ ${test.name}: Python compilation passed (unexpected)`);
    } catch (error) {
      console.log(`   ❌ ${test.name}: Python compilation failed (expected)`);
      console.log(`   Error: ${error.message.split('\n')[0]}`);
    }
    
    // Cleanup
    try {
      fs.unlinkSync(tempFile);
    } catch (cleanupError) {
      console.log(`   ⚠️  Failed to cleanup ${tempFile}`);
    }
  }

  // Test 4: Test API endpoints if backend is running
  console.log('\n4. Testing API endpoints...');
  
  try {
    // Test status endpoint
    const { stdout: statusOutput } = await execAsync('curl -s "http://localhost:3001/api/manim/status"');
    const status = JSON.parse(statusOutput);
    console.log('✅ Status endpoint working');
    console.log('   Requirements met:', status.requirements?.allRequirementsMet);
    
    // Test invalid request
    try {
      await execAsync('curl -s -X POST "http://localhost:3001/api/manim/generate" -H "Content-Type: application/json" -d "{}"');
      console.log('⚠️  Empty request should have failed but didn\'t');
    } catch (error) {
      console.log('✅ Empty request properly rejected');
    }
    
  } catch (error) {
    console.log('❌ API endpoint testing failed:', error.message);
  }

  // Test 5: File system operations
  console.log('\n5. Testing file system operations...');
  
  const testDir = 'test_temp_dir';
  try {
    // Test directory creation
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
      console.log('✅ Directory creation successful');
    }
    
    // Test file operations
    const testFile = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');
    console.log('✅ File creation successful');
    
    const content = fs.readFileSync(testFile, 'utf8');
    if (content === 'test content') {
      console.log('✅ File read/write successful');
    }
    
    // Cleanup
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);
    console.log('✅ File cleanup successful');
    
  } catch (error) {
    console.log('❌ File system operations failed:', error.message);
  }

  // Test 6: Environment variables
  console.log('\n6. Testing environment configuration...');
  
  if (process.env.GEMINI_API_KEY) {
    console.log('✅ GEMINI_API_KEY is set');
  } else {
    console.log('❌ GEMINI_API_KEY is not set');
    console.log('💡 Set GEMINI_API_KEY in .env file');
  }
  
  if (process.env.NODE_ENV) {
    console.log(`✅ NODE_ENV is set to: ${process.env.NODE_ENV}`);
  } else {
    console.log('⚠️  NODE_ENV is not set (will default to development)');
  }

  console.log('\n🏁 Error testing completed!');
  console.log('\n📋 Summary of common errors to handle:');
  console.log('   1. Missing system dependencies (Python, Manim, FFmpeg, LaTeX)');
  console.log('   2. Python syntax errors in generated code');
  console.log('   3. LaTeX compilation errors');
  console.log('   4. Missing imports in Manim code');
  console.log('   5. Invalid class inheritance');
  console.log('   6. File system permission errors');
  console.log('   7. API connection failures');
  console.log('   8. Missing environment variables');
  console.log('   9. Network timeouts');
  console.log('   10. Resource exhaustion (memory, disk space)');
}

// Run tests
testBasicErrors().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
