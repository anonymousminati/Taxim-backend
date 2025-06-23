import axios from 'axios';

async function testSimpleAnimation() {
    const apiUrl = 'http://localhost:3001/api/manim/generate';
    
    const testPayload = {
        prompt: "Create a simple red circle that moves to the right",
        sessionId: `test-simple-${Date.now()}`
    };
    
    console.log('Testing simple animation (no LaTeX required):', testPayload.prompt);
    
    try {
        const startTime = Date.now();
        const response = await axios.post(apiUrl, testPayload, {
            timeout: 120000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        const duration = Date.now() - startTime;
        
        console.log('\n✅ SUCCESS!');
        console.log('Duration:', duration + 'ms');
        console.log('Response status:', response.status);
        
        if (response.data.success) {
            console.log('🎉 Animation generated successfully!');
            console.log('Video path:', response.data.videoPath);
            console.log('Code length:', response.data.code ? response.data.code.length : 'N/A');
            console.log('\nGenerated code preview:');
            console.log(response.data.code.substring(0, 300) + '...');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data.error);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testSimpleAnimation();
