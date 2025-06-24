import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkManimInstallation() {
    try {
        const { stdout } = await execAsync("manim --version");
        return {
            installed: true,
            version: stdout.trim(),
        };
    } catch (error) {
        return {
            installed: false,
            error: error.message,
        };
    }
}

async function checkFFmpegInstallation() {
    try {
        const { stdout } = await execAsync("ffmpeg -version");
        const versionLine = stdout.split("\n")[0];
        return {
            installed: true,
            version: versionLine.trim(),
        };
    } catch (error) {
        return {
            installed: false,
            error: error.message,
        };
    }
}

async function checkLatexInstallation() {
    try {
        const { stdout } = await execAsync("pdflatex --version");
        return {
            installed: true,
            version: stdout.split('\n')[0].trim()
        };
    } catch (error) {
        return {
            installed: false,
            error: error.message
        };
    }
}

async function testSystemRequirements() {
    console.log('Testing system requirements...\n');
    
    try {
        const manim = await checkManimInstallation();
        const ffmpeg = await checkFFmpegInstallation();
        const latex = await checkLatexInstallation();
        
        console.log('=== SYSTEM REQUIREMENTS CHECK ===');
        console.log('\n📹 Manim:');
        console.log('- Installed:', manim.installed ? '✅' : '❌');
        if (manim.installed) {
            console.log('- Version:', manim.version);
        } else {
            console.log('- Error:', manim.error);
        }
        
        console.log('\n🎬 FFmpeg:');
        console.log('- Installed:', ffmpeg.installed ? '✅' : '❌');
        if (ffmpeg.installed) {
            console.log('- Version:', ffmpeg.version);
        } else {
            console.log('- Error:', ffmpeg.error);
        }
        
        console.log('\n📄 LaTeX:');
        console.log('- Installed:', latex.installed ? '✅' : '❌');
        if (latex.installed) {
            console.log('- Version:', latex.version);
        } else {
            console.log('- Error:', latex.error);
        }
        
        const allRequirementsMet = manim.installed && ffmpeg.installed && latex.installed;
        
        console.log('\n🔧 Overall Status:');
        console.log('- All requirements met:', allRequirementsMet ? '✅' : '❌');
        
        if (!allRequirementsMet) {
            console.log('\n⚠️  Missing requirements detected. Some features may not work properly.');
            if (!manim.installed) console.log('   - Install Manim: pip install manim');
            if (!ffmpeg.installed) console.log('   - Install FFmpeg: https://ffmpeg.org/download.html');
            if (!latex.installed) console.log('   - Install LaTeX: MiKTeX or TeX Live');
        } else {
            console.log('\n🎉 All requirements are satisfied! Full functionality available.');
        }
        
    } catch (error) {
        console.error('Error checking system requirements:', error.message);
    }
}

testSystemRequirements();
