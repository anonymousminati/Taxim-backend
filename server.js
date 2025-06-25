import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Import routes
import manimRoutes from './src/routes/manim.js';

// Import startup services
import { initializeDirectories, startCleanupScheduler, performInitialCleanup } from './src/services/startup.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        success: false
    }
});

app.use(limiter);

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*', // Allow all origins by default
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (animations)
const animationDir = process.env.ANIMATION_OUTPUT_DIR || 'public/animations';
const fullAnimationPath = path.join(process.cwd(), animationDir);

// Ensure animation directory exists
if (!fs.existsSync(fullAnimationPath)) {
    fs.mkdirSync(fullAnimationPath, { recursive: true });
}

app.use('/animations', express.static(fullAnimationPath));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Taxim Backend API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.use('/api/manim', manimRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        success: false,
        availableRoutes: [
            'GET /health',
            'GET /api/manim/status',
            'POST /api/manim/generate',
            'POST /api/manim/validate',
            'POST /api/manim/render'
        ]
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    res.status(error.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        success: false,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Taxim Backend Server running on port ${PORT}`);
    console.log(`📁 Animation output directory: ${fullAnimationPath}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🎨 Manim API: http://localhost:${PORT}/api/manim`);
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`🌐 CORS enabled for: ${corsOptions.origin}`);
    }
    
    // Initialize directories and cleanup
    initializeDirectories();
    performInitialCleanup();
    startCleanupScheduler();
});

export default app;
