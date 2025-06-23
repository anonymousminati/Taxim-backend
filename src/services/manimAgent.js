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
        
        // Model for single-shot generation (without system instruction to avoid API conflicts)
        this.model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });
        
        // Model for chat sessions
        this.chatModel = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });
        
        // Store conversation sessions for multi-turn interactions
        this.conversationSessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    }/**
     * Create or get a conversation session for multi-turn interactions
     */
    getOrCreateSession(sessionId = 'default') {
        // Clean up expired sessions
        this.cleanupExpiredSessions();
          if (!this.conversationSessions.has(sessionId)) {
            const session = this.chatModel.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: "Please act as a specialized AI assistant that generates Python Manim code. Always respond with ONLY Python Manim code - no explanations, no markdown formatting. Use proper Manim syntax and create classes that inherit from Scene with a construct method." }]
                    },
                    {
                        role: "model", 
                        parts: [{ text: "I understand. I will generate only clean Python Manim code without any explanations or formatting. I'll create proper Scene classes with construct methods using current Manim syntax." }]
                    }
                ],
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 0.7,
                },
            });
            
            this.conversationSessions.set(sessionId, {
                chat: session,
                lastActivity: Date.now(),
                context: {
                    previousCodes: [],
                    previousErrors: [],
                    userPreferences: {},
                    conversationHistory: []
                }
            });
            
            console.log(`Created new conversation session: ${sessionId}`);
        } else {
            // Update last activity
            this.conversationSessions.get(sessionId).lastActivity = Date.now();
        }
        
        return this.conversationSessions.get(sessionId);
    }

    /**
     * Clean up expired conversation sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.conversationSessions.entries()) {
            if (now - session.lastActivity > this.sessionTimeout) {
                this.conversationSessions.delete(sessionId);
                console.log(`Cleaned up expired session: ${sessionId}`);
            }
        }
    }

    /**
     * Add context to a conversation session
     */
    addSessionContext(sessionId, type, data) {
        const session = this.getOrCreateSession(sessionId);
        
        switch (type) {
            case 'code':
                session.context.previousCodes.push({
                    code: data.code,
                    timestamp: Date.now(),
                    success: data.success || false,
                    error: data.error || null
                });
                // Keep only last 5 codes to prevent memory bloat
                if (session.context.previousCodes.length > 5) {
                    session.context.previousCodes.shift();
                }
                break;
                
            case 'error':
                session.context.previousErrors.push({
                    error: data.error,
                    code: data.code,
                    timestamp: Date.now()
                });
                // Keep only last 3 errors
                if (session.context.previousErrors.length > 3) {
                    session.context.previousErrors.shift();
                }
                break;
                
            case 'preference':
                session.context.userPreferences[data.key] = data.value;
                break;
                
            case 'conversation':
                session.context.conversationHistory.push({
                    type: data.type, // 'user' or 'assistant'
                    content: data.content,
                    timestamp: Date.now()
                });
                // Keep only last 10 conversation turns
                if (session.context.conversationHistory.length > 10) {
                    session.context.conversationHistory.shift();
                }
                break;
        }
    }    /**
     * Generate context-aware prompt based on session history
     */
    buildContextualPrompt(userPrompt, sessionId, isRetry = false) {
        const session = this.getOrCreateSession(sessionId);
        const context = session.context;
        
        // Start with system prompt for session-based requests
        let contextualPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
        
        // Add conversation context if available
        if (context.conversationHistory.length > 0) {
            contextualPrompt += '\n\nPrevious Conversation Context:';
            context.conversationHistory.slice(-3).forEach(entry => {
                contextualPrompt += `\n${entry.type}: ${entry.content.substring(0, 200)}${entry.content.length > 200 ? '...' : ''}`;
            });
        }
        
        // Add previous successful codes as reference
        if (context.previousCodes.length > 0 && !isRetry) {
            const successfulCodes = context.previousCodes.filter(c => c.success);
            if (successfulCodes.length > 0) {
                const lastSuccessful = successfulCodes[successfulCodes.length - 1];
                contextualPrompt += `\n\nPrevious successful code for reference:\n${lastSuccessful.code.substring(0, 500)}${lastSuccessful.code.length > 500 ? '...' : ''}`;
            }
        }
        
        // Add error context if this is a retry
        if (isRetry && context.previousErrors.length > 0) {
            const recentErrors = context.previousErrors.slice(-2);
            contextualPrompt += '\n\nRecent errors to avoid:';
            recentErrors.forEach(errorInfo => {
                contextualPrompt += `\n- Error: ${errorInfo.error}`;
            });
        }
        
        // Add user preferences
        if (Object.keys(context.userPreferences).length > 0) {
            contextualPrompt += '\n\nUser Preferences:';
            Object.entries(context.userPreferences).forEach(([key, value]) => {
                contextualPrompt += `\n- ${key}: ${value}`;
            });
        }
        
        return contextualPrompt;
    }async generateManimCode(userPrompt, sessionId = 'default') {
        try {
            if (sessionId === 'default' && this.conversationSessions.size === 0) {
                // For first-time use or when no sessions exist, use the single-shot model
                console.log('Using single-shot generation for initial request');
                const fullPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
                
                const result = await this.model.generateContent(fullPrompt);
                const response = await result.response;
                const generatedCode = response.text();
                
                return this.extractPythonCode(generatedCode);
            }
            
            // Use session-based generation
            const session = this.getOrCreateSession(sessionId);
            const contextualPrompt = this.buildContextualPrompt(userPrompt, sessionId);
            
            // Add to conversation history
            this.addSessionContext(sessionId, 'conversation', {
                type: 'user',
                content: userPrompt
            });
            
            console.log(`Generating Manim code for session ${sessionId}`);
            
            const result = await session.chat.sendMessage(contextualPrompt);
            const response = await result.response;
            const generatedCode = response.text();
            
            const extractedCode = this.extractPythonCode(generatedCode);
            
            // Add to conversation history
            this.addSessionContext(sessionId, 'conversation', {
                type: 'assistant',
                content: `Generated Manim code (${extractedCode.length} chars)`
            });
            
            return extractedCode;        } catch (error) {
            console.error('Session-based generation failed, falling back to single-shot:', error.message);
            
            // Fallback to single-shot generation
            try {
                const fullPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
                const result = await this.model.generateContent(fullPrompt);
                const response = await result.response;
                const generatedCode = response.text();
                
                return this.extractPythonCode(generatedCode);
            } catch (fallbackError) {
                throw new Error(`Failed to generate Manim code: ${fallbackError.message}`);
            }
        }
    }

    async fixManimCode(code, errorMessage, sessionId = 'default', maxRetries = 3) {
        let attempts = 0;
        let currentCode = code;
        let lastError = errorMessage;

        // Add error context to session
        this.addSessionContext(sessionId, 'error', {
            error: errorMessage,
            code: code
        });        while (attempts < maxRetries) {            try {
                console.log(`Attempting to fix code (attempt ${attempts + 1}/${maxRetries}) for session ${sessionId}`);
                
                let fixedCode;
                
                try {
                    // Try session-based fixing first
                    const session = this.getOrCreateSession(sessionId);
                    
                    const contextualFixPrompt = this.buildContextualPrompt(
                        `Fix the following error: ${lastError}`, 
                        sessionId, 
                        true
                    ) + `\n\nCode to fix:\n${currentCode}\n\nError details: ${lastError}\n\nPlease provide the corrected code only.`;
                    
                    const result = await session.chat.sendMessage(contextualFixPrompt);
                    const response = await result.response;
                    fixedCode = this.extractPythonCode(response.text());
                } catch (sessionError) {
                    console.log('Session-based fixing failed, using single-shot model:', sessionError.message);
                    
                    // Fallback to single-shot fixing
                    const fixPrompt = MANIM_ERROR_FIX_PROMPT
                        .replace('{error}', lastError)
                        .replace('{code}', currentCode);
                    
                    const result = await this.model.generateContent(fixPrompt);
                    const response = await result.response;
                    fixedCode = this.extractPythonCode(response.text());
                }
                
                // Test the fixed code
                const testResult = await this.testManimCode(fixedCode);
                
                if (testResult.success) {
                    console.log(`Code fixed successfully after ${attempts + 1} attempts`);
                    
                    // Add successful fix to context
                    this.addSessionContext(sessionId, 'code', {
                        code: fixedCode,
                        success: true
                    });
                    
                    this.addSessionContext(sessionId, 'conversation', {
                        type: 'assistant',
                        content: `Successfully fixed code after ${attempts + 1} attempts`
                    });
                    
                    return {
                        success: true,
                        code: fixedCode,
                        attempts: attempts + 1,
                        originalError: errorMessage,
                        sessionId: sessionId
                    };
                } else {
                    currentCode = fixedCode;
                    lastError = testResult.error;
                    attempts++;
                    
                    // Add failed attempt to context
                    this.addSessionContext(sessionId, 'code', {
                        code: fixedCode,
                        success: false,
                        error: testResult.error
                    });
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
            originalError: errorMessage,
            sessionId: sessionId
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
    }    async generateAndFixManimCode(userPrompt, sessionId = 'default', maxAttempts = 3) {
        try {
            // First attempt: Generate initial code with session context
            let code = await this.generateManimCode(userPrompt, sessionId);
            console.log(`Initial code generated for session ${sessionId}, testing...`);
            
            // Test the initial code
            const testResult = await this.testManimCode(code);
            
            if (testResult.success) {
                console.log('Initial code is valid');
                
                // Add successful code to context
                this.addSessionContext(sessionId, 'code', {
                    code: code,
                    success: true
                });
                
                return {
                    success: true,
                    code: code,
                    attempts: 1,
                    wasFixed: false,
                    sessionId: sessionId
                };
            }
            
            console.log('Initial code has errors, attempting to fix...');
            
            // If initial code fails, try to fix it with session context
            const fixResult = await this.fixManimCode(code, testResult.error, sessionId, maxAttempts - 1);
            
            if (fixResult.success) {
                return {
                    success: true,
                    code: fixResult.code,
                    attempts: fixResult.attempts + 1,
                    wasFixed: true,
                    originalError: fixResult.originalError,
                    sessionId: sessionId
                };
            } else {
                // If fixing fails, generate completely new code with enhanced context
                console.log('Fixing failed, generating new code with enhanced context...');
                
                const session = this.getOrCreateSession(sessionId);
                const enhancedPrompt = `${userPrompt}\n\nIMPORTANT: Previous attempts failed with these errors: ${fixResult.finalError}. Generate working code that avoids these specific issues. Consider simpler alternatives if needed.`;
                
                const result = await session.chat.sendMessage(enhancedPrompt);
                const response = await result.response;
                const newCode = this.extractPythonCode(response.text());
                
                // Add conversation context
                this.addSessionContext(sessionId, 'conversation', {
                    type: 'assistant',
                    content: `Generated fallback code after fixing attempts failed`
                });
                
                return {
                    success: true,
                    code: newCode,
                    attempts: maxAttempts,
                    wasFixed: true,
                    originalError: fixResult.originalError,
                    usedFallback: true,
                    sessionId: sessionId
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
    }    async renderAnimationWithErrorHandling(code, sessionId = 'default', maxRetries = 3) {
        try {
            // First, test if the code compiles
            const testResult = await this.testManimCode(code);
            
            if (!testResult.success) {
                console.log('Code has compilation errors, attempting to fix...');
                const fixResult = await this.fixManimCode(code, testResult.error, sessionId, 2);
                
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
                
                // Add successful render to session context
                this.addSessionContext(sessionId, 'conversation', {
                    type: 'assistant',
                    content: `Successfully rendered animation: ${renderResult.videoFileName}`
                });
                
                // Cleanup Python file and temp files
                await this.cleanup(filePath);
                await this.cleanupTempFiles();
                
                return {
                    success: true,
                    ...renderResult,
                    code: code,
                    wasCodeFixed: !testResult.success,
                    sessionId: sessionId
                };
            } catch (renderError) {
                // If rendering fails, it might be a code logic issue
                console.log('Rendering failed, attempting to improve code...');
                
                const session = this.getOrCreateSession(sessionId);
                const improvePrompt = `The code compiled but failed during rendering with error: ${renderError.message}. Make the animation simpler and more robust.`;
                
                const result = await session.chat.sendMessage(improvePrompt);
                const response = await result.response;
                const improvedCode = this.extractPythonCode(response.text());
                
                // Try rendering the improved code
                const improvedFilePath = await this.savePythonFile(improvedCode, `improved_${filename}`);
                const improvedResult = await this.renderAnimation(improvedFilePath, null, 1);
                
                // Add improvement context
                this.addSessionContext(sessionId, 'conversation', {
                    type: 'assistant',
                    content: `Improved and successfully rendered animation after initial failure`
                });
                
                // Cleanup both files and temp files
                await this.cleanup(filePath);
                await this.cleanup(improvedFilePath);
                await this.cleanupTempFiles();
                
                return {
                    success: true,
                    ...improvedResult,
                    code: improvedCode,
                    wasCodeFixed: true,
                    wasImproved: true,
                    sessionId: sessionId
                };
            }
        } catch (error) {
            throw new Error(`Failed to render animation with error handling: ${error.message}`);
        }
    }    async improveManimCode(code, feedback, sessionId = 'default') {
        try {
            let improvedCode;
            
            try {
                // Try session-based improvement first
                const session = this.getOrCreateSession(sessionId);
                
                const contextualPrompt = this.buildContextualPrompt(
                    `Improve the following code: ${feedback}`,
                    sessionId
                ) + `\n\nCode to improve:\n${code}`;
                
                const result = await session.chat.sendMessage(contextualPrompt);
                const response = await result.response;
                improvedCode = this.extractPythonCode(response.text());
            } catch (sessionError) {
                console.log('Session-based improvement failed, using single-shot model:', sessionError.message);
                
                // Fallback to single-shot improvement
                const improvePrompt = `${MANIM_SYSTEM_PROMPT}\n\nImprove the following Manim code based on this feedback: ${feedback}\n\nOriginal code:\n${code}\n\nProvide only the improved code:`;
                
                const result = await this.model.generateContent(improvePrompt);
                const response = await result.response;
                improvedCode = this.extractPythonCode(response.text());
            }
            
            // Add improvement to context if session exists
            try {
                this.addSessionContext(sessionId, 'conversation', {
                    type: 'assistant',
                    content: `Improved code based on feedback: ${feedback.substring(0, 100)}...`
                });
            } catch (contextError) {
                console.warn('Failed to add context, but improvement succeeded:', contextError.message);
            }
            
            return improvedCode;
        } catch (error) {
            console.warn('Failed to improve code, returning original:', error.message);
            return code;
        }
    }

    /**
     * Get conversation session info for debugging/monitoring
     */
    getSessionInfo(sessionId = 'default') {
        const session = this.conversationSessions.get(sessionId);
        if (!session) {
            return { exists: false };
        }

        return {
            exists: true,
            lastActivity: new Date(session.lastActivity),
            codeHistory: session.context.previousCodes.length,
            errorHistory: session.context.previousErrors.length,
            conversationLength: session.context.conversationHistory.length,
            userPreferences: Object.keys(session.context.userPreferences)
        };
    }

    /**
     * Set user preferences for a session
     */
    setUserPreference(sessionId, key, value) {
        this.addSessionContext(sessionId, 'preference', { key, value });
        console.log(`Set preference for session ${sessionId}: ${key} = ${value}`);
    }

    /**
     * Clear conversation session
     */
    clearSession(sessionId = 'default') {
        if (this.conversationSessions.has(sessionId)) {
            this.conversationSessions.delete(sessionId);
            console.log(`Cleared conversation session: ${sessionId}`);
            return true;
        }
        return false;
    }

    /**
     * Get all active session IDs
     */
    getActiveSessions() {
        this.cleanupExpiredSessions();
        return Array.from(this.conversationSessions.keys());
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
