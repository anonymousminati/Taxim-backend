/**
 * Request validation middleware for Manim API
 */

/**
 * Unified error response helper
 */
export const respondBadRequest = (res, msg) =>
    res.status(400).json({ success: false, error: msg });

/**
 * Unified server error response helper
 */
export const respondServerError = (res, msg) =>
    res.status(500).json({ success: false, error: msg });

/**
 * Validate prompt parameter
 */
export const validatePrompt = (req, res, next) => {
    const { prompt } = req.body;

    if (!prompt) {
        return respondBadRequest(res, 'Prompt is required');
    }

    if (typeof prompt !== 'string') {
        return respondBadRequest(res, 'Prompt must be a string');
    }

    if (prompt.trim().length === 0) {
        return respondBadRequest(res, 'Prompt cannot be empty');
    }

    if (prompt.length > 2000) {
        return respondBadRequest(res, 'Prompt is too long (maximum 2000 characters)');
    }

    // Check for potential toxic content (basic check)
    const toxicPatterns = [
        /\b(hack|exploit|malicious|virus|malware)\b/i,
        /\b(delete|destroy|corrupt)\s+(file|system|data)\b/i
    ];
    
    if (toxicPatterns.some(pattern => pattern.test(prompt))) {
        return respondBadRequest(res, 'Prompt contains potentially harmful content');
    }

    // Store cleaned prompt
    req.body.prompt = prompt.trim();
    next();
};

/**
 * Validate code parameter
 */
export const validateCode = (req, res, next) => {
    const { code } = req.body;

    if (!code) {
        return respondBadRequest(res, 'Code is required');
    }

    if (typeof code !== 'string') {
        return respondBadRequest(res, 'Code must be a string');
    }

    if (code.trim().length === 0) {
        return respondBadRequest(res, 'Code cannot be empty');
    }

    if (code.length > 10000) {
        return respondBadRequest(res, 'Code is too long (maximum 10000 characters)');
    }

    // Store cleaned code
    req.body.code = code.trim();
    next();
};

/**
 * Validate sessionId parameter
 */
export const validateSessionId = (req, res, next) => {
    const sessionId = req.params.sessionId || req.body.sessionId || 'default';
    
    // Basic sessionId validation
    if (typeof sessionId !== 'string') {
        return respondBadRequest(res, 'Session ID must be a string');
    }
    
    if (sessionId.length > 100) {
        return respondBadRequest(res, 'Session ID too long (maximum 100 characters)');
    }
    
    // Allow alphanumeric, dash, underscore
    if (!/^[a-zA-Z0-9\-_]+$/.test(sessionId)) {
        return respondBadRequest(res, 'Session ID contains invalid characters (use only letters, numbers, dash, underscore)');
    }
    
    // Store normalized sessionId
    req.sessionId = sessionId.toLowerCase();
    next();
};

/**
 * Request logging middleware
 */
export const logRequest = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const { method, url, ip } = req;
    
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
    
    // Log body size for POST requests
    if (method === 'POST' && req.body) {
        const bodySize = JSON.stringify(req.body).length;
        console.log(`  Body size: ${bodySize} bytes`);
    }
    
    next();
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
