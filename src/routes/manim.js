import express from 'express';
import ManimAgent from '../services/manimAgent.js';
import { validatePrompt, validateCode, logRequest, asyncHandler } from '../middleware/validation.js';
import { cleanupOldFiles, ensureDirectoryExists } from '../utils/fileUtils.js';

const router = express.Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Generate Manim animation
router.post('/generate', validatePrompt, async (req, res) => {
    const agent = new ManimAgent();
    
    try {
        const { prompt } = req.body;

        console.log('Generating Manim code for prompt:', prompt);

        // Generate Manim code with error handling and automatic fixes
        const generationResult = await agent.generateAndFixManimCode(prompt, 3);
        
        console.log('Generated code result:', {
            success: generationResult.success,
            attempts: generationResult.attempts,
            wasFixed: generationResult.wasFixed
        });

        // Render animation with error handling
        const renderResult = await agent.renderAnimationWithErrorHandling(generationResult.code, 3);

        console.log('Animation rendered successfully:', renderResult.videoPath);

        return res.json({
            success: true,
            code: renderResult.code,
            videoPath: renderResult.videoPath,
            videoFileName: renderResult.videoFileName,
            message: 'Animation generated successfully',
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

// Render existing Manim code
router.post('/render', validateCode, async (req, res) => {
    const agent = new ManimAgent();
    
    try {
        const { code } = req.body;

        console.log('Rendering provided Manim code');

        // Render animation with error handling and automatic fixes
        const renderResult = await agent.renderAnimationWithErrorHandling(code, 3);

        console.log('Custom animation rendered successfully:', renderResult.videoPath);

        return res.json({
            success: true,
            videoPath: renderResult.videoPath,
            videoFileName: renderResult.videoFileName,
            message: 'Animation rendered successfully',
            code: renderResult.code, // Return the potentially fixed code
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

export default router;
