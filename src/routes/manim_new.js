import express from 'express';
import { getManimAgent } from '../services/agentManager.js';
import { logRequest, asyncHandler } from '../middleware/validation.js';
import sessionRoutes from './sessions.js';
import renderRoutes from './render.js';

const router = express.Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Mount modular route handlers
router.use('/sessions', sessionRoutes);
router.use('/render', renderRoutes);

// Legacy generate endpoint (forwards to render routes)
router.use('/generate', renderRoutes);

// System health and requirements check
router.get('/health', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    
    const requirements = await agent.checkSystemRequirements();
    const activeSessions = agent.getActiveSessions();
    
    res.json({
        success: true,
        status: 'healthy',
        requirements,
        sessions: {
            active: activeSessions.length,
            max: agent.maxSessions
        },
        timestamp: new Date().toISOString()
    });
}));

// Legacy compatibility routes (redirected to modular handlers)
router.get('/session/:sessionId?', (req, res, next) => {
    req.url = `/sessions/session/${req.params.sessionId || ''}`;
    sessionRoutes(req, res, next);
});

router.delete('/session/:sessionId', (req, res, next) => {
    req.url = `/sessions/session/${req.params.sessionId}`;
    sessionRoutes(req, res, next);
});

router.post('/session/:sessionId/preference', (req, res, next) => {
    req.url = `/sessions/session/${req.params.sessionId}/preference`;
    sessionRoutes(req, res, next);
});

router.post('/render', (req, res, next) => {
    req.url = '/render/render';
    renderRoutes(req, res, next);
});

router.post('/improve', (req, res, next) => {
    req.url = '/render/improve';
    renderRoutes(req, res, next);
});

// Test generation only (no rendering)
router.post('/test', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    const { prompt, sessionId = 'default' } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Prompt is required'
        });
    }

    console.log(`Testing Manim code generation for session ${sessionId}, prompt:`, prompt);

    const code = await agent.generateManimCode(prompt, sessionId);
    const isValid = agent.isValidManimCode(code);

    res.json({
        success: true,
        code,
        isValid,
        message: 'Code generated and tested successfully',
        sessionId: sessionId,
        sessionInfo: agent.getSessionInfo(sessionId)
    });
}));

// Check system requirements
router.get('/requirements', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    const requirements = await agent.checkSystemRequirements();
    
    res.json({
        success: true,
        requirements,
        message: 'System requirements checked successfully'
    });
}));

export default router;
