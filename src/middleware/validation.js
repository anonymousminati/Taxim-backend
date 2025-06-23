export const validatePrompt = (req, res, next) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({
            success: false,
            error: 'Prompt is required'
        });
    }

    if (typeof prompt !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Prompt must be a string'
        });
    }

    if (prompt.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Prompt cannot be empty'
        });
    }

    if (prompt.length > 2000) {
        return res.status(400).json({
            success: false,
            error: 'Prompt is too long (maximum 2000 characters)'
        });
    }

    // Store cleaned prompt
    req.body.prompt = prompt.trim();
    next();
};

export const validateCode = (req, res, next) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'Code is required'
        });
    }

    if (typeof code !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Code must be a string'
        });
    }

    if (code.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Code cannot be empty'
        });
    }

    if (code.length > 50000) {
        return res.status(400).json({
            success: false,
            error: 'Code is too long (maximum 50000 characters)'
        });
    }

    // Store cleaned code
    req.body.code = code.trim();
    next();
};

export const logRequest = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const { method, url, ip } = req;
    
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
    
    // Log request body size for POST requests
    if (method === 'POST' && req.body) {
        const bodySize = JSON.stringify(req.body).length;
        console.log(`[${timestamp}] Request body size: ${bodySize} characters`);
    }
    
    next();
};

export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
