import ManimAgent from './src/services/manimAgent.js';

async function testSystemRequirements() {
    console.log('Testing system requirements...\n');
    
    try {
        const agent = new ManimAgent();
        const requirements = await agent.checkSystemRequirements();
        
        console.log('=== SYSTEM REQUIREMENTS CHECK ===');
        console.log('\n📹 Manim:');
        console.log('- Installed:', requirements.manim.installed ? '✅' : '❌');
        if (requirements.manim.installed) {
            console.log('- Version:', requirements.manim.version);
        } else {
            console.log('- Error:', requirements.manim.error);
        }
        
        console.log('\n🎬 FFmpeg:');
        console.log('- Installed:', requirements.ffmpeg.installed ? '✅' : '❌');
        if (requirements.ffmpeg.installed) {
            console.log('- Version:', requirements.ffmpeg.version);
        } else {
            console.log('- Error:', requirements.ffmpeg.error);
        }
        
        console.log('\n📄 LaTeX:');
        console.log('- Installed:', requirements.latex.installed ? '✅' : '❌');
        if (requirements.latex.installed) {
            console.log('- Version:', requirements.latex.version);
        } else {
            console.log('- Error:', requirements.latex.error);
        }
        
        console.log('\n🔧 Overall Status:');
        console.log('- All requirements met:', requirements.allRequirementsMet ? '✅' : '❌');
        
        if (!requirements.allRequirementsMet) {
            console.log('\n⚠️  Missing requirements detected. Some features may not work properly.');
        } else {
            console.log('\n🎉 All requirements are satisfied! Full functionality available.');
        }
        
    } catch (error) {
        console.error('Error checking system requirements:', error.message);
    }
}

testSystemRequirements();
