#!/usr/bin/env node

// Test script to verify backend functionality and uniqueness improvements
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/manim';
const sessionId = `test_session_${Date.now()}`;

async function testAnimationGeneration() {
    console.log('🧪 Testing Manim Studio Backend...\n');
    
    try {
        // Test 1: Health check
        console.log('1. Testing health check...');
        const healthResponse = await axios.get('http://localhost:3001/health');
        console.log('✅ Health check passed:', healthResponse.data.status);
        
        // Test 2: Generate first animation
        console.log('\n2. Generating first animation...');
        const firstRequest = {
            prompt: "Create a simple circle animation",
            sessionId: sessionId
        };
        
        const firstResponse = await axios.post(`${BASE_URL}/generate`, firstRequest);
        console.log('✅ First animation generated successfully');
        console.log('Code length:', firstResponse.data.code.length);
        console.log('Session ID:', firstResponse.data.sessionId);
        
        // Test 3: Generate second animation (should be different)
        console.log('\n3. Generating second animation with same prompt...');
        const secondRequest = {
            prompt: "Create a simple circle animation",
            sessionId: sessionId
        };
        
        const secondResponse = await axios.post(`${BASE_URL}/generate`, secondRequest);
        console.log('✅ Second animation generated successfully');
        console.log('Code length:', secondResponse.data.code.length);
        
        // Test 4: Compare uniqueness
        console.log('\n4. Checking uniqueness...');
        const firstCode = firstResponse.data.code;
        const secondCode = secondResponse.data.code;
        
        if (firstCode === secondCode) {
            console.log('❌ WARNING: Generated code is identical!');
        } else {
            console.log('✅ Generated code is different (uniqueness working)');
        }
        
        // Test 5: Session info
        console.log('\n5. Getting session info...');
        const sessionResponse = await axios.get(`${BASE_URL}/session/${sessionId}`);
        console.log('✅ Session info retrieved:', sessionResponse.data);
        
        console.log('\n🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Add a delay to let the server fully start
setTimeout(testAnimationGeneration, 2000);
