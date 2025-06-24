import { GoogleGenAI  } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { 
  MANIM_SYSTEM_PROMPT, 
  MANIM_ERROR_FIX_PROMPT, 
  PROMPT_CONFIG 
} from "../prompts.js";
import { 
  handleLatexError, 
  createLatexFallback, 
  isLatexError 
} from "../utils/latexUtils.js";
import { 
  findLatestMP4File, 
  findVideoInMediaDir, 
  listDirectoryRecursive,
  generateTempFilename,
  getTimestamp,
  safeFileCleanup
} from "../utils/fileSearch.js";
import { 
  checkSystemRequirements,
  getManimCommands
} from "../utils/systemUtils.js";
import {
  executeWithRetry,
  createRetryCondition,
  withTimeout
} from "../utils/retryUtils.js";
import {
  ManimError,
  createTypedError,
  ErrorAggregator
} from "../utils/errorUtils.js";
import {
  PerformanceMonitor,
  OperationTimer
} from "../utils/monitoringUtils.js";

const execAsync = promisify(exec);

class ManimAgent {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    // Initialize GoogleAI client
    this.genai = new GoogleGenAI(process.env.GEMINI_API_KEY);

    // Model configuration
    this.modelConfig = {
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
    };

    // Store chat sessions for multi-turn conversations
    this.chatSessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.maxSessions = PROMPT_CONFIG.MAX_SESSIONS;
    
    // Logging state to debounce cleanup logs
    this.lastCleanupLog = 0;
    this.cleanupLogInterval = 60000; // Log cleanup at most once per minute
    
    // Initialize monitoring and error handling
    this.performanceMonitor = new PerformanceMonitor({
      enabled: process.env.NODE_ENV !== 'test',
      collectInterval: 10000 // 10 seconds
    });
    
    this.errorAggregator = new ErrorAggregator();
    
    // Setup retry conditions for different error types
    this.retryCondition = createRetryCondition([
      'timeout',
      'network',
      'temporary',
      'rate limit',
      /latex.*error/i,
      /rendering.*failed/i
    ], 3);
    
    console.log("ManimAgent initialized with enhanced monitoring and error handling");
  }
  /**
   * Create or get a conversation session for multi-turn interactions
   */
  getOrCreateSession(sessionId = "default") {
    // Clean up expired sessions
    this.cleanupExpiredSessions();

    if (!this.chatSessions.has(sessionId)) {
      // Create chat session using @google/genai API
      const chatSession = this.genai.chats.create({
        model: this.modelConfig.model,
        systemInstruction: MANIM_SYSTEM_PROMPT,
        generationConfig: this.modelConfig.generationConfig,
      });

      this.chatSessions.set(sessionId, {
        chat: chatSession,
        lastActivity: Date.now(),
        context: {
          previousCodes: [],
          previousErrors: [],
          userPreferences: {},
          conversationHistory: [],
        },
      });

      console.log(`Created new chat session: ${sessionId}`);
    } else {
      // Update last activity
      this.chatSessions.get(sessionId).lastActivity = Date.now();
    }

    return this.chatSessions.get(sessionId);
  }
  /**
   * Clean up expired conversation sessions and enforce size limits
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean up expired sessions
    for (const [sessionId, session] of this.chatSessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.chatSessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    // Enforce max sessions limit (LRU eviction)
    if (this.chatSessions.size > this.maxSessions) {
      const sortedSessions = Array.from(this.chatSessions.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      
      const sessionsToRemove = sortedSessions.slice(0, this.chatSessions.size - this.maxSessions);
      for (const [sessionId] of sessionsToRemove) {
        this.chatSessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    // Debounced logging
    if (cleanedCount > 0 && (now - this.lastCleanupLog) > this.cleanupLogInterval) {
      console.log(`Cleaned up ${cleanedCount} sessions (${this.chatSessions.size}/${this.maxSessions} remaining)`);
      this.lastCleanupLog = now;
    }
  }

  /**
   * Add context to a conversation session
   */
  addSessionContext(sessionId, type, data) {
    const session = this.getOrCreateSession(sessionId);

    switch (type) {
      case "code":
        session.context.previousCodes.push({
          code: data.code,
          timestamp: Date.now(),
          success: data.success || false,
          error: data.error || null,
        });
        // Keep only last 5 codes to prevent memory bloat
        if (session.context.previousCodes.length > 5) {
          session.context.previousCodes.shift();
        }
        break;

      case "error":
        session.context.previousErrors.push({
          error: data.error,
          code: data.code,
          timestamp: Date.now(),
        });
        // Keep only last 3 errors
        if (session.context.previousErrors.length > 3) {
          session.context.previousErrors.shift();
        }
        break;

      case "preference":
        session.context.userPreferences[data.key] = data.value;
        break;

      case "conversation":
        session.context.conversationHistory.push({
          type: data.type, // 'user' or 'assistant'
          content: data.content,
          timestamp: Date.now(),
        });
        // Keep only last 10 conversation turns
        if (session.context.conversationHistory.length > 10) {
          session.context.conversationHistory.shift();
        }
        break;
    }
  }  /**
   * Generate context-aware prompt based on session history
   */
  buildContextualPrompt(userPrompt, sessionId, isRetry = false) {
    const session = this.getOrCreateSession(sessionId);
    const context = session.context;

    // Start with system prompt for session-based requests
    let contextualPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
    
    // Add uniqueness requirement to avoid repetition using UUID
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    contextualPrompt += `\n\nIMPORTANT: Create a UNIQUE animation (ID: ${uniqueId}, Time: ${timestamp}) that is completely different from any previous animations. Use different objects, colors, movements, and visual elements.`;

    // Add specific variety requirements
    const varietyElements = [
      "shapes: Circle, Square, Triangle, Polygon, Star, Ellipse",
      "colors: RED, BLUE, GREEN, YELLOW, PURPLE, ORANGE, PINK, CYAN",
      "movements: shift, rotate, scale, transform, FadeIn, FadeOut, Write, Create",
      "concepts: algebra, geometry, calculus, physics, chemistry, statistics",
    ];

    const varietyList = varietyElements.map((e) => `- ${e}`).join("\n");
    contextualPrompt += `\n\nVariety options to choose from:\n${varietyList}`;
    contextualPrompt += `\n\nSelect different combinations from above to ensure uniqueness.`;

    // Add conversation context if available
    if (context.conversationHistory.length > 0) {
      contextualPrompt += "\n\nPrevious Conversation Context:";
      context.conversationHistory.slice(-2).forEach((entry) => {
        contextualPrompt += `\n${entry.type}: ${entry.content.substring(
          0,
          150
        )}${entry.content.length > 150 ? "..." : ""}`;
      });
    }

    // Add previous successful codes as reference (but emphasize being different)
    if (context.previousCodes.length > 0 && !isRetry) {
      const successfulCodes = context.previousCodes.filter((c) => c.success);
      if (successfulCodes.length > 0) {
        contextualPrompt += `\n\nPrevious animations created (CREATE SOMETHING DIFFERENT):`;
        successfulCodes.slice(-2).forEach((codeInfo, index) => {
          contextualPrompt += `\n${
            index + 1
          }. Previous code used: ${codeInfo.code.substring(0, 200)}...`;
        });
        contextualPrompt += `\n\nMAKE SURE to use DIFFERENT objects, colors, animations, and concepts from the above.`;
      }
    }

    // Add error context if this is a retry
    if (isRetry && context.previousErrors.length > 0) {
      const recentErrors = context.previousErrors.slice(-2);
      contextualPrompt += "\n\nRecent errors to avoid:";
      recentErrors.forEach((errorInfo) => {
        contextualPrompt += `\n- Error: ${errorInfo.error}`;
      });
    }

    // Add user preferences
    if (Object.keys(context.userPreferences).length > 0) {
      contextualPrompt += "\n\nUser Preferences:";
      Object.entries(context.userPreferences).forEach(([key, value]) => {
        contextualPrompt += `\n- ${key}: ${value}`;
      });
    }

    // Add variety suggestions
    contextualPrompt += `\n\nSuggestions for variety: Try different shapes (Circle, Square, Triangle, Star), colors (RED, BLUE, GREEN, YELLOW, PURPLE), movements (shift, rotate, scale, transform), or mathematical concepts (functions, geometry, algebra).`;

    // Validate prompt length before returning
    if (contextualPrompt.length > PROMPT_CONFIG.MAX_PROMPT_LENGTH) {
      console.warn(`Prompt length ${contextualPrompt.length} exceeds limit, truncating context...`);
      // Truncate conversation history and previous codes to fit within limit
      const basePrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}\n\nIMPORTANT: Create a UNIQUE animation (ID: ${uniqueId}, Time: ${timestamp}).`;
      if (basePrompt.length > PROMPT_CONFIG.MAX_PROMPT_LENGTH) {
        throw new Error("Base prompt too long, reduce user request length.");
      }
      return basePrompt;
    }

    return contextualPrompt;
  }
  async generateManimCode(userPrompt, sessionId = "default") {
    const timer = new OperationTimer(`generateManimCode-${sessionId}`);
    
    try {
      // Always use session-based generation for better context and variety
      const session = this.getOrCreateSession(sessionId);
      const contextualPrompt = this.buildContextualPrompt(userPrompt, sessionId);

      // Add to conversation history
      this.addSessionContext(sessionId, "conversation", {
        type: "user",
        content: userPrompt,
      });

      console.log(`Generating Manim code for session ${sessionId}`);
      console.log(
        "Prompt preview:",
        contextualPrompt.substring(0, PROMPT_CONFIG.CONTEXT_PREVIEW_LENGTH) + "..."
      );

      timer.checkpoint('prompt-prepared');

      // Use enhanced retry logic for AI generation
      const result = await executeWithRetry(
        async () => {
          const response = await withTimeout(
            session.chat.sendMessage(contextualPrompt),
            30000, // 30 second timeout
            'AI generation timed out'
          );
          return response.text();
        },
        3, // max retries
        1000, // initial delay
        2, // backoff multiplier
        this.retryCondition
      );

      if (!result.success) {
        throw createTypedError(result.error, { operation: 'generateManimCode', sessionId });
      }

      const generatedCode = result.result;
      const extractedCode = this.extractPythonCode(generatedCode);

      timer.checkpoint('code-generated');

      // Add to conversation history
      this.addSessionContext(sessionId, "conversation", {
        type: "assistant",
        content: `Generated Manim code (${extractedCode.length} chars)`,
      });

      // Record performance metrics
      const timing = timer.end();
      this.performanceMonitor.addMetric('generation.duration', timing.totalTime);
      this.performanceMonitor.addMetric('generation.success', 1);

      return extractedCode;
    } catch (error) {
      const timing = timer.end();
      this.performanceMonitor.addMetric('generation.duration', timing.totalTime);
      this.performanceMonitor.addMetric('generation.failure', 1);
      this.errorAggregator.add(error, { operation: 'generateManimCode', sessionId });

      console.error("Session-based generation failed, falling back to single-shot:", error.message);

      // Fallback to single-shot generation with enhanced error handling
      try {
        const fallbackResult = await executeWithRetry(
          async () => {
            const fullPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
            const result = await withTimeout(
              this.genai.models.generateContentInternal({
                model: this.modelConfig.model,
                generationConfig: this.modelConfig.generationConfig,
                contents: [{ parts: [{ text: fullPrompt }] }],
              }),
              30000,
              'Fallback AI generation timed out'
            );
            return result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "";
          },
          2, // fewer retries for fallback
          1000,
          2,
          this.retryCondition
        );

        if (!fallbackResult.success) {
          throw createTypedError(fallbackResult.error, { operation: 'generateManimCode-fallback', sessionId });
        }

        this.performanceMonitor.addMetric('generation.fallback_success', 1);
        return this.extractPythonCode(fallbackResult.result);
      } catch (fallbackError) {
        this.performanceMonitor.addMetric('generation.fallback_failure', 1);
        const typedError = createTypedError(fallbackError, { operation: 'generateManimCode-complete-failure', sessionId });
        this.errorAggregator.add(typedError);
        throw new ManimError(`Failed to generate Manim code: ${fallbackError.message}`, 'GENERATION_FAILED', { sessionId });
      }
    }
  }/**
   * Try LaTeX-specific fixes first as they're faster and more reliable
   */
  async _tryLatexFix(code, errorMessage, sessionId) {
    console.log('Checking for LaTeX-specific fixes...');
    const latexFix = await handleLatexError(code, errorMessage);
    if (!latexFix) return null;

    console.log('Attempting LaTeX fix...');
    const testResult = await this.testManimCode(latexFix);
    if (testResult.success) {
      console.log('LaTeX fix successful!');
      return {
        success: true,
        code: latexFix,
        attempts: 1,
        fixType: 'latex',
        originalError: errorMessage,
        sessionId: sessionId
      };
    }
    
    if (testResult.suggestedFix) {
      console.log('Trying suggested LaTeX fix...');
      return { suggestedCode: testResult.suggestedFix };
    }
    
    return null;
  }

  /**
   * Attempt to fix code using AI models (session-based or single-shot)
   */
  async _attemptAIFix(currentCode, lastError, sessionId) {
    try {
      // Try session-based fixing first
      const session = this.getOrCreateSession(sessionId);
      const contextualFixPrompt =
        this.buildContextualPrompt(
          `Fix the following error: ${lastError}`,
          sessionId,
          true
        ) +
        `\n\nCode to fix:\n${currentCode}\n\nError details: ${lastError}\n\nPlease provide the corrected code only.`;

      const response = await session.chat.sendMessage(contextualFixPrompt);
      return this.extractPythonCode(response.text());
    } catch (sessionError) {
      console.log(
        "Session-based fixing failed, using single-shot model:",
        sessionError.message
      );

      // Fallback to single-shot fixing
      const fixPrompt = MANIM_ERROR_FIX_PROMPT.replace(
        "{error}",
        lastError
      ).replace("{code}", currentCode);

      const result = await this.genai.models.generateContentInternal({
        model: this.modelConfig.model,
        generationConfig: this.modelConfig.generationConfig,
        contents: [{ parts: [{ text: fixPrompt }] }],
      });
      return this.extractPythonCode(result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "");
    }
  }

  /**
   * Try LaTeX fallback as last resort
   */
  async _tryLatexFallback(currentCode, lastError, errorMessage, maxRetries, sessionId) {
    if (!isLatexError(lastError) && !isLatexError(errorMessage)) {
      return null;
    }

    console.log('All fixes failed, trying LaTeX fallback...');
    const fallbackCode = createLatexFallback(currentCode);
    const fallbackTest = await this.testManimCode(fallbackCode);
    
    if (fallbackTest.success) {
      console.log('LaTeX fallback successful!');
      return {
        success: true,
        code: fallbackCode,
        attempts: maxRetries + 1,
        fixType: 'latex-fallback',
        originalError: errorMessage,
        sessionId: sessionId,
        usedFallback: true
      };
    }
    
    return null;
  }

  async fixManimCode(
    code,
    errorMessage,
    sessionId = "default",
    maxRetries = 3
  ) {
    // First try LaTeX-specific fixes
    const latexResult = await this._tryLatexFix(code, errorMessage, sessionId);
    if (latexResult?.success) return latexResult;
    
    let currentCode = latexResult?.suggestedCode || code;
    let lastError = errorMessage;
    let attempts = 0;

    // Add error context to session
    this.addSessionContext(sessionId, "error", { error: errorMessage, code: code });

    // Main retry loop
    while (attempts < maxRetries) {
      try {
        console.log(`Attempting to fix code (attempt ${attempts + 1}/${maxRetries}) for session ${sessionId}`);

        const fixedCode = await this._attemptAIFix(currentCode, lastError, sessionId);
        const testResult = await this.testManimCode(fixedCode);

        if (testResult.success) {
          console.log(`Code fixed successfully after ${attempts + 1} attempts`);
          
          // Add successful fix to context
          this.addSessionContext(sessionId, "code", { code: fixedCode, success: true });
          this.addSessionContext(sessionId, "conversation", {
            type: "assistant",
            content: `Successfully fixed code after ${attempts + 1} attempts`,
          });

          return {
            success: true,
            code: fixedCode,
            attempts: attempts + 1,
            originalError: errorMessage,
            sessionId: sessionId,
          };
        }

        // Prepare for next attempt
        currentCode = fixedCode;
        lastError = testResult.error;
        attempts++;

        // Add failed attempt to context
        this.addSessionContext(sessionId, "code", {
          code: fixedCode,
          success: false,
          error: testResult.error,
        });
        
        // Add retry delay between attempts
        if (attempts < maxRetries) {
          console.log(`Waiting 1 second before retry attempt ${attempts + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error in fix attempt ${attempts + 1}:`, error.message);
        attempts++;
        lastError = error.message;
        
        if (attempts < maxRetries) {
          console.log(`Waiting 1 second before retry attempt ${attempts + 1}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Try LaTeX fallback as last resort
    const fallbackResult = await this._tryLatexFallback(currentCode, lastError, errorMessage, maxRetries, sessionId);
    if (fallbackResult) return fallbackResult;

    return {
      success: false,
      code: currentCode,
      attempts: maxRetries,
      finalError: lastError,
      originalError: errorMessage,
      sessionId: sessionId,
    };
  }async testManimCode(code) {
    try {
      const testFilename = generateTempFilename("test_animation", ".py");
      const testFilePath = await this.savePythonFile(code, testFilename);

      // First try Python compilation
      const compileCommand = `python -m py_compile "${testFilePath}"`;
      await execAsync(compileCommand, { timeout: 10000 });

      // If code uses LaTeX, test with a quick Manim dry run
      if (code.includes('MathTex') || code.includes('Tex') || code.includes('NumberPlane') || code.includes('Axes')) {
        try {
          console.log('Code contains LaTeX elements, testing with Manim dry run...');
          const dryRunCommand = `manim --dry_run "${testFilePath}"`;
          await execAsync(dryRunCommand, { timeout: 30000 });
          console.log('LaTeX dry run successful');        } catch (dryRunError) {
          console.log('Manim dry run failed:', dryRunError.message);
          // Check if it's a LaTeX error
          const latexFix = await handleLatexError(code, dryRunError.message);
          if (latexFix) {
            await this.cleanup(testFilePath);
            return { 
              success: false, 
              error: dryRunError.message, 
              suggestedFix: latexFix,
              isLatexError: true
            };
          }
          throw dryRunError;
        }
      }

      await this.cleanup(testFilePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  async generateAndFixManimCode(
    userPrompt,
    sessionId = "default",
    maxAttempts = 3
  ) {
    try {
      // First attempt: Generate initial code with session context
      let code = await this.generateManimCode(userPrompt, sessionId);
      console.log(
        `Initial code generated for session ${sessionId}, testing...`
      );

      // Test the initial code
      const testResult = await this.testManimCode(code);

      if (testResult.success) {
        console.log("Initial code is valid");

        // Add successful code to context
        this.addSessionContext(sessionId, "code", {
          code: code,
          success: true,
        });

        return {
          success: true,
          code: code,
          attempts: 1,
          wasFixed: false,
          sessionId: sessionId,
        };
      }

      console.log("Initial code has errors, attempting to fix...");

      // If initial code fails, try to fix it with session context
      const fixResult = await this.fixManimCode(
        code,
        testResult.error,
        sessionId,
        maxAttempts - 1
      );

      if (fixResult.success) {
        return {
          success: true,
          code: fixResult.code,
          attempts: fixResult.attempts + 1,
          wasFixed: true,
          originalError: fixResult.originalError,
          sessionId: sessionId,
        };
      } else {
        // If fixing fails, generate completely new code with enhanced context
        console.log(
          "Fixing failed, generating new code with enhanced context..."
        );

        const session = this.getOrCreateSession(sessionId);
        const enhancedPrompt = `${userPrompt}\n\nIMPORTANT: Previous attempts failed with these errors: ${fixResult.finalError}. Generate working code that avoids these specific issues. Consider simpler alternatives if needed.`;

        const result = await session.chat.sendMessage(enhancedPrompt);
        const response = await result.response;
        const newCode = this.extractPythonCode(response.text());

        // Add conversation context
        this.addSessionContext(sessionId, "conversation", {
          type: "assistant",
          content: `Generated fallback code after fixing attempts failed`,
        });

        return {
          success: true,
          code: newCode,
          attempts: maxAttempts,
          wasFixed: true,
          originalError: fixResult.originalError,
          usedFallback: true,
          sessionId: sessionId,
        };
      }
    } catch (error) {
      throw new Error(
        `Failed to generate working Manim code: ${error.message}`
      );
    }
  }
  extractPythonCode(text) {
    // Remove any markdown code blocks if present
    const codeBlockPattern = /```python\n([\s\S]*?)\n```/g;
    const match = codeBlockPattern.exec(text);

    if (match) {
      return match[1].trim();
    }

    // Remove prompt echoes if they exist
    if (text.includes("User Request:")) {
      text = text.split("User Request:")[0];
    }
    
    // Remove system prompt echoes
    if (text.includes("You are a specialized AI assistant")) {
      const parts = text.split("You are a specialized AI assistant");
      text = parts[parts.length - 1];
    }
    
    // Remove repeated import statements
    const lines = text.split('\n');
    const uniqueLines = [];
    let hasImport = false;
    
    for (const line of lines) {
      if (line.trim().startsWith('from manim import')) {
        if (!hasImport) {
          uniqueLines.push(line);
          hasImport = true;
        }
      } else {
        uniqueLines.push(line);
      }
    }
    
    const cleanedText = uniqueLines.join('\n').trim();

    // Debug logging to check for uniqueness
    console.log("Generated code length:", cleanedText.length);
    console.log("Code preview:", cleanedText.substring(0, 100) + "...");
    return cleanedText;
  }
  async savePythonFile(code, filename = null) {
    const tempDir = process.env.TEMP_DIR || "temp";
    const actualFilename = filename || generateTempFilename("animation", ".py");
    const filePath = path.join(process.cwd(), tempDir, actualFilename);

    // Ensure temp directory exists
    const fullTempDir = path.dirname(filePath);
    if (!fs.existsSync(fullTempDir)) {
      fs.mkdirSync(fullTempDir, { recursive: true });
    }

    fs.writeFileSync(filePath, code);
    return filePath;
  }  /**
   * Extract class name from Python file content
   */
  _extractClassName(pythonFilePath) {
    const fileContent = fs.readFileSync(pythonFilePath, "utf8");
    console.log("File content preview:", fileContent.substring(0, 200) + "...");

    const classMatch = fileContent.match(/class\s+(\w+)\s*\(/);
    const className = classMatch ? classMatch[1] : "Animation";

    console.log("Extracted class name:", className);
    console.log("Class match result:", classMatch);

    if (!classMatch) {
      console.error("No class found in file! Full content:", fileContent);
      throw new Error("No valid Manim Scene class found in generated code");
    }

    return className;
  }

  /**
   * Execute Manim rendering command with error handling
   */
  async _executeManimCommand(pythonFilePath, className, attemptNumber, maxRetries) {
    const commands = getManimCommands(pythonFilePath, className);
    let command = commands[attemptNumber] || commands[0];
    
    console.log(`Executing Manim command (attempt ${attemptNumber + 1}/${maxRetries}):`, command);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 180000, // 3 minute timeout
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
    });

    console.log("Manim stdout:", stdout);
    if (stderr) {
      console.log("Manim stderr:", stderr);
    }

    // Check for actual errors (Manim often outputs warnings as stderr)
    const hasErrors = stderr && (
      stderr.includes("ERROR") ||
      stderr.includes("Exception") ||
      stderr.includes("Traceback") ||
      stderr.includes("failed") ||
      stderr.includes("could not")
    );

    if (hasErrors && !stdout.includes("100%")) {
      throw new Error(`Manim rendering error: ${stderr}`);
    }

    return { stdout, stderr };
  }

  /**
   * Search for generated video file using multiple strategies
   */
  async _findGeneratedVideo(pythonFilePath, className) {
    let foundVideoPath = null;
    const baseFileName = path.basename(pythonFilePath, ".py");
    const mediaDir = path.join(process.cwd(), "media");

    // Wait a moment for file system to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Primary search: Look in standard Manim output locations
    if (fs.existsSync(mediaDir)) {
      console.log("Searching for video in media directory...");
      foundVideoPath = findVideoInMediaDir(mediaDir, className, baseFileName);
    }

    // Secondary search: Look for any recent MP4 file
    if (!foundVideoPath) {
      console.log("Searching for latest MP4 file...");
      foundVideoPath = findLatestMP4File(process.cwd());
    }

    // Tertiary search: Check current directory for common patterns
    if (!foundVideoPath) {
      const timestamp = getTimestamp();
      const possibleNames = [
        `${className}.mp4`,
        `${baseFileName}.mp4`,
        `${className}_${timestamp}.mp4`,
        `${baseFileName}_${timestamp}.mp4`,
      ];

      for (const name of possibleNames) {
        const possiblePath = path.join(process.cwd(), name);
        if (fs.existsSync(possiblePath)) {
          foundVideoPath = possiblePath;
          console.log(`Found video with pattern search: ${possiblePath}`);
          break;
        }
      }
    }

    return foundVideoPath || null;
  }

  /**
   * Log debugging information when video is not found
   */
  _logVideoNotFoundDebug(className, baseFileName) {
    console.log("=== DEBUGGING: No video found ===");
    console.log("Working directory:", process.cwd());
    console.log("Expected class name:", className);
    console.log("Python file base name:", baseFileName);

    console.log("\nFiles in working directory:");
    const workingDirFiles = fs.readdirSync(process.cwd());
    workingDirFiles.forEach((file) => {
      const filePath = path.join(process.cwd(), file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && file.endsWith(".mp4")) {
        console.log(`  VIDEO: ${file} (${stat.size} bytes, ${stat.mtime})`);
      } else if (stat.isFile()) {
        console.log(`  FILE: ${file} (${stat.size} bytes)`);
      } else {
        console.log(`  DIR:  ${file}/`);
      }
    });

    const mediaDir = path.join(process.cwd(), "media");
    if (fs.existsSync(mediaDir)) {
      console.log("\nMedia directory structure:");
      listDirectoryRecursive(mediaDir);
    } else {
      console.log("\nNo media directory found");
    }

    console.log("=== END DEBUGGING ===\n");
  }

  /**
   * Move/copy video to final output directory
   */
  _finalizeVideo(foundVideoPath, className, outputDir) {
    const timestamp = getTimestamp();
    const finalVideoName = `${className}_${timestamp}.mp4`;
    const finalVideoPath = path.join(outputDir, finalVideoName);

    if (foundVideoPath !== finalVideoPath) {
      fs.copyFileSync(foundVideoPath, finalVideoPath);
      console.log(`Copied video from ${foundVideoPath} to ${finalVideoPath}`);

      // Clean up the original file
      try {
        fs.unlinkSync(foundVideoPath);
      } catch (cleanupError) {
        console.warn("Could not clean up original video file:", cleanupError.message);
      }
    }

    return { finalVideoName, finalVideoPath };
  }

  async renderAnimation(pythonFilePath, outputDir = null, maxRetries = 2) {
    let attempts = 0;
    let lastError = null;

    while (attempts < maxRetries) {
      try {
        const animationOutputDir = outputDir || process.env.ANIMATION_OUTPUT_DIR || "public/animations";
        const fullOutputDir = path.join(process.cwd(), animationOutputDir);

        // Ensure output directory exists
        if (!fs.existsSync(fullOutputDir)) {
          fs.mkdirSync(fullOutputDir, { recursive: true });
        }

        // Extract class name from Python file
        const className = this._extractClassName(pythonFilePath);

        // Clean media directory before rendering to avoid confusion
        await this.cleanupMediaFolder();

        // Execute Manim command
        const { stdout, stderr } = await this._executeManimCommand(pythonFilePath, className, attempts, maxRetries);

        // Search for generated video file
        const foundVideoPath = await this._findGeneratedVideo(pythonFilePath, className);
        
        if (!foundVideoPath) {
          const baseFileName = path.basename(pythonFilePath, ".py");
          this._logVideoNotFoundDebug(className, baseFileName);
          throw new Error(`No video file was generated by Manim. Class: ${className}, Base: ${baseFileName}`);
        }

        // Move/copy video to final output directory
        const { finalVideoName } = this._finalizeVideo(foundVideoPath, className, fullOutputDir);

        // Clean up media folder after successful rendering
        await this.cleanupMediaFolder();

        return {
          success: true,
          videoPath: `/animations/${finalVideoName}`,
          videoFileName: finalVideoName,
          stdout,
          stderr,
          attempts: attempts + 1,
        };
      } catch (error) {
        attempts++;
        lastError = error;
        console.error(`Rendering attempt ${attempts} failed:`, error.message);

        if (attempts < maxRetries) {
          console.log(`Retrying rendering in 2 seconds... (${attempts}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    
    throw new Error(`Failed to render animation after ${maxRetries} attempts: ${lastError.message}`);
  }

  async renderAnimationWithErrorHandling(
    code,
    sessionId = "default",
    maxRetries = 3
  ) {
    try {
      // First, test if the code compiles
      const testResult = await this.testManimCode(code);

      if (!testResult.success) {
        console.log("Code has compilation errors, attempting to fix...");
        const fixResult = await this.fixManimCode(
          code,
          testResult.error,
          sessionId,
          2
        );

        if (!fixResult.success) {
          throw new Error(`Code compilation failed: ${fixResult.finalError}`);
        }

        code = fixResult.code;
        console.log("Code fixed successfully, proceeding with rendering...");
      }      // Save the (possibly fixed) code
      const filename = generateTempFilename("animation", ".py");
      const filePath = await this.savePythonFile(code, filename);
      // Attempt to render
      try {
        const renderResult = await this.renderAnimation(
          filePath,
          null,
          maxRetries
        );

        // Add successful render to session context
        this.addSessionContext(sessionId, "conversation", {
          type: "assistant",
          content: `Successfully rendered animation: ${renderResult.videoFileName}`,
        });

        // Cleanup Python file and temp files
        await this.cleanup(filePath);
        await this.cleanupTempFiles();
        return {
          success: true,
          ...renderResult,
          code: code,
          wasCodeFixed: !testResult.success,
          sessionId: sessionId,
        };
      } catch (renderError) {
        // If rendering fails, it might be a code logic issue
        console.log("Rendering failed, attempting to improve code...");
        console.log("Render error:", renderError.message);

        try {
          const session = this.getOrCreateSession(sessionId);
          const improvePrompt = `The code compiled but failed during rendering with error: ${renderError.message}. Make the animation simpler and more robust.`;

          // Validate prompt is not empty
          if (!improvePrompt || improvePrompt.trim().length === 0) {
            throw new Error("Empty improvement prompt generated");
          }

          console.log(
            "Sending improvement prompt:",
            improvePrompt.substring(0, 100) + "..."
          );
          const result = await session.chat.sendMessage(improvePrompt);
          const response = await result.response;
          const improvedCode = this.extractPythonCode(response.text());

          if (!improvedCode || improvedCode.trim().length === 0) {
            throw new Error("Empty improved code received");
          }          // Try rendering the improved code
          const improvedFilePath = await this.savePythonFile(
            improvedCode,
            generateTempFilename("improved", ".py")
          );
          const improvedResult = await this.renderAnimation(
            improvedFilePath,
            null,
            1
          );

          // Add improvement context
          this.addSessionContext(sessionId, "conversation", {
            type: "assistant",
            content: `Improved and successfully rendered animation after initial failure`,
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
            sessionId: sessionId,
          };
        } catch (improveError) {
          console.error("Failed to improve code:", improveError.message);

          // If improvement fails, return the original render error
          await this.cleanup(filePath);
          await this.cleanupTempFiles();

          throw new Error(
            `Rendering failed: ${renderError.message}. Code improvement also failed: ${improveError.message}`
          );
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to render animation with error handling: ${error.message}`
      );
    }
  }

 async improveManimCode(code, feedback, sessionId = 'default') {
    try {
        let improvedCode;
        
        try {
            // Try session-based improvement first
            const session = this.getOrCreateSession(sessionId);

            const contextualPrompt = this.buildContextualPrompt(
                `Improve the following code: ${feedback}`,
                sessionId
            ) + `\n\nCode to improve:\n${code}`;

            // Validate prompt is not empty
            if (!contextualPrompt || contextualPrompt.trim().length === 0) {
                throw new Error('Empty contextual prompt generated');
            }

            console.log('Sending contextual improvement prompt, length:', contextualPrompt.length);
            const response = await session.chat.sendMessage(contextualPrompt);
            improvedCode = this.extractPythonCode(response.text());
        } catch (sessionError) {
            console.log('Session-based improvement failed, using single-shot model:', sessionError.message);            // Fallback to single-shot improvement
            const improvePrompt = `${MANIM_SYSTEM_PROMPT}\n\nImprove the following Manim code based on this feedback: ${feedback}\n\nOriginal code:\n${code}\n\nProvide only the improved code:`;

            // Validate fallback prompt is not empty
            if (!improvePrompt || improvePrompt.trim().length === 0) {
                throw new Error('Empty fallback improvement prompt generated');
            }

            console.log('Sending fallback improvement prompt, length:', improvePrompt.length);
            const result = await this.genai.models.generateContentInternal({
              model: this.modelConfig.model,
              generationConfig: this.modelConfig.generationConfig,
              contents: [{ parts: [{ text: improvePrompt }] }],
            });
            improvedCode = this.extractPythonCode(result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "");
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
    const session = this.chatSessions.get(sessionId);
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
    this.addSessionContext(sessionId, "preference", { key, value });
    console.log(`Set preference for session ${sessionId}: ${key} = ${value}`);
  }

  /**
   * Clear conversation session
   */
  clearSession(sessionId = 'default') {
    if (this.chatSessions.has(sessionId)) {
        this.chatSessions.delete(sessionId);
        console.log(`Cleared chat session: ${sessionId}`);
        return true;
    }
    return false;
}

  /**
   * Get all active session IDs
   */
getActiveSessions() {
    this.cleanupExpiredSessions();
    return Array.from(this.chatSessions.keys());
}

  isValidManimCode(code) {
    // Basic validation checks
    const requiredImports =
      code.includes("from manim import") || code.includes("import manim");
    const hasSceneClass = code.includes("class") && code.includes("Scene");
    const hasConstructMethod = code.includes("def construct");

    return requiredImports && hasSceneClass && hasConstructMethod;
  }
  async cleanup(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Cleaned up file:", filePath);
      }
    } catch (error) {
      console.warn("Failed to cleanup file:", error.message);
    }
  }
  async cleanupMediaFolder() {
    try {
      const mediaDir = path.join(process.cwd(), "media");

      if (fs.existsSync(mediaDir)) {
        const now = Date.now();
        
        // Recursively remove media directory and all its contents
        const removeDirectory = (dirPath) => {
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);

            files.forEach((file) => {
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
        
        // Debounced logging for media folder cleanup
        if ((now - this.lastCleanupLog) > this.cleanupLogInterval) {
          console.log("Media folder cleaned up successfully");
          this.lastCleanupLog = now;
        }
      }
    } catch (error) {
      console.warn("Failed to cleanup media folder:", error.message);
    }
  }  async cleanupTempFiles() {
    try {
      const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || "temp");
      const now = Date.now();
      
      if (fs.existsSync(tempDir)) {
        const result = await safeFileCleanup(tempDir, 60 * 60 * 1000); // 1 hour
        
        // Debounced logging for temp file cleanup
        if (result.cleaned > 0 && (now - this.lastCleanupLog) > this.cleanupLogInterval) {
          console.log(`Cleaned up ${result.cleaned} temporary files from ${tempDir}`);
          this.lastCleanupLog = now;
        }
      }
    } catch (error) {
      console.warn("Failed to cleanup temporary files:", error.message);
    }
  }  async checkSystemRequirements() {
    return await checkSystemRequirements();
  }

  /**
   * Get health and performance status
   */
  getHealthStatus() {
    const health = this.performanceMonitor.getHealthStatus();
    const errorSummary = this.errorAggregator.getSummary();
    
    return {
      system: health,
      errors: errorSummary,
      sessions: {
        active: this.chatSessions.size,
        max: this.maxSessions
      },
      performance: {
        generation: {
          avgDuration: this.performanceMonitor.getMetricStats('generation.duration')?.avg,
          successRate: this._calculateSuccessRate('generation')
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed performance metrics
   */
  getPerformanceMetrics(timeRange = 300000) { // 5 minutes default
    return {
      generation: {
        duration: this.performanceMonitor.getMetricStats('generation.duration', timeRange),
        success: this.performanceMonitor.getMetricStats('generation.success', timeRange),
        failure: this.performanceMonitor.getMetricStats('generation.failure', timeRange),
        fallbackSuccess: this.performanceMonitor.getMetricStats('generation.fallback_success', timeRange),
        fallbackFailure: this.performanceMonitor.getMetricStats('generation.fallback_failure', timeRange)
      },
      system: this.performanceMonitor.getHealthStatus(),
      timeRange
    };
  }

  /**
   * Reset error aggregator (useful for testing or after resolving issues)
   */
  resetErrorTracking() {
    this.errorAggregator.clear();
    console.log('Error tracking reset');
  }

  /**
   * Calculate success rate for an operation
   */
  _calculateSuccessRate(operation) {
    const success = this.performanceMonitor.getMetricStats(`${operation}.success`);
    const failure = this.performanceMonitor.getMetricStats(`${operation}.failure`);
    
    if (!success && !failure) return null;
    
    const totalSuccess = success?.count || 0;
    const totalFailure = failure?.count || 0;
    const total = totalSuccess + totalFailure;
    
    return total > 0 ? (totalSuccess / total) * 100 : null;
  }

  /**
   * Cleanup resources when shutting down
   */
  shutdown() {
    if (this.performanceMonitor) {
      this.performanceMonitor.stop();
    }
    this.chatSessions.clear();
    console.log('ManimAgent shutdown complete');
  }
  
  // Utility methods are now in separate modules
  // - LaTeX handling: latexUtils.js
  // - File search: fileSearch.js  
  // - System checks: systemUtils.js
}

export default ManimAgent;
