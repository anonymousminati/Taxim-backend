import ManimAgent from './src/services/manimAgent.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testCodeGeneration() {
    console.log('🧪 Testing Manim Code Generation Only...\n');

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
        console.log('✅ Manim Agent initialized successfully\n');

        // Test: Generate simple circle animation code
        console.log('🤖 Generating circle animation code...');
        const prompt = 'Create a simple circle animation that appears and then rotates';
        const generatedCode = await agent.generateManimCode(prompt);
        
        console.log('✅ Code generated successfully');
        console.log('📝 Generated Code:');
        console.log('─'.repeat(50));
        console.log(generatedCode);
        console.log('─'.repeat(50));
        console.log('');

        // Test: Validate the generated code
        console.log('🔍 Validating generated code...');
        const isValid = agent.isValidManimCode(generatedCode);
        
        if (isValid) {
            console.log('✅ Generated code is valid Manim code');
            console.log('   ✓ Contains proper imports');
            console.log('   ✓ Has Scene class');
            console.log('   ✓ Has construct method');
        } else {
            console.error('❌ Generated code is not valid Manim code');
            console.log('Generated code:', generatedCode);
            return;
        }
        console.log('');

        // Test: Save Python file (without rendering)
        console.log('💾 Testing file save functionality...');
        const timestamp = Date.now();
        const filename = `test_code_gen_${timestamp}.py`;
        const filePath = await agent.savePythonFile(generatedCode, filename);
        console.log('✅ Python file saved:', filePath);
        
        // Clean up the test file
        await agent.cleanup(filePath);
        console.log('✅ Test file cleaned up');
        console.log('');

        // Final summary
        console.log('🎉 Code generation test completed successfully!');
        console.log('📋 Summary:');
        console.log('   ✅ Manim Agent initialization');
        console.log('   ✅ AI code generation');
        console.log('   ✅ Code validation');
        console.log('   ✅ File save/cleanup');
        console.log('');
        console.log('🚀 Your AI code generation is working perfectly!');
        console.log('');
        console.log('📌 Next step: Install FFmpeg to enable video rendering');
        console.log('   Run: conda install -c conda-forge ffmpeg');
        console.log('   Or download from: https://www.gyan.dev/ffmpeg/builds/');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // Provide helpful debugging information
        console.log('\n🔧 Debugging Information:');
        console.log('Node version:', process.version);
        console.log('Platform:', process.platform);
        console.log('Working directory:', process.cwd());
        
        if (error.message.includes('GEMINI_API_KEY')) {
            console.log('\n💡 Tip: Make sure your GEMINI_API_KEY is set in the .env file');
        }
    }
}

// Run the test
testCodeGeneration();
