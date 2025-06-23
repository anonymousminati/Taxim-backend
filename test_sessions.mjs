#!/usr/bin/env node

// Test different sessions generating different code
import axios from 'axios';

async function testDifferentSessions() {
    console.log('🧪 Testing Different Sessions Code Generation\n');
    
    try {
        const basePrompt = "Create a circle animation";
        const sessions = [];
        
        // Test 3 different sessions with the same prompt
        for (let i = 1; i <= 3; i++) {
            const sessionId = `different_session_${i}_${Date.now()}`;
            console.log(`Session ${i}: ${sessionId}`);
            
            const response = await axios.post('http://localhost:3001/api/manim/generate', {
                prompt: basePrompt,
                sessionId: sessionId
            });
            
            if (response.data.success) {
                sessions.push({
                    id: i,
                    sessionId: sessionId,
                    code: response.data.code,
                    videoFile: response.data.videoFileName,
                    className: response.data.code.match(/class (\w+)/)?.[1] || 'Unknown'
                });
                
                console.log(`   ✅ Generated: ${sessions[i-1].className}`);
                console.log(`   📏 Length: ${response.data.code.length} chars`);
                console.log(`   🎬 Video: ${response.data.videoFileName}`);
                console.log('');
            } else {
                console.log(`   ❌ Failed: ${response.data.error}\n`);
            }
        }
        
        if (sessions.length < 3) {
            console.log('❌ Not all sessions succeeded');
            return;
        }
        
        // Compare all sessions
        console.log('🔍 Comparing Sessions:\n');
        let allUnique = true;
        
        for (let i = 0; i < sessions.length; i++) {
            for (let j = i + 1; j < sessions.length; j++) {
                const session1 = sessions[i];
                const session2 = sessions[j];
                
                const codeEqual = session1.code === session2.code;
                const classEqual = session1.className === session2.className;
                
                console.log(`Session ${session1.id} vs Session ${session2.id}:`);
                console.log(`   Code identical: ${codeEqual ? '❌ YES' : '✅ NO'}`);
                console.log(`   Class name: ${session1.className} vs ${session2.className} ${classEqual ? '❌ SAME' : '✅ DIFFERENT'}`);
                console.log(`   Video file: ${session1.videoFile} vs ${session2.videoFile}`);
                console.log('');
                
                if (codeEqual) {
                    allUnique = false;
                }
            }
        }
        
        console.log('📊 RESULTS:');
        console.log(`   All sessions unique: ${allUnique ? '✅ YES' : '❌ NO'}`);
        console.log(`   Class names: ${sessions.map(s => s.className).join(', ')}`);
        
        if (!allUnique) {
            console.log('\n🔧 ISSUE DETECTED: Sessions are generating identical code!');
            console.log('This suggests the uniqueness mechanism is not working properly.');
            
            // Show the first few lines of each code to compare
            console.log('\n📝 Code samples:');
            sessions.forEach(session => {
                console.log(`Session ${session.id} (${session.className}):`);
                console.log(session.code.split('\n').slice(0, 5).join('\n'));
                console.log('...\n');
            });
        } else {
            console.log('\n🎉 SUCCESS: All sessions generated unique code!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testDifferentSessions();
