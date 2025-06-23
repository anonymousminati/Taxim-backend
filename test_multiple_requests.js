import axios from 'axios';

async function testMultipleRequests() {
    const apiUrl = 'http://localhost:3001/api/manim/generate';
    const sessionId = `test-session-${Date.now()}`;
    
    const requests = [
        "Create a red circle that grows and shrinks",
        "Now create a green square that rotates",
        "Make a purple triangle that bounces up and down"
    ];
    
    console.log(`Testing multiple requests with session ID: ${sessionId}`);
    
    for (let i = 0; i < requests.length; i++) {
        const prompt = requests[i];
        console.log(`\n🔄 Request ${i + 1}: ${prompt}`);
        
        try {
            const startTime = Date.now();
            const response = await axios.post(apiUrl, {
                prompt: prompt,
                sessionId: sessionId
            }, {
                timeout: 120000,
                headers: { 'Content-Type': 'application/json' }
            });
            
            const duration = Date.now() - startTime;
            
            if (response.data.success) {
                console.log(`✅ Success in ${duration}ms`);
                console.log(`📹 Video: ${response.data.videoFileName}`);
                console.log(`📝 Code length: ${response.data.code ? response.data.code.length : 'N/A'}`);
                console.log(`💬 Conversation length: ${response.data.sessionInfo.conversationLength}`);
            } else {
                console.log(`❌ Failed: ${response.data.error}`);
            }
        } catch (error) {
            console.error(`❌ Error on request ${i + 1}:`, error.response?.data || error.message);
            break;
        }
    }
}

testMultipleRequests();
