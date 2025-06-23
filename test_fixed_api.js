import axios from 'axios';

async function testAPI() {
    const apiUrl = 'http://localhost:3001/api/manim/generate';
    
    const testPayload = {
        prompt: "Create a simple animation with a blue circle that moves across the screen",
        sessionId: `test-session-${Date.now()}`
    };
    
    console.log('Testing API with payload:', testPayload);
    console.log('Sending request to:', apiUrl);
    
    try {
        const startTime = Date.now();
        const response = await axios.post(apiUrl, testPayload, {
            timeout: 120000, // 2 minute timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const duration = Date.now() - startTime;
        
        console.log('\n✅ SUCCESS!');
        console.log('Duration:', duration + 'ms');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n🎉 Animation generated successfully!');
            console.log('Video path:', response.data.videoPath);
            console.log('Code length:', response.data.code ? response.data.code.length : 'N/A');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.message);
        } else {
            console.error('Request setup error:', error.message);
        }
    }
}

testAPI();
