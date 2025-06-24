import axios from 'axios';

async function testLatexAnimation() {
    const apiUrl = 'http://localhost:3001/api/manim/generate';
    
    const testPayload = {
        prompt: "Create an animation showing the quadratic formula x = (-b ± √(b²-4ac))/2a using MathTex",
        sessionId: `test-latex-${Date.now()}`
    };
    
    console.log('Testing LaTeX animation:', testPayload.prompt);
    console.log('Session ID:', testPayload.sessionId);
    
    try {
        const startTime = Date.now();
        const response = await axios.post(apiUrl, testPayload, {
            timeout: 180000, // 3 minute timeout for LaTeX
            headers: { 'Content-Type': 'application/json' }
        });
        
        const duration = Date.now() - startTime;
        
        console.log('\n✅ SUCCESS!');
        console.log('Duration:', duration + 'ms');
        console.log('Response status:', response.status);
        
        if (response.data.success) {
            console.log('🎉 LaTeX animation generated successfully!');
            console.log('Video path:', response.data.videoPath);
            console.log('Code length:', response.data.code ? response.data.code.length : 'N/A');
            console.log('\nGenerated code preview:');
            console.log(response.data.code.substring(0, 400) + '...');
            
            if (response.data.metadata) {
                console.log('\nMetadata:');
                console.log('- Generation attempts:', response.data.metadata.generationAttempts);
                console.log('- Was code fixed:', response.data.metadata.wasCodeFixed);
                console.log('- Rendering attempts:', response.data.metadata.renderingAttempts);
            }
        } else {
            console.log('❌ Failed:', response.data.error);
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

testLatexAnimation();
