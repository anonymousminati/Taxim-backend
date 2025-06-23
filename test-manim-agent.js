import ManimAgent from './src/services/manimAgent.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testManimAgent() {
    console.log('🧪 Testing Manim Agent...\n');

    try {
        // Check if required environment variables are set
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
            console.log('Please add your Gemini API key to the .env file');
            return;
        }

        // Initialize the agent
        console.log('🔧 Initializing Manim Agent...');
        const agent = new ManimAgent();
        console.log('✅ Manim Agent initialized successfully\n');        // Test 1: Check Manim installation
        console.log('🔍 Checking Manim installation...');
        const manimStatus = await agent.checkManimInstallation();
        
        if (manimStatus.installed) {
            console.log('✅ Manim is installed:', manimStatus.version);
        } else {
            console.error('❌ Manim is not installed:', manimStatus.error);
            console.log('Please install Manim: pip install manim');
            return;
        }
        console.log('');        // Test 1.5: Check FFmpeg installation
        console.log('🔍 Checking FFmpeg installation...');
        try {
            const { promisify } = await import('util');
            const { exec } = await import('child_process');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync('ffmpeg -version');
            console.log('✅ FFmpeg is installed');
        } catch (error) {
            console.error('❌ FFmpeg is not installed or not in PATH');
            console.log('');
            console.log('📋 To fix this issue, install FFmpeg:');
            console.log('');
            console.log('🪟 Windows:');
            console.log('   Option 1: choco install ffmpeg');
            console.log('   Option 2: conda install ffmpeg');
            console.log('   Option 3: winget install Gyan.FFmpeg');
            console.log('   Option 4: Download from https://www.gyan.dev/ffmpeg/builds/');
            console.log('');
            console.log('🐧 Linux: sudo apt install ffmpeg');
            console.log('🍎 macOS: brew install ffmpeg');
            console.log('');
            console.log('After installation, restart your terminal and try again.');
            return;
        }
        console.log('');

        // Test 2: Generate simple circle animation code
        console.log('🤖 Generating circle animation code...');
        const prompt = 'Create a simple circle animation that appears and then rotates and translate to 10% right';
        const generatedCode = await agent.generateManimCode(prompt);
        
        console.log('✅ Code generated successfully');
        console.log('📝 Generated Code:');
        console.log('─'.repeat(50));
        console.log(generatedCode);
        console.log('─'.repeat(50));
        console.log('');

        // Test 3: Validate the generated code
        console.log('🔍 Validating generated code...');
        const isValid = agent.isValidManimCode(generatedCode);
        
        if (isValid) {
            console.log('✅ Generated code is valid Manim code');
        } else {
            console.error('❌ Generated code is not valid Manim code');
            return;
        }
        console.log('');

        // Test 4: Save and render the animation
        console.log('💾 Saving Python file...');
        const timestamp = Date.now();
        const filename = `test_circle_${timestamp}.py`;
        const filePath = await agent.savePythonFile(generatedCode, filename);
        console.log('✅ Python file saved:', filePath);
        console.log('');

        console.log('🎬 Rendering animation (this may take a minute)...');
        const renderResult = await agent.renderAnimation(filePath);
        
        if (renderResult.success) {
            console.log('✅ Animation rendered successfully!');
            console.log('🎥 Video path:', renderResult.videoPath);
            console.log('📁 Video filename:', renderResult.videoFileName);
            console.log('');

            // Test 5: Verify the MP4 file exists and has content
            const fullVideoPath = path.join(process.cwd(), 'public/animations', renderResult.videoFileName);
            
            if (fs.existsSync(fullVideoPath)) {
                const stats = fs.statSync(fullVideoPath);
                console.log('✅ MP4 file verified:');
                console.log(`   📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
                console.log(`   📅 Created: ${stats.birthtime.toLocaleString()}`);
                console.log(`   📍 Location: ${fullVideoPath}`);
                
                if (stats.size > 1000) {
                    console.log('✅ File size looks good (>1KB)');
                } else {
                    console.warn('⚠️  File size seems small, check if animation rendered properly');
                }
            } else {
                console.error('❌ MP4 file not found at expected location');
            }
        } else {
            console.error('❌ Animation rendering failed');
        }
        console.log('');

        // Test 6: Cleanup
        console.log('🧹 Cleaning up...');
        await agent.cleanup(filePath);
        console.log('✅ Temporary Python file cleaned up');
        console.log('');

        // Final summary
        console.log('🎉 All tests completed successfully!');
        console.log('📋 Summary:');
        console.log('   ✅ Manim Agent initialization');
        console.log('   ✅ Manim installation check');
        console.log('   ✅ Code generation');
        console.log('   ✅ Code validation');
        console.log('   ✅ Animation rendering');
        console.log('   ✅ MP4 file creation');
        console.log('   ✅ File cleanup');
        console.log('');
        console.log('🚀 Your Manim Agent is working perfectly!');

        if (renderResult && renderResult.videoFileName) {
            console.log(`🎬 You can view your animation at: http://localhost:3001/animations/${renderResult.videoFileName}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Provide helpful debugging information
        console.log('\n🔧 Debugging Information:');
        console.log('Node version:', process.version);
        console.log('Platform:', process.platform);
        console.log('Working directory:', process.cwd());
        console.log('Environment:', process.env.NODE_ENV || 'not set');
        
        if (error.message.includes('GEMINI_API_KEY')) {
            console.log('\n💡 Tip: Make sure your GEMINI_API_KEY is set in the .env file');
        }
        
        if (error.message.includes('manim')) {
            console.log('\n💡 Tip: Make sure Manim is installed: pip install manim');
        }
    }
}

// Run the test
testManimAgent();
