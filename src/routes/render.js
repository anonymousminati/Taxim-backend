/**
 * Rendering and generation routes for ManimAgent
 */

import express from 'express';
import { getManimAgent } from '../services/agentManager.js';
import { validatePrompt, validateCode, logRequest, asyncHandler } from '../middleware/validation.js';

const router = express.Router();

// Apply logging middleware
router.use(logRequest);

/**
 * Generate Manim animation with retry-on-error support
 */
router.post('/generate', validatePrompt, asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    
    const { prompt, sessionId = 'default', userPreferences = {} } = req.body;

    console.log(`Generating Manim code for session ${sessionId}, prompt:`, prompt);

    // Set user preferences if provided
    if (Object.keys(userPreferences).length > 0) {
        Object.entries(userPreferences).forEach(([key, value]) => {
            agent.setUserPreference(sessionId, key, value);
        });
    }

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    // Retry generation with error handling
    while (attempts < maxAttempts) {
        try {
            // Generate Manim code with session context and error handling
            const generationResult = await agent.generateAndFixManimCode(prompt, sessionId, 3);
            
            console.log('Generated code result:', {
                success: generationResult.success,
                attempts: generationResult.attempts,
                wasFixed: generationResult.wasFixed,
                sessionId: generationResult.sessionId
            });

            // Render animation with session context and error handling
            const renderResult = await agent.renderAnimationWithErrorHandling(generationResult.code, sessionId, 3);

            console.log('Animation rendered successfully:', renderResult.videoPath);

            result = {
                success: true,
                code: renderResult.code,
                videoPath: renderResult.videoPath,
                videoFileName: renderResult.videoFileName,
                message: 'Animation generated successfully',
                sessionId: sessionId,
                sessionInfo: agent.getSessionInfo(sessionId),
                metadata: {
                    generationAttempts: generationResult.attempts,
                    wasCodeFixed: renderResult.wasCodeFixed,
                    wasImproved: renderResult.wasImproved || false,
                    renderAttempts: renderResult.attempts
                }
            };
            break; // Success, exit retry loop

        } catch (error) {
            attempts++;
            console.error(`Generation attempt ${attempts} failed:`, error.message);

            if (attempts >= maxAttempts) {
                // If all attempts failed, try to improve the code and return a simple variant
                try {
                    console.log('All generation attempts failed, trying code improvement...');
                    const simpleCode = await agent.improveManimCode(
                        'from manim import *\n\nclass SimpleAnimation(Scene):\n    def construct(self):\n        circle = Circle()\n        self.play(Create(circle))\n        self.wait(1)',
                        `Generate a simple animation for: ${prompt}`,
                        sessionId
                    );
                    
                    const fallbackResult = await agent.renderAnimationWithErrorHandling(simpleCode, sessionId, 1);
                    
                    result = {
                        success: true,
                        code: fallbackResult.code,
                        videoPath: fallbackResult.videoPath,
                        videoFileName: fallbackResult.videoFileName,
                        message: 'Generated fallback animation after errors',
                        sessionId: sessionId,
                        sessionInfo: agent.getSessionInfo(sessionId),
                        warning: 'Original generation failed, this is a simplified version',
                        metadata: {
                            usedFallback: true,
                            originalError: error.message
                        }
                    };
                    break;
                } catch (fallbackError) {
                    console.error('Even fallback generation failed:', fallbackError.message);
                    throw error; // Throw original error
                }
            } else {
                console.log(`Retrying in 2 seconds... (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    res.json(result);
}));

/**
 * Render existing code
 */
router.post('/render', validateCode, asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    
    const { code, sessionId = 'default' } = req.body;

    console.log(`Rendering Manim code for session ${sessionId}`);

    const renderResult = await agent.renderAnimationWithErrorHandling(code, sessionId, 3);

    console.log('Animation rendered successfully:', renderResult.videoPath);

    res.json({
        success: true,
        code: renderResult.code,
        videoPath: renderResult.videoPath,
        videoFileName: renderResult.videoFileName,
        message: 'Animation rendered successfully',
        sessionId: sessionId,
        sessionInfo: agent.getSessionInfo(sessionId),
        metadata: {
            wasCodeFixed: renderResult.wasCodeFixed,
            wasImproved: renderResult.wasImproved || false,
            renderAttempts: renderResult.attempts
        }
    });
}));

/**
 * Improve existing code
 */
router.post('/improve', validateCode, asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    
    const { code, feedback, sessionId = 'default' } = req.body;

    if (!feedback) {
        return res.status(400).json({
            success: false,
            error: 'Feedback is required for code improvement'
        });
    }

    console.log(`Improving Manim code for session ${sessionId}, feedback:`, feedback);

    const improvedCode = await agent.improveManimCode(code, feedback, sessionId);

    res.json({
        success: true,
        originalCode: code,
        improvedCode,
        feedback,
        sessionId: sessionId,
        sessionInfo: agent.getSessionInfo(sessionId),
        message: 'Code improved successfully'
    });
}));

export default router;
