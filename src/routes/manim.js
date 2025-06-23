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

        // Generate Manim code
        const manimCode = await agent.generateManimCode(prompt);
        
        // Validate the generated code
        if (!agent.isValidManimCode(manimCode)) {
            return res.status(400).json({ 
                error: 'Generated code is not valid Manim code',
                code: manimCode,
                success: false
            });
        }

        console.log('Generated valid Manim code');

        // Save Python file
        const timestamp = Date.now();
        const filename = `animation_${timestamp}.py`;
        const filePath = await agent.savePythonFile(manimCode, filename);

        console.log('Saved Python file:', filePath);

        // Render animation
        const renderResult = await agent.renderAnimation(filePath);

        console.log('Animation rendered successfully:', renderResult.videoPath);

        // Cleanup Python file
        await agent.cleanup(filePath);

        return res.json({
            success: true,
            code: manimCode,
            videoPath: renderResult.videoPath,
            videoFileName: renderResult.videoFileName,
            message: 'Animation generated successfully'
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

        // Validate the code
        if (!agent.isValidManimCode(code)) {
            return res.status(400).json({ 
                error: 'Provided code is not valid Manim code',
                success: false
            });
        }

        console.log('Rendering provided Manim code');

        // Save Python file
        const timestamp = Date.now();
        const filename = `custom_animation_${timestamp}.py`;
        const filePath = await agent.savePythonFile(code, filename);

        console.log('Saved custom Python file:', filePath);

        // Render animation
        const renderResult = await agent.renderAnimation(filePath);

        console.log('Custom animation rendered successfully:', renderResult.videoPath);

        // Cleanup Python file
        await agent.cleanup(filePath);

        return res.json({
            success: true,
            videoPath: renderResult.videoPath,
            videoFileName: renderResult.videoFileName,
            message: 'Animation rendered successfully'
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
