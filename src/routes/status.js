/**
 * System status and monitoring routes
 */

import express from 'express';
import { getManimAgent } from '../services/agentManager.js';
import { createBasicHealthChecker } from '../utils/monitoringUtils.js';
import { checkSystemRequirements } from '../utils/systemUtils.js';

const router = express.Router();

// Initialize health checker
const healthChecker = createBasicHealthChecker();

// Add Manim-specific health checks
healthChecker.addCheck('manim-availability', async () => {
  const requirements = await checkSystemRequirements();
  if (!requirements.manim.available) {
    throw new Error(`Manim not available: ${requirements.manim.error}`);
  }
  return {
    message: 'Manim is available',
    data: { version: requirements.manim.version }
  };
}, { critical: true, description: 'Check if Manim is installed and available' });

healthChecker.addCheck('ai-model', async () => {
  const agent = getManimAgent();
  try {
    // Test AI connection with a minimal request
    const testCode = await agent.generateManimCode('simple circle', 'health-check');
    if (!testCode || testCode.length < 10) {
      throw new Error('AI model returned invalid response');
    }
    return {
      message: 'AI model is responsive',
      data: { codeLength: testCode.length }
    };
  } catch (error) {
    throw new Error(`AI model check failed: ${error.message}`);
  }
}, { critical: true, description: 'Check AI model availability and responsiveness', timeout: 15000 });

/**
 * GET /status/health - Basic health check
 */
router.get('/health', async (req, res) => {
  try {
    const overallHealth = healthChecker.getOverallHealth();
    let statusCode = 200;
    if (overallHealth.status === 'critical') {
      statusCode = 503;
    }
    
    res.status(statusCode).json({
      status: overallHealth.status,
      message: overallHealth.message,
      timestamp: new Date().toISOString(),
      ...overallHealth
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status/detailed - Detailed health check with all checks
 */
router.get('/detailed', async (req, res) => {
  try {
    const results = await healthChecker.runAllChecks();
    const overallHealth = healthChecker.getOverallHealth();
    
    let statusCode = 200;
    if (overallHealth.status === 'critical') {
      statusCode = 503;
    }
    
    res.status(statusCode).json({
      overall: overallHealth,
      checks: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status/system - System information and requirements
 */
router.get('/system', async (req, res) => {
  try {
    const agent = getManimAgent();
    const requirements = await checkSystemRequirements();
    const agentHealth = agent.getHealthStatus();
    
    // Ensure allRequirementsMet is at the top level for frontend compatibility
    res.json({
      allRequirementsMet: requirements.allRequirementsMet,
      systemRequirements: requirements,
      agentHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      allRequirementsMet: false, // Always include this field, even on error
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status/performance - Performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const agent = getManimAgent();
    const timeRange = parseInt(req.query.timeRange) || 300000; // 5 minutes default
    const metrics = agent.getPerformanceMetrics(timeRange);
    
    res.json({
      metrics,
      timeRangeMs: timeRange,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status/sessions - Active session information
 */
router.get('/sessions', async (req, res) => {
  try {
    const agent = getManimAgent();
    const activeSessions = agent.getActiveSessions();
    
    const sessionDetails = activeSessions.map(sessionId => {
      const info = agent.getSessionInfo(sessionId);
      return {
        sessionId,
        ...info
      };
    });
    
    res.json({
      totalSessions: activeSessions.length,
      maxSessions: agent.maxSessions,
      sessions: sessionDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /status/reset-errors - Reset error tracking
 */
router.post('/reset-errors', async (req, res) => {
  try {
    const agent = getManimAgent();
    agent.resetErrorTracking();
    
    res.json({
      status: 'success',
      message: 'Error tracking has been reset',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /status/quick - Minimal health check for load balancers
 */
router.get('/quick', (req, res) => {
  // Simple check that the service is running
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /status - Default status endpoint for frontend compatibility
 */
router.get('/', async (req, res) => {
  try {
    const agent = getManimAgent();
    const requirements = await checkSystemRequirements();
    const health = agent.getHealthStatus();
    const activeSessions = agent.getActiveSessions();
    
    res.json({
      success: true,
      requirements: {
        manim: requirements.manim,
        ffmpeg: requirements.ffmpeg,
        latex: requirements.latex,
        allRequirementsMet: requirements.allRequirementsMet
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch
      },
      recommendations: requirements.allRequirementsMet ? [] : [
        ...(requirements.manim.installed ? [] : ['Install Manim Community Edition']),
        ...(requirements.ffmpeg.installed ? [] : ['Install FFmpeg']),
        ...(requirements.latex.installed ? [] : ['Install LaTeX (MiKTeX or TeX Live)'])
      ],
      status: health.system.status,
      message: 'Manim backend is running',
      activeSessions: activeSessions.length,
      maxSessions: agent.maxSessions,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      success: false,
      requirements: {
        allRequirementsMet: false
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
