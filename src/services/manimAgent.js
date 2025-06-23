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

class ManimAgent {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash"
        });
    }

    async generateManimCode(userPrompt) {
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
    }    async renderAnimation(pythonFilePath, outputDir = null) {
        try {
            const animationOutputDir = outputDir || process.env.ANIMATION_OUTPUT_DIR || 'public/animations';
            const fullOutputDir = path.join(process.cwd(), animationOutputDir);
            
            // Ensure output directory exists
            if (!fs.existsSync(fullOutputDir)) {
                fs.mkdirSync(fullOutputDir, { recursive: true });
            }

            // Run Manim command (Manim will create its own directory structure)
            const command = `manim -pql "${pythonFilePath}"`;
            console.log('Executing Manim command:', command);
            
            const { stdout, stderr } = await execAsync(command, { 
                timeout: 120000 // 2 minute timeout
            });
            
            if (stderr && !stderr.includes('INFO')) {
                console.warn('Manim stderr:', stderr);
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
            
            return {
                success: true,
                videoPath: `/animations/${foundVideo}`,
                videoFileName: foundVideo,
                stdout,
                stderr
            };
        } catch (error) {
            throw new Error(`Failed to render animation: ${error.message}`);
        }
    }

    isValidManimCode(code) {
        // Basic validation checks
        const requiredImports = code.includes('from manim import') || code.includes('import manim');
        const hasSceneClass = code.includes('class') && code.includes('Scene');
        const hasConstructMethod = code.includes('def construct');
        
        return requiredImports && hasSceneClass && hasConstructMethod;
    }

    async cleanup(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Cleaned up file:', filePath);
            }        } catch (error) {
            console.warn('Failed to cleanup file:', error.message);
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
