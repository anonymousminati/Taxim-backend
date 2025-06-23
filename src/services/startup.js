import { cleanupOldFiles, ensureDirectoryExists } from '../utils/fileUtils.js';
import path from 'path';

export const initializeDirectories = () => {
    const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
    const animationDir = path.join(process.cwd(), process.env.ANIMATION_OUTPUT_DIR || 'public/animations');
    
    ensureDirectoryExists(tempDir);
    ensureDirectoryExists(animationDir);
    
    console.log('✅ Directories initialized successfully');
};

export const startCleanupScheduler = () => {
    const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
    const animationDir = path.join(process.cwd(), process.env.ANIMATION_OUTPUT_DIR || 'public/animations');
    
    // Cleanup old files every hour
    const cleanupInterval = 60 * 60 * 1000; // 1 hour
    
    setInterval(() => {
        console.log('🧹 Starting scheduled cleanup...');
        
        // Cleanup temp files older than 1 hour
        cleanupOldFiles(tempDir, 1);
        
        // Cleanup animation files older than 24 hours
        cleanupOldFiles(animationDir, 24);
        
        console.log('✅ Scheduled cleanup completed');
    }, cleanupInterval);
    
    console.log('⏰ Cleanup scheduler started (runs every hour)');
};

export const performInitialCleanup = () => {
    const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
    
    console.log('🧹 Performing initial cleanup...');
    
    // Clean any leftover temp files from previous runs
    cleanupOldFiles(tempDir, 0); // Clean all temp files
    
    console.log('✅ Initial cleanup completed');
};
