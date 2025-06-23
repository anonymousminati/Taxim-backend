import express from 'express';
import ManimAgent from '../services/manimAgent.js';
import { validatePrompt, validateCode, logRequest, asyncHandler } from '../middleware/validation.js';
import { cleanupOldFiles, ensureDirectoryExists } from '../utils/fileUtils.js';

const router = express.Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Generate Manim animation with session support
router.post('/generate', validatePrompt, async (req, res) => {
    const agent = new ManimAgent();
    
    try {
        const { prompt, sessionId = 'default', userPreferences = {} } = req.body;

        console.log(`Generating Manim code for session ${sessionId}, prompt:`, prompt);

        // Set user preferences if provided
        if (Object.keys(userPreferences).length > 0) {
            Object.entries(userPreferences).forEach(([key, value]) => {
                agent.setUserPreference(sessionId, key, value);
            });
        }

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

        return res.json({
            success: true,
            code: renderResult.code,
            videoPath: renderResult.videoPath,
            videoFileName: renderResult.videoFileName,
            message: 'Animation generated successfully',
            sessionId: sessionId,
            sessionInfo: agent.getSessionInfo(sessionId),
            metadata: {
                generationAttempts: generationResult.attempts,
                wasCodeFixed: generationResult.wasFixed || renderResult.wasCodeFixed,
                wasImproved: renderResult.wasImproved || false,
                renderingAttempts: renderResult.attempts
            }
        });

    } catch (error) {
        console.error('Error in Manim generation:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Check Manim installation status
router.get('/status', async (req, res) => {
    try {
        const agent = new ManimAgent();
        const systemCheck = await agent.checkSystemRequirements();
        
        return res.json({
            success: true,
            requirements: systemCheck,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                tempDir: process.env.TEMP_DIR || 'temp',
                outputDir: process.env.ANIMATION_OUTPUT_DIR || 'public/animations'
            },
            recommendations: systemCheck.allRequirementsMet ? [] : [
                !systemCheck.manim.installed && 'Install Manim: pip install manim',
                !systemCheck.ffmpeg.installed && 'Install FFmpeg: See installation guide'
            ].filter(Boolean)
        });
    } catch (error) {
        console.error('Error checking status:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Validate Manim code
router.post('/validate', validateCode, async (req, res) => {
    try {
        const { code } = req.body;

        const agent = new ManimAgent();
        const isValid = agent.isValidManimCode(code);
        
        return res.json({
            success: true,
            valid: isValid,
            message: isValid ? 'Code is valid Manim code' : 'Code is not valid Manim code'
        });
    } catch (error) {
        console.error('Error validating code:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Render existing Manim code with session support
router.post('/render', validateCode, async (req, res) => {
    const agent = new ManimAgent();
    
    try {
        const { code, sessionId = 'default' } = req.body;

        console.log(`Rendering provided Manim code for session ${sessionId}`);

        // Render animation with session context and error handling
        const renderResult = await agent.renderAnimationWithErrorHandling(code, sessionId, 3);

        console.log('Custom animation rendered successfully:', renderResult.videoPath);

        return res.json({
            success: true,
            videoPath: renderResult.videoPath,
            videoFileName: renderResult.videoFileName,
            message: 'Animation rendered successfully',
            code: renderResult.code, // Return the potentially fixed code
            sessionId: sessionId,
            sessionInfo: agent.getSessionInfo(sessionId),
            metadata: {
                wasCodeFixed: renderResult.wasCodeFixed || false,
                wasImproved: renderResult.wasImproved || false,
                renderingAttempts: renderResult.attempts
            }
        });

    } catch (error) {
        console.error('Error rendering animation:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Session management routes

// Get session information
router.get('/session/:sessionId', async (req, res) => {
    try {
        const agent = new ManimAgent();
        const { sessionId } = req.params;
        
        console.log(`Getting session info for: ${sessionId}`);
        
        const sessionInfo = agent.getSessionInfo(sessionId);
        
        return res.json({
            success: true,
            sessionId: sessionId,
            ...sessionInfo
        });
    } catch (error) {
        console.error('Error getting session info:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Clear session
router.delete('/session/:sessionId', async (req, res) => {
    try {
        const agent = new ManimAgent();
        const { sessionId } = req.params;
        
        console.log(`Clearing session: ${sessionId}`);
        
        const cleared = agent.clearSession(sessionId);
        
        return res.json({
            success: true,
            cleared: cleared,
            sessionId: sessionId,
            message: cleared ? 'Session cleared successfully' : 'Session not found'
        });
    } catch (error) {
        console.error('Error clearing session:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Get all active sessions
router.get('/sessions', async (req, res) => {
    try {
        const agent = new ManimAgent();
        
        console.log('Getting all active sessions');
        
        const activeSessions = agent.getActiveSessions();
        
        return res.json({
            success: true,
            activeSessions: activeSessions,
            count: activeSessions.length
        });
    } catch (error) {
        console.error('Error getting active sessions:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Set user preferences for a session
router.post('/session/:sessionId/preferences', async (req, res) => {
    try {
        const agent = new ManimAgent();
        const sessionId = req.params.sessionId;
        const { preferences } = req.body;
        
        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({
                error: 'Preferences object is required',
                success: false
            });
        }
        
        Object.entries(preferences).forEach(([key, value]) => {
            agent.setUserPreference(sessionId, key, value);
        });
        
        return res.json({
            success: true,
            sessionId: sessionId,
            preferences: preferences,
            sessionInfo: agent.getSessionInfo(sessionId),
            message: 'Preferences updated successfully'
        });
    } catch (error) {
        console.error('Error setting preferences:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

// Improve existing code with session context
router.post('/improve', validateCode, async (req, res) => {
    try {
        const agent = new ManimAgent();
        const { code, feedback, sessionId = 'default' } = req.body;
        
        if (!feedback || typeof feedback !== 'string') {
            return res.status(400).json({
                error: 'Feedback string is required',
                success: false
            });
        }
        
        console.log(`Improving code for session ${sessionId} with feedback:`, feedback);
        
        const improvedCode = await agent.improveManimCode(code, feedback, sessionId);
        
        return res.json({
            success: true,
            code: improvedCode,
            originalCode: code,
            feedback: feedback,
            sessionId: sessionId,
            sessionInfo: agent.getSessionInfo(sessionId),
            message: 'Code improved successfully'
        });
    } catch (error) {
        console.error('Error improving code:', error);
        
        return res.status(500).json({
            error: error.message,
            success: false
        });
    }
});

export default router;
