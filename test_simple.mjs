#!/usr/bin/env node

// Simple test to generate a basic animation
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/manim';

async function testSimpleAnimation() {
    console.log('🧪 Testing simple animation generation...\n');
    
    try {
        console.log('Generating simple square animation...');
        const request = {
            prompt: "Create a simple red square that scales up and down",
            sessionId: `test_${Date.now()}`
        };
        
        const response = await axios.post(`${BASE_URL}/generate`, request);
        console.log('✅ Animation generated successfully!');
        console.log('Session ID:', response.data.sessionId);
        console.log('Code preview:');
        console.log(response.data.code.substring(0, 300) + '...\n');
        
        if (response.data.success) {
            console.log('✅ Code compilation test passed');
        } else {
            console.log('❌ Code compilation failed:', response.data.error);
        }
        
        // Test rendering
        console.log('\nTesting animation rendering...');
        const renderRequest = {
            code: response.data.code,
            sessionId: request.sessionId
        };
        
        const renderResponse = await axios.post(`${BASE_URL}/render`, renderRequest);
        
        if (renderResponse.data.success) {
            console.log('✅ Animation rendered successfully!');
            console.log('Video path:', renderResponse.data.videoPath);
            console.log('Video file:', renderResponse.data.videoFileName);
        } else {
            console.log('❌ Rendering failed:', renderResponse.data.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run test
testSimpleAnimation();
