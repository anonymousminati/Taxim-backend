import fs from 'fs';
import path from 'path';

export const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
};

export const cleanupOldFiles = (directory, maxAgeHours = 24) => {
    try {
        if (!fs.existsSync(directory)) return;

        const files = fs.readdirSync(directory);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

        files.forEach(file => {
            const filePath = path.join(directory, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up old file: ${filePath}`);
            }
        });
    } catch (error) {
        console.warn('Error during cleanup:', error.message);
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
