import { GoogleGenAI  } from "@google/genai";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const MANIM_SYSTEM_PROMPT = `You are a specialized AI assistant that generates Python Manim code for mathematical and educational animations.

IMPORTANT RULES:
1. Always respond with ONLY Python Manim code - no explanations, no markdown formatting
2. Use proper Manim syntax with the latest version conventions
3. Create a class that inherits from Scene
4. Include proper imports at the top: "from manim import *"
5. The main animation method should be called 'construct'
6. Generate complete, runnable code that creates engaging visual animations
7. Focus on mathematical concepts, educational content, or visual demonstrations
8. Use appropriate Manim objects like Text, Circle, Square, Arrow, etc.

CRITICAL SYNTAX RULES:
- Use self.play() for animations, self.wait() for pauses
- Never put self.wait() inside self.play()
- Always separate animation and wait commands
- Use proper animation constructors: Create(), Write(), FadeIn(), FadeOut(), Transform()
- For rotations use: Rotate(object, angle=PI/2, about_point=ORIGIN)
- For movements use: object.animate.shift(direction)
- For parameters in self.play(), ONLY use: run_time=1.5 (NO rate_func parameter!)
- DO NOT use any rate_func parameter - it causes errors
- Keep animations simple and working

FORBIDDEN:
- Don't use LaTeX, MathTex for labels or text rendering
- NumberPlane, Axes, CoordinateSystem (requires LaTeX for labels)
- MathTex, Tex (requires LaTeX for mathematical expressions)
- Any mathematical text rendering that needs LaTeX
- rate_func=anything (causes AttributeError)
- rate_functions.anything (causes AttributeError)
- Any ease_in, ease_out, smooth functions (not available)

PREFERRED OBJECTS (no LaTeX required):
- Circle, Square, Rectangle, Triangle, Polygon, Star, Ellipse
- Text (for simple text, not mathematical expressions)
- Arrow, Line, Dot, Point
- Simple geometric shapes and transformations

Example structure:
from manim import *

class MyAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
        self.play(circle.animate.shift(UP), run_time=2)
        self.wait(1)

Remember: NO rate_func parameter, keep it simple and working!`;

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
   * Clean up expired conversation sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.chatSessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.chatSessions.delete(sessionId);
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
  }
  /**
   * Generate context-aware prompt based on session history
   */
  buildContextualPrompt(userPrompt, sessionId, isRetry = false) {
    const session = this.getOrCreateSession(sessionId);
    const context = session.context;

    // Start with system prompt for session-based requests
    let contextualPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`; // Add uniqueness requirement to avoid repetition
    const uniqueId = Math.random().toString(36).substring(2, 8);
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

    return contextualPrompt;
  }

  async generateManimCode(userPrompt, sessionId = "default") {
    try {
      // Always use session-based generation for better context and variety
      const session = this.getOrCreateSession(sessionId);
      const contextualPrompt = this.buildContextualPrompt(
        userPrompt,
        sessionId
      );

      // Add to conversation history
      this.addSessionContext(sessionId, "conversation", {
        type: "user",
        content: userPrompt,
      });

      console.log(`Generating Manim code for session ${sessionId}`);
      console.log(
        "Prompt preview:",
        contextualPrompt.substring(0, 300) + "..."
      );

      // Send message to chat session
      const response = await session.chat.sendMessage(contextualPrompt);
      const generatedCode = response.text();
      const extractedCode = this.extractPythonCode(generatedCode);

      // Add to conversation history
      this.addSessionContext(sessionId, "conversation", {
        type: "assistant",
        content: `Generated Manim code (${extractedCode.length} chars)`,
      });

      return extractedCode;
    } catch (error) {
      console.error(
        "Session-based generation failed, falling back to single-shot:",
        error.message
      );      // Fallback to single-shot generation
      try {
        // Use models API for single-shot generation
        const fullPrompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}`;
        const result = await this.genai.models.generateContentInternal({
          model: this.modelConfig.model,
          generationConfig: this.modelConfig.generationConfig,
          contents: [{ parts: [{ text: fullPrompt }] }],
        });
        const generatedCode = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return this.extractPythonCode(generatedCode);
      } catch (fallbackError) {
        throw new Error(
          `Failed to generate Manim code: ${fallbackError.message}`
        );
      }
    }
  }
  async fixManimCode(
    code,
    errorMessage,
    sessionId = "default",
    maxRetries = 3
  ) {
    let attempts = 0;
    let currentCode = code;
    let lastError = errorMessage;

    // Add error context to session
    this.addSessionContext(sessionId, "error", {
      error: errorMessage,
      code: code,
    });

    while (attempts < maxRetries) {
      try {
        console.log(
          `Attempting to fix code (attempt ${
            attempts + 1
          }/${maxRetries}) for session ${sessionId}`
        );

        let fixedCode;

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
          fixedCode = this.extractPythonCode(response.text());
        } catch (sessionError) {
          console.log(
            "Session-based fixing failed, using single-shot model:",
            sessionError.message
          );          // Fallback to single-shot fixing
          const fixPrompt = MANIM_ERROR_FIX_PROMPT.replace(
            "{error}",
            lastError
          ).replace("{code}", currentCode);

          const result = await this.genai.models.generateContentInternal({
            model: this.modelConfig.model,
            generationConfig: this.modelConfig.generationConfig,
            contents: [{ parts: [{ text: fixPrompt }] }],
          });
          fixedCode = this.extractPythonCode(result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "");
        }

        // Test the fixed code
        const testResult = await this.testManimCode(fixedCode);

        if (testResult.success) {
          console.log(`Code fixed successfully after ${attempts + 1} attempts`);

          // Add successful fix to context
          this.addSessionContext(sessionId, "code", {
            code: fixedCode,
            success: true,
          });

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
        } else {
          currentCode = fixedCode;
          lastError = testResult.error;
          attempts++;

          // Add failed attempt to context
          this.addSessionContext(sessionId, "code", {
            code: fixedCode,
            success: false,
            error: testResult.error,
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
      sessionId: sessionId,
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
        error: error.message,
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

    // If no code blocks, assume the entire response is code
    // Debug logging to check for uniqueness
    console.log("Generated code length:", text.trim().length);
    console.log("Code preview:", text.trim().substring(0, 100) + "...");
    return text.trim();
  }

  async savePythonFile(code, filename = "animation.py") {
    const tempDir = process.env.TEMP_DIR || "temp";
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
        const animationOutputDir =
          outputDir || process.env.ANIMATION_OUTPUT_DIR || "public/animations";
        const fullOutputDir = path.join(process.cwd(), animationOutputDir);

        // Ensure output directory exists
        if (!fs.existsSync(fullOutputDir)) {
          fs.mkdirSync(fullOutputDir, { recursive: true });
        } // Extract class name from Python file for output filename
        const fileContent = fs.readFileSync(pythonFilePath, "utf8");
        console.log(
          "File content preview:",
          fileContent.substring(0, 200) + "..."
        );

        const classMatch = fileContent.match(/class\s+(\w+)\s*\(/);
        const className = classMatch ? classMatch[1] : "Animation";

        console.log("Extracted class name:", className);
        console.log("Class match result:", classMatch);

        if (!classMatch) {
          console.error("No class found in file! Full content:", fileContent);
          throw new Error("No valid Manim Scene class found in generated code");
        } // Clean media directory before rendering to avoid confusion
        await this.cleanupMediaFolder();

        // Use a more reliable Manim command with specific output settings
        const timestamp = Date.now();

        // Try different Manim command variations for better compatibility
        const commands = [
          `manim -pql "${pythonFilePath}" ${className}`,
          `manim -p -ql "${pythonFilePath}" ${className}`,
          `python -m manim -pql "${pythonFilePath}" ${className}`,
          `manim "${pythonFilePath}" ${className} -pql`,
        ];

        let command = commands[attempts] || commands[0];
        console.log(
          `Executing Manim command (attempt ${attempts + 1}/${maxRetries}):`,
          command
        );

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
        const hasErrors =
          stderr &&
          (stderr.includes("ERROR") ||
            stderr.includes("Exception") ||
            stderr.includes("Traceback") ||
            stderr.includes("failed") ||
            stderr.includes("could not"));

        if (hasErrors && !stdout.includes("100%")) {
          throw new Error(`Manim rendering error: ${stderr}`);
        }
        // Look for the generated video with improved search strategy
        let foundVideoPath = null;

        // Wait a moment for file system to update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Primary search: Look in standard Manim output locations
        const baseFileName = path.basename(pythonFilePath, ".py");
        const mediaDir = path.join(process.cwd(), "media");

        if (fs.existsSync(mediaDir)) {
          console.log("Searching for video in media directory...");
          foundVideoPath = this.findVideoInMediaDir(
            mediaDir,
            className,
            baseFileName
          );
        }

        // Secondary search: Look for any recent MP4 file
        if (!foundVideoPath) {
          console.log("Searching for latest MP4 file...");
          foundVideoPath = this.findLatestMP4File(process.cwd());
        }

        // Tertiary search: Check current directory for common patterns
        if (!foundVideoPath) {
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

        if (!foundVideoPath) {
          // Enhanced debugging output
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
              console.log(
                `  VIDEO: ${file} (${stat.size} bytes, ${stat.mtime})`
              );
            } else if (stat.isFile()) {
              console.log(`  FILE: ${file} (${stat.size} bytes)`);
            } else {
              console.log(`  DIR:  ${file}/`);
            }
          });

          if (fs.existsSync(mediaDir)) {
            console.log("\nMedia directory structure:");
            this.listDirectoryRecursive(mediaDir);
          } else {
            console.log("\nNo media directory found");
          }

          console.log("=== END DEBUGGING ===\n");
          throw new Error(
            `No video file was generated by Manim. Class: ${className}, Base: ${baseFileName}`
          );
        }

        // Move/copy video to output directory
        const finalVideoName = `${className}_${timestamp}.mp4`;
        const finalVideoPath = path.join(fullOutputDir, finalVideoName);

        if (foundVideoPath !== finalVideoPath) {
          fs.copyFileSync(foundVideoPath, finalVideoPath);
          console.log(
            `Copied video from ${foundVideoPath} to ${finalVideoPath}`
          );

          // Clean up the original file
          try {
            fs.unlinkSync(foundVideoPath);
          } catch (cleanupError) {
            console.warn(
              "Could not clean up original video file:",
              cleanupError.message
            );
          }
        }

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
          console.log(
            `Retrying rendering in 2 seconds... (${attempts}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    throw new Error(
      `Failed to render animation after ${maxRetries} attempts: ${lastError.message}`
    );
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
      }

      // Save the (possibly fixed) code
      const timestamp = Date.now();
      const filename = `animation_${timestamp}.py`;
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
          }

          // Try rendering the improved code
          const improvedFilePath = await this.savePythonFile(
            improvedCode,
            `improved_${filename}`
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
        console.log("Cleaning up media folder...");

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
        console.log("Media folder cleaned up successfully");
      }
    } catch (error) {
      console.warn("Failed to cleanup media folder:", error.message);
    }
  }

  async cleanupTempFiles() {
    try {
      const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || "temp");

      if (fs.existsSync(tempDir)) {
        console.log("Cleaning up temporary files...");

        const files = fs.readdirSync(tempDir);
        let cleanedCount = 0;

        files.forEach((file) => {
          try {
            const filePath = path.join(tempDir, file);
            const stat = fs.statSync(filePath);

            // Clean up files older than 1 hour
            const oneHourAgo = Date.now() - 60 * 60 * 1000;

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
      console.warn("Failed to cleanup temporary files:", error.message);
    }
  }

  async checkManimInstallation() {
    try {
      const { stdout } = await execAsync("manim --version");
      return {
        installed: true,
        version: stdout.trim(),
      };
    } catch (error) {
      return {
        installed: false,
        error: error.message,
      };
    }
  }

  async checkFFmpegInstallation() {
    try {
      const { stdout } = await execAsync("ffmpeg -version");
      const versionLine = stdout.split("\n")[0];
      return {
        installed: true,
        version: versionLine.trim(),
      };
    } catch (error) {
      return {
        installed: false,
        error: error.message,
      };
    }
  }

  async checkSystemRequirements() {
    const manim = await this.checkManimInstallation();
    const ffmpeg = await this.checkFFmpegInstallation();

    return {
      manim,
      ffmpeg,
      allRequirementsMet: manim.installed && ffmpeg.installed,
    };
  }

  /**
   * Find the most recently created MP4 file in a directory and subdirectories
   */
  findLatestMP4File(searchDir) {
    let latestFile = null;
    let latestTime = 0;

    const searchRecursive = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            searchRecursive(itemPath);
          } else if (item.endsWith(".mp4")) {
            if (stat.mtime.getTime() > latestTime) {
              latestTime = stat.mtime.getTime();
              latestFile = itemPath;
            }
          }
        }
      } catch (error) {
        console.warn(`Could not search directory ${dir}:`, error.message);
      }
    };

    searchRecursive(searchDir);
    return latestFile;
  }

  /**
   * Find video file in media directory with various naming patterns
   */
  findVideoInMediaDir(mediaDir, className, baseFileName) {
    const possiblePaths = [
      // Standard Manim output structure: media/videos/filename/quality/ClassName.mp4
      path.join(mediaDir, "videos", baseFileName, "480p15", `${className}.mp4`),
      path.join(mediaDir, "videos", baseFileName, "720p30", `${className}.mp4`),
      path.join(
        mediaDir,
        "videos",
        baseFileName,
        "1080p60",
        `${className}.mp4`
      ),
      path.join(
        mediaDir,
        "videos",
        baseFileName,
        "low_quality",
        `${className}.mp4`
      ),
      path.join(
        mediaDir,
        "videos",
        baseFileName,
        "medium_quality",
        `${className}.mp4`
      ),
      path.join(
        mediaDir,
        "videos",
        baseFileName,
        "high_quality",
        `${className}.mp4`
      ),
      // Alternative patterns
      path.join(mediaDir, "videos", `${className}.mp4`),
      path.join(mediaDir, `${className}.mp4`),
      path.join(mediaDir, `${baseFileName}.mp4`),
    ];

    for (const videoPath of possiblePaths) {
      if (fs.existsSync(videoPath)) {
        console.log(`Found video in media directory: ${videoPath}`);
        return videoPath;
      }
    }

    // If standard paths don't work, search recursively
    return this.findLatestMP4File(mediaDir);
  }

  /**
   * List directory contents recursively for debugging
   */
  listDirectoryRecursive(dir, prefix = "") {
    try {
      const items = fs.readdirSync(dir);
      items.forEach((item) => {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          console.log(`${prefix}📁 ${item}/`);
          this.listDirectoryRecursive(itemPath, prefix + "  ");
        } else {
          console.log(`${prefix}📄 ${item} (${stat.size} bytes)`);
        }
      });
    } catch (error) {
      console.warn(`Could not list directory ${dir}:`, error.message);
    }
  }
}

export default ManimAgent;
