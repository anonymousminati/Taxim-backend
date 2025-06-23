#!/usr/bin/env node

// Test uniqueness of generated animations
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/manim';
const sessionId = `uniqueness_test_${Date.now()}`;

async function testUniqueness() {
    console.log('🧪 Testing animation uniqueness...\n');
    
    try {
        const samePrompt = "Create a circle animation";
        const animations = [];
        
        // Generate 3 animations with the same prompt
        for (let i = 1; i <= 3; i++) {
            console.log(`${i}. Generating animation ${i}...`);
            const response = await axios.post(`${BASE_URL}/generate`, {
                prompt: samePrompt,
                sessionId: sessionId
            });
            
            animations.push({
                id: i,
                code: response.data.code,
                className: response.data.code.match(/class (\w+)/)?.[1] || 'Unknown'
            });
            
            console.log(`   ✅ Generated: ${animations[i-1].className}`);
            console.log(`   📏 Length: ${response.data.code.length} chars`);
        }
        
        // Check uniqueness
        console.log('\n🔍 Checking uniqueness...');
        let uniqueCount = 0;
        
        for (let i = 0; i < animations.length; i++) {
            for (let j = i + 1; j < animations.length; j++) {
                if (animations[i].code !== animations[j].code) {
                    uniqueCount++;
                    console.log(`   ✅ Animation ${animations[i].id} ≠ Animation ${animations[j].id}`);
                } else {
                    console.log(`   ❌ Animation ${animations[i].id} = Animation ${animations[j].id} (identical!)`);
                }
            }
        }
        
        // Check class names
        const classNames = animations.map(a => a.className);
        const uniqueClassNames = [...new Set(classNames)];
        
        console.log('\n📊 Results:');
        console.log(`   Total animations: ${animations.length}`);
        console.log(`   Unique class names: ${uniqueClassNames.length} (${uniqueClassNames.join(', ')})`);
        console.log(`   Unique code pairs: ${uniqueCount}/${animations.length * (animations.length - 1) / 2}`);
        
        if (uniqueCount === animations.length * (animations.length - 1) / 2) {
            console.log('\n🎉 SUCCESS: All animations are unique!');
        } else {
            console.log('\n⚠️  WARNING: Some animations are identical');
        }
        
        // Get session info
        console.log('\n📋 Session Info:');
        const sessionResponse = await axios.get(`${BASE_URL}/session/${sessionId}`);
        console.log(`   Code history: ${sessionResponse.data.codeHistory}`);
        console.log(`   Conversation length: ${sessionResponse.data.conversationLength}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testUniqueness();
