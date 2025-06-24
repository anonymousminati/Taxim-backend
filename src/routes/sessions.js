/**
 * Session management routes for ManimAgent
 */

import express from 'express';
import { getManimAgent } from '../services/agentManager.js';
import { logRequest, asyncHandler } from '../middleware/validation.js';

const router = express.Router();

// Apply logging middleware
router.use(logRequest);

// Get session information
router.get('/session/:sessionId?', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    const sessionId = req.params.sessionId || 'default';
    
    const sessionInfo = agent.getSessionInfo(sessionId);
    
    res.json({
        success: true,
        sessionInfo,
        sessionId
    });
}));

// Get all active sessions
router.get('/sessions', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    const activeSessions = agent.getActiveSessions();
    
    res.json({
        success: true,
        activeSessions,
        count: activeSessions.length
    });
}));

// Clear a specific session
router.delete('/session/:sessionId', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    const { sessionId } = req.params;
    
    const cleared = agent.clearSession(sessionId);
    
    res.json({
        success: true,
        cleared,
        sessionId,
        message: cleared ? 'Session cleared successfully' : 'Session not found'
    });
}));

// Set user preference for a session
router.post('/session/:sessionId/preference', asyncHandler(async (req, res) => {
    const agent = getManimAgent();
    const { sessionId } = req.params;
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Both key and value are required'
        });
    }
    
    agent.setUserPreference(sessionId, key, value);
    
    res.json({
        success: true,
        sessionId,
        preference: { key, value },
        message: 'Preference set successfully'
    });
}));

export default router;
