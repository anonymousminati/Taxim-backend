import fs from 'fs/promises';
import path from 'path';

/**
 * Ensure directory exists using async methods
 */
export const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
};

/**
 * Cleanup old files with safety limits and async methods
 */
export const cleanupOldFiles = async (directory, maxAgeHours = 24, maxFilesToDelete = 1000) => {
    try {
        // Check if directory exists
        try {
            await fs.access(directory);
        } catch {
            return { cleaned: 0, skipped: 0, error: 'Directory does not exist' };
        }

        const files = await fs.readdir(directory);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

        let cleanedCount = 0;
        let skippedCount = 0;

        for (const file of files) {
            // Safety check: don't delete too many files
            if (cleanedCount >= maxFilesToDelete) {
                console.warn(`Hit max deletion limit (${maxFilesToDelete}), stopping cleanup`);
                break;
            }

            try {
                const filePath = path.join(directory, file);
                const stats = await fs.stat(filePath);
                const fileAge = now - stats.mtime.getTime();
                const hoursOld = Math.round(fileAge / (1000 * 60 * 60));
                
                if (stats.isFile() && fileAge > maxAge) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                    console.log(`Removed ${file} (${hoursOld} hours old)`);
                } else {
                    skippedCount++;
                }
            } catch (fileError) {
                console.warn(`Failed to process file ${file}:`, fileError.message);
                skippedCount++;
            }
        }

        return { cleaned: cleanedCount, skipped: skippedCount };
    } catch (error) {
        console.warn('Error during cleanup:', error.message);
        return { cleaned: 0, skipped: 0, error: error.message };
    }
};

export const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};

export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFileExtension = (filename, allowedExtensions) => {
    const ext = path.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext);
};

export const getFileInfo = (filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return {
            exists: true,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            extension: path.extname(filePath)
        };
    } catch (error) {
        return {
            exists: false,
            error: error.message
        };
    }
};
