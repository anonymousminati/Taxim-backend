import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MANIM_SYSTEM_PROMPT = `You are a specialized AI assistant that generates Python Manim code for mathematical and educational animations.

IMPORTANT RULES:
1. Always respond with ONLY Python Manim code - no explanations, no markdown formatting
2. Use proper Manim syntax with the latest version conventions
3. Create a class that inherits from Scene
4. Include proper imports at the top
5. The main animation method should be called 'construct'
6. Generate complete, runnable code that creates engaging visual animations
7. Focus on mathematical concepts, educational content, or visual demonstrations
8. Use appropriate Manim objects like Text, MathTex, Circle, Square, Arrow, etc.

Example structure:
from manim import *

class MyAnimation(Scene):
    def construct(self):
        # Your animation code here
        pass

Remember: Output ONLY the Python code, nothing else.`;

const MANIM_ERROR_FIX_PROMPT = `You are a specialized AI assistant that fixes Python Manim code compilation errors.

IMPORTANT RULES:
1. Analyze the provided error message and fix the specific issues
2. Return ONLY the corrected Python Manim code - no explanations, no markdown formatting
3. Maintain the original intent of the animation while fixing syntax/import/logic errors
4. Use proper Manim syntax with the latest version conventions
5. Ensure the code follows proper Python syntax and Manim best practices
6. Fix common issues like: missing imports, incorrect method names, wrong object properties, syntax errors

COMMON MANIM FIXES:
- Use proper imports: from manim import *
- Scene class must inherit from Scene
- Animation method must be 'construct(self)'
- Use correct Manim object names (Circle, Square, Text, MathTex, etc.)
- Use proper animation methods (Create, Write, Transform, FadeIn, etc.)
- Ensure proper method chaining with self.play() and self.add()

Error to fix: {error}
Original code that failed:
{code}

Provide the fixed code:`;

const MANIM_IMPROVEMENT_PROMPT = `You are a specialized AI assistant that improves Python Manim code based on feedback.

IMPORTANT RULES:
1. Improve the provided Manim code based on the feedback or error description
2. Return ONLY the improved Python Manim code - no explanations, no markdown formatting
3. Make the animation more robust, visually appealing, and error-free
4. Use proper Manim syntax with the latest version conventions
5. Add better visual elements, timing, and effects where appropriate

Original code:
{code}

Improvement request: {feedback}

Provide the improved code:`;

class ManimAgent {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash"
        });
    }    async generateManimCode(userPrompt) {
        try {
            const fullPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
            
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            const generatedCode = response.text();
            
            return this.extractPythonCode(generatedCode);
        } catch (error) {
            throw new Error(`Failed to generate Manim code: ${error.message}`);
        }
    }

    async fixManimCode(code, errorMessage, maxRetries = 3) {
        let attempts = 0;
        let currentCode = code;
        let lastError = errorMessage;

        while (attempts < maxRetries) {
            try {
                console.log(`Attempting to fix code (attempt ${attempts + 1}/${maxRetries})`);
                
                const fixPrompt = MANIM_ERROR_FIX_PROMPT
                    .replace('{error}', lastError)
                    .replace('{code}', currentCode);
                
                const result = await this.model.generateContent(fixPrompt);
                const response = await result.response;
                const fixedCode = this.extractPythonCode(response.text());
                
                // Test the fixed code
                const testResult = await this.testManimCode(fixedCode);
                
                if (testResult.success) {
                    console.log(`Code fixed successfully after ${attempts + 1} attempts`);
                    return {
                        success: true,
                        code: fixedCode,
                        attempts: attempts + 1,
                        originalError: errorMessage
                    };
                } else {
                    currentCode = fixedCode;
                    lastError = testResult.error;
                    attempts++;
                }
            } catch (error) {
                console.error(`Error in fix attempt ${attempts + 1}:`, error.message);
                attempts++;
                lastError = error.message;
            }
        }

        return {
            success: false,
            code: currentCode,
            attempts: maxRetries,
            finalError: lastError,
            originalError: errorMessage
        };
    }

    async testManimCode(code) {
        try {
            const timestamp = Date.now();
            const testFilename = `test_animation_${timestamp}.py`;
            const testFilePath = await this.savePythonFile(code, testFilename);
            
            // Test compilation without rendering (dry run)
            const command = `python -m py_compile "${testFilePath}"`;
            await execAsync(command, { timeout: 10000 });
            
            // Clean up test file
            await this.cleanup(testFilePath);
            
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async generateAndFixManimCode(userPrompt, maxAttempts = 3) {
        try {
            // First attempt: Generate initial code
            let code = await this.generateManimCode(userPrompt);
            console.log('Initial code generated, testing...');
            
            // Test the initial code
            const testResult = await this.testManimCode(code);
            
            if (testResult.success) {
                console.log('Initial code is valid');
                return {
                    success: true,
                    code: code,
                    attempts: 1,
                    wasFixed: false
                };
            }
            
            console.log('Initial code has errors, attempting to fix...');
            
            // If initial code fails, try to fix it
            const fixResult = await this.fixManimCode(code, testResult.error, maxAttempts - 1);
            
            if (fixResult.success) {
                return {
                    success: true,
                    code: fixResult.code,
                    attempts: fixResult.attempts + 1,
                    wasFixed: true,
                    originalError: fixResult.originalError
                };
            } else {
                // If fixing fails, generate completely new code
                console.log('Fixing failed, generating new code...');
                const improvedPrompt = `${userPrompt}\n\nIMPORTANT: The previous code failed with error: ${fixResult.finalError}. Generate working code that avoids this error.`;
                const newCode = await this.generateManimCode(improvedPrompt);
                
                return {
                    success: true,
                    code: newCode,
                    attempts: maxAttempts,
                    wasFixed: true,
                    originalError: fixResult.originalError,
                    usedFallback: true
                };
            }
        } catch (error) {
            throw new Error(`Failed to generate working Manim code: ${error.message}`);
        }
    }

    extractPythonCode(text) {
        // Remove any markdown code blocks if present
        const codeBlockPattern = /```python\n([\s\S]*?)\n```/g;
        const match = codeBlockPattern.exec(text);
        
        if (match) {
            return match[1].trim();
        }
        
        // If no code blocks, assume the entire response is code
        return text.trim();
    }

    async savePythonFile(code, filename = 'animation.py') {
        const tempDir = process.env.TEMP_DIR || 'temp';
        const filePath = path.join(process.cwd(), tempDir, filename);
        
        // Ensure temp directory exists
        const fullTempDir = path.dirname(filePath);
        if (!fs.existsSync(fullTempDir)) {
            fs.mkdirSync(fullTempDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, code);
        return filePath;
    }

    async renderAnimation(pythonFilePath, outputDir = null, maxRetries = 2) {
        let attempts = 0;
        let lastError = null;

        while (attempts < maxRetries) {
            try {
                const animationOutputDir = outputDir || process.env.ANIMATION_OUTPUT_DIR || 'public/animations';
                const fullOutputDir = path.join(process.cwd(), animationOutputDir);
                
                // Ensure output directory exists
                if (!fs.existsSync(fullOutputDir)) {
                    fs.mkdirSync(fullOutputDir, { recursive: true });
                }

                // Run Manim command (Manim will create its own directory structure)
                const command = `manim -pql "${pythonFilePath}"`;
                console.log(`Executing Manim command (attempt ${attempts + 1}/${maxRetries}):`, command);
                
                const { stdout, stderr } = await execAsync(command, { 
                    timeout: 120000 // 2 minute timeout
                });
                
                if (stderr && !stderr.includes('INFO') && stderr.includes('ERROR')) {
                    throw new Error(`Manim rendering error: ${stderr}`);
                }
                
                // Manim typically creates videos in media/videos/[filename]/[quality]/
                // But sometimes it puts them directly in the working directory
                // Let's search for the generated video file in multiple locations
                const possibleDirs = [
                    fullOutputDir,
                    path.join(process.cwd(), 'media', 'videos'),
                    path.join(process.cwd(), 'media'),
                    process.cwd()
                ];
                
                let foundVideo = null;
                let foundVideoPath = null;
                
                // Search for the most recently created MP4 file
                for (const dir of possibleDirs) {
                    if (fs.existsSync(dir)) {
                        const searchInDir = (searchDir) => {
                            const items = fs.readdirSync(searchDir);
                            for (const item of items) {
                                const itemPath = path.join(searchDir, item);
                                const stat = fs.statSync(itemPath);
                                
                                if (stat.isDirectory()) {
                                    // Recursively search subdirectories
                                    searchInDir(itemPath);
                                } else if (item.endsWith('.mp4')) {
                                    if (!foundVideo || stat.mtime > fs.statSync(foundVideoPath).mtime) {
                                        foundVideo = item;
                                        foundVideoPath = itemPath;
                                    }
                                }
                            }
                        };
                        
                        searchInDir(dir);
                    }
                }
                
                if (!foundVideo) {
                    // List all files in working directory for debugging
                    console.log('Available files in working directory:');
                    const files = fs.readdirSync(process.cwd());
                    files.forEach(file => {
                        const filePath = path.join(process.cwd(), file);
                        const stat = fs.statSync(filePath);
                        if (stat.isFile() && file.endsWith('.mp4')) {
                            console.log(`  Found MP4: ${file} (${stat.size} bytes, ${stat.mtime})`);
                        }
                    });
                    
                    throw new Error('No video file was generated');
                }
                  // Move the video to our desired output directory if it's not already there
                const finalVideoPath = path.join(fullOutputDir, foundVideo);
                if (foundVideoPath !== finalVideoPath) {
                    fs.copyFileSync(foundVideoPath, finalVideoPath);
                    console.log(`Moved video from ${foundVideoPath} to ${finalVideoPath}`);
                    
                    // Clean up the original file
                    try {
                        fs.unlinkSync(foundVideoPath);
                    } catch (cleanupError) {
                        console.warn('Could not clean up original video file:', cleanupError.message);
                    }
                }

                // Clean up media folder after successful rendering
                await this.cleanupMediaFolder();
                
                return {
                    success: true,
                    videoPath: `/animations/${foundVideo}`,
                    videoFileName: foundVideo,
                    stdout,
                    stderr,
                    attempts: attempts + 1
                };
            } catch (error) {
                attempts++;
                lastError = error;
                console.error(`Rendering attempt ${attempts} failed:`, error.message);
                
                if (attempts < maxRetries) {
                    console.log(`Retrying rendering in 2 seconds... (${attempts}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        throw new Error(`Failed to render animation after ${maxRetries} attempts: ${lastError.message}`);
    }

    async renderAnimationWithErrorHandling(code, maxRetries = 3) {
        try {
            // First, test if the code compiles
            const testResult = await this.testManimCode(code);
            
            if (!testResult.success) {
                console.log('Code has compilation errors, attempting to fix...');
                const fixResult = await this.fixManimCode(code, testResult.error, 2);
                
                if (!fixResult.success) {
                    throw new Error(`Code compilation failed: ${fixResult.finalError}`);
                }
                
                code = fixResult.code;
                console.log('Code fixed successfully, proceeding with rendering...');
            }
            
            // Save the (possibly fixed) code
            const timestamp = Date.now();
            const filename = `animation_${timestamp}.py`;
            const filePath = await this.savePythonFile(code, filename);
              // Attempt to render
            try {
                const renderResult = await this.renderAnimation(filePath, null, maxRetries);
                
                // Cleanup Python file and temp files
                await this.cleanup(filePath);
                await this.cleanupTempFiles();
                
                return {
                    success: true,
                    ...renderResult,
                    code: code,
                    wasCodeFixed: !testResult.success
                };
            } catch (renderError) {
                // If rendering fails, it might be a code logic issue
                console.log('Rendering failed, attempting to improve code...');
                
                const improvePrompt = `The code compiled but failed during rendering with error: ${renderError.message}. Make the animation simpler and more robust.`;
                const improvedCode = await this.improveManimCode(code, improvePrompt);
                
                // Try rendering the improved code
                const improvedFilePath = await this.savePythonFile(improvedCode, `improved_${filename}`);
                const improvedResult = await this.renderAnimation(improvedFilePath, null, 1);
                
                // Cleanup both files and temp files
                await this.cleanup(filePath);
                await this.cleanup(improvedFilePath);
                await this.cleanupTempFiles();
                
                return {
                    success: true,
                    ...improvedResult,
                    code: improvedCode,
                    wasCodeFixed: true,
                    wasImproved: true
                };
            }
        } catch (error) {
            throw new Error(`Failed to render animation with error handling: ${error.message}`);
        }
    }

    async improveManimCode(code, feedback) {
        try {
            const improvePrompt = MANIM_IMPROVEMENT_PROMPT
                .replace('{code}', code)
                .replace('{feedback}', feedback);
            
            const result = await this.model.generateContent(improvePrompt);
            const response = await result.response;
            return this.extractPythonCode(response.text());
        } catch (error) {
            console.warn('Failed to improve code, returning original:', error.message);
            return code;
        }
    }

    isValidManimCode(code) {
        // Basic validation checks
        const requiredImports = code.includes('from manim import') || code.includes('import manim');
        const hasSceneClass = code.includes('class') && code.includes('Scene');
        const hasConstructMethod = code.includes('def construct');
        
        return requiredImports && hasSceneClass && hasConstructMethod;
    }    async cleanup(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Cleaned up file:', filePath);
            }
        } catch (error) {
            console.warn('Failed to cleanup file:', error.message);
        }
    }

    async cleanupMediaFolder() {
        try {
            const mediaDir = path.join(process.cwd(), 'media');
            
            if (fs.existsSync(mediaDir)) {
                console.log('Cleaning up media folder...');
                
                // Recursively remove media directory and all its contents
                const removeDirectory = (dirPath) => {
                    if (fs.existsSync(dirPath)) {
                        const files = fs.readdirSync(dirPath);
                        
                        files.forEach(file => {
                            const filePath = path.join(dirPath, file);
                            const stat = fs.statSync(filePath);
                            
                            if (stat.isDirectory()) {
                                removeDirectory(filePath);
                            } else {
                                fs.unlinkSync(filePath);
                            }
                        });
                        
                        fs.rmdirSync(dirPath);
                    }
                };
                
                removeDirectory(mediaDir);
                console.log('Media folder cleaned up successfully');
            }
        } catch (error) {
            console.warn('Failed to cleanup media folder:', error.message);
        }
    }

    async cleanupTempFiles() {
        try {
            const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
            
            if (fs.existsSync(tempDir)) {
                console.log('Cleaning up temporary files...');
                
                const files = fs.readdirSync(tempDir);
                let cleanedCount = 0;
                
                files.forEach(file => {
                    try {
                        const filePath = path.join(tempDir, file);
                        const stat = fs.statSync(filePath);
                        
                        // Clean up files older than 1 hour
                        const oneHourAgo = Date.now() - (60 * 60 * 1000);
                        
                        if (stat.mtime.getTime() < oneHourAgo) {
                            fs.unlinkSync(filePath);
                            cleanedCount++;
                        }
                    } catch (fileError) {
                        console.warn(`Failed to clean up file ${file}:`, fileError.message);
                    }
                });
                
                if (cleanedCount > 0) {
                    console.log(`Cleaned up ${cleanedCount} temporary files`);
                }
            }
        } catch (error) {
            console.warn('Failed to cleanup temporary files:', error.message);
        }
    }

    async checkManimInstallation() {
        try {
            const { stdout } = await execAsync('manim --version');
            return {
                installed: true,
                version: stdout.trim()
            };
        } catch (error) {
            return {
                installed: false,
                error: error.message
            };
        }
    }

    async checkFFmpegInstallation() {
        try {
            const { stdout } = await execAsync('ffmpeg -version');
            const versionLine = stdout.split('\n')[0];
            return {
                installed: true,
                version: versionLine.trim()
            };
        } catch (error) {
            return {
                installed: false,
                error: error.message
            };
        }
    }

    async checkSystemRequirements() {
        const manim = await this.checkManimInstallation();
        const ffmpeg = await this.checkFFmpegInstallation();
        
        return {
            manim,
            ffmpeg,
            allRequirementsMet: manim.installed && ffmpeg.installed
        };
    }
}

export default ManimAgent;
