import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testUniqueCodeForChats() {
    console.log('Testing unique code generation for different chat requests...\n');
    
    try {
        // Array of different chat requests
        const chatRequests = [
            "Create a circle that changes color from red to blue",
            "Make a square rotate 360 degrees clockwise", 
            "Animate text 'Hello World' appearing with a fade-in effect",
            "Create a triangle that scales up and down",
            "Show two circles moving towards each other"
        ];
        
        const generatedCodes = [];
        
        // Send each chat request with different session IDs
        for (let i = 0; i < chatRequests.length; i++) {
            const request = chatRequests[i];
            const sessionId = `test-session-${i + 1}`;
            console.log(`\n--- Chat ${i + 1}: "${request}" (Session: ${sessionId}) ---`);
            
            const response = await fetch(`${BASE_URL}/api/manim/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: request,
                    sessionId: sessionId
                })
            });
            
            if (!response.ok) {
                console.error(`Failed to send chat ${i + 1}: ${response.status}`);
                continue;
            }
            
            const chatData = await response.json();
            
            if (chatData.success && chatData.code) {
                const code = chatData.code;
                generatedCodes.push({
                    request: request,
                    sessionId: sessionId,
                    code: code,
                    codeLength: code.length,
                    codePreview: code.substring(0, 150) + '...'
                });
                
                console.log(`✓ Code generated (${code.length} chars)`);
                console.log(`Preview: ${code.substring(0, 100)}...`);
                
                // Extract and show class name
                const classMatch = code.match(/class\s+(\w+)\s*\(/);
                const className = classMatch ? classMatch[1] : 'Not found';
                console.log(`Class name: ${className}`);
            } else {
                console.error(`Failed to generate code for chat ${i + 1}:`, chatData.error || 'Unknown error');
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('\n=== UNIQUENESS ANALYSIS ===');
        
        // Check if all codes are unique
        const uniqueCodes = new Set(generatedCodes.map(item => item.code));
        console.log(`Total requests: ${chatRequests.length}`);
        console.log(`Successful generations: ${generatedCodes.length}`);
        console.log(`Unique codes: ${uniqueCodes.size}`);
        
        if (uniqueCodes.size === generatedCodes.length) {
            console.log('✅ ALL CODES ARE UNIQUE!');
        } else {
            console.log('❌ DUPLICATE CODES DETECTED!');
            
            // Find duplicates
            const codeMap = new Map();
            generatedCodes.forEach((item, index) => {
                if (codeMap.has(item.code)) {
                    console.log(`Duplicate found: Request ${index + 1} matches Request ${codeMap.get(item.code) + 1}`);
                    console.log(`Duplicate content preview: ${item.code.substring(0, 200)}...`);
                } else {
                    codeMap.set(item.code, index);
                }
            });
        }
        
        // Show class names to verify they're different
        console.log('\n=== CLASS NAMES ===');
        generatedCodes.forEach((item, index) => {
            const classMatch = item.code.match(/class\s+(\w+)\s*\(/);
            const className = classMatch ? classMatch[1] : 'Not found';
            console.log(`Chat ${index + 1} (${item.sessionId}): ${className}`);
        });
        
        // Now test same session with different prompts
        console.log('\n=== TESTING SAME SESSION WITH DIFFERENT PROMPTS ===');
        
        const sameSessionTests = [
            "Create an orange triangle that spins",
            "Make a green circle bounce up and down"
        ];
        
        const sameSessionCodes = [];
        const sameSessionId = 'same-session-test';
        
        for (let i = 0; i < sameSessionTests.length; i++) {
            const request = sameSessionTests[i];
            console.log(`\n--- Same Session Test ${i + 1}: "${request}" ---`);
            
            const response = await fetch(`${BASE_URL}/api/manim/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: request,
                    sessionId: sameSessionId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.code) {
                    sameSessionCodes.push({
                        request: request,
                        code: data.code
                    });
                    
                    const classMatch = data.code.match(/class\s+(\w+)\s*\(/);
                    const className = classMatch ? classMatch[1] : 'Not found';
                    console.log(`✓ Generated class: ${className}`);
                    console.log(`Code preview: ${data.code.substring(0, 100)}...`);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (sameSessionCodes.length === 2) {
            const areDifferent = sameSessionCodes[0].code !== sameSessionCodes[1].code;
            console.log(`\nSame session different prompts: ${areDifferent ? '✅ DIFFERENT' : '❌ SAME'}`);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testUniqueCodeForChats();
