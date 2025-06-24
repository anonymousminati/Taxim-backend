import { cleanupOldFiles, ensureDirectoryExists } from '../utils/fileUtils.js';
import path from 'path';

/**
 * Initialize required directories asynchronously
 */
export const initializeDirectories = async () => {
    const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
    const animationDir = path.join(process.cwd(), process.env.ANIMATION_OUTPUT_DIR || 'public/animations');
    
    await ensureDirectoryExists(tempDir);
    await ensureDirectoryExists(animationDir);
    
    console.log('✅ Directories initialized successfully');
};

/**
 * Start cleanup scheduler with configurable intervals
 */
export const startCleanupScheduler = () => {
    const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
    const animationDir = path.join(process.cwd(), process.env.ANIMATION_OUTPUT_DIR || 'public/animations');
    
    // Parameterize cleanup schedule
    const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS) || 3600000; // 1 hour default
    
    setInterval(async () => {
        console.log('🧹 Starting scheduled cleanup...');
        
        try {
            // Parallelize cleanup operations
            const [tempResult, animationResult] = await Promise.all([
                cleanupOldFiles(tempDir, 1), // 1 hour for temp files
                cleanupOldFiles(animationDir, 24) // 24 hours for animations
            ]);
            
            console.log(`✅ Scheduled cleanup completed - Temp: ${tempResult.cleaned} files, Animations: ${animationResult.cleaned} files`);
        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }, cleanupInterval);
    
    console.log(`⏰ Cleanup scheduler started (runs every ${Math.round(cleanupInterval / 60000)} minutes)`);
};

/**
 * Perform initial cleanup on startup
 */
export const performInitialCleanup = async () => {
    const tempDir = path.join(process.cwd(), process.env.TEMP_DIR || 'temp');
    
    console.log('🧹 Performing initial cleanup...');
    
    try {
        // Clean any leftover temp files from previous runs
        const result = await cleanupOldFiles(tempDir, 0); // Clean all temp files
        
        console.log(`✅ Initial cleanup completed - Removed ${result.cleaned} temp files`);
    } catch (error) {
        console.error('❌ Initial cleanup failed:', error.message);
    }
};
