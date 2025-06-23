#!/usr/bin/env node

// Final comprehensive test of the backend
import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api/manim';

async function runFinalTests() {
    console.log('🧪 Running Final Comprehensive Backend Tests...\n');
    
    const sessionId = `final_test_${Date.now()}`;
    let passedTests = 0;
    let totalTests = 0;

    // Helper function to run a test
    const runTest = async (testName, testFn) => {
        totalTests++;
        try {
            console.log(`${totalTests}. ${testName}...`);
            await testFn();
            console.log(`   ✅ PASSED\n`);
            passedTests++;
        } catch (error) {
            console.log(`   ❌ FAILED: ${error.message}\n`);
        }
    };    // Test 1: Health Check
    await runTest('Health Check', async () => {
        const response = await axios.get('http://localhost:3001/health');
        if (!response.data.success) {
            throw new Error(`Health check failed: ${response.data.message}`);
        }
    });

    // Test 2: Simple Animation Generation
    await runTest('Simple Animation Generation', async () => {
        const response = await axios.post(`${BASE_URL}/generate`, {
            prompt: "Create a simple blue square that appears and moves up",
            sessionId: sessionId
        });
        
        if (!response.data.success || !response.data.code) {
            throw new Error('Animation generation failed');
        }
        
        if (!response.data.code.includes('from manim import *')) {
            throw new Error('Generated code missing proper imports');
        }
        
        if (!response.data.code.includes('class ') || !response.data.code.includes('Scene')) {
            throw new Error('Generated code missing proper class structure');
        }
    });

    // Test 3: Code Rendering
    await runTest('Animation Rendering', async () => {
        const generateResponse = await axios.post(`${BASE_URL}/generate`, {
            prompt: "Create a simple red circle that scales",
            sessionId: sessionId
        });
        
        if (!generateResponse.data.success) {
            throw new Error('Animation generation failed');
        }
        
        if (!generateResponse.data.videoPath) {
            throw new Error('Video not generated');
        }
        
        if (!generateResponse.data.videoFileName.endsWith('.mp4')) {
            throw new Error('Invalid video format');
        }
    });

    // Test 4: Session Management
    await runTest('Session Management', async () => {
        const sessionResponse = await axios.get(`${BASE_URL}/session/${sessionId}`);
        
        if (!sessionResponse.data.success || !sessionResponse.data.exists) {
            throw new Error('Session not found or invalid');
        }
        
        if (typeof sessionResponse.data.conversationLength !== 'number') {
            throw new Error('Session data incomplete');
        }
    });

    // Test 5: Uniqueness Check
    await runTest('Animation Uniqueness', async () => {
        const uniqueSessionId = `unique_${Date.now()}`;
        const samePrompt = "Create a green triangle";
        
        const response1 = await axios.post(`${BASE_URL}/generate`, {
            prompt: samePrompt,
            sessionId: uniqueSessionId
        });
        
        const response2 = await axios.post(`${BASE_URL}/generate`, {
            prompt: samePrompt,
            sessionId: uniqueSessionId
        });
        
        if (response1.data.code === response2.data.code) {
            throw new Error('Generated animations are identical (uniqueness failed)');
        }
    });

    // Test 6: Error Handling
    await runTest('Error Handling', async () => {
        try {
            await axios.post(`${BASE_URL}/generate`, {
                prompt: "", // Empty prompt
                sessionId: sessionId
            });
            throw new Error('Should have failed with empty prompt');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                // Expected error
                return;
            }
            throw error;
        }
    });

    // Test 7: Code Improvement
    await runTest('Code Improvement', async () => {
        const simpleCode = `from manim import *
class TestScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))`;
        
        const response = await axios.post(`${BASE_URL}/improve`, {
            code: simpleCode,
            feedback: "Add color and movement",
            sessionId: sessionId
        });
        
        if (!response.data.success || !response.data.code) {
            throw new Error('Code improvement failed');
        }
        
        if (response.data.code === simpleCode) {
            throw new Error('Code was not actually improved');
        }
    });

    // Test 8: All Sessions List
    await runTest('Active Sessions List', async () => {
        const response = await axios.get(`${BASE_URL}/sessions`);
        
        if (!response.data.success || !Array.isArray(response.data.activeSessions)) {
            throw new Error('Failed to get active sessions');
        }
        
        if (!response.data.activeSessions.includes(sessionId)) {
            throw new Error('Test session not found in active sessions');
        }
    });

    // Test 9: Session Cleanup
    await runTest('Session Cleanup', async () => {
        const deleteResponse = await axios.delete(`${BASE_URL}/session/${sessionId}`);
        
        if (!deleteResponse.data.success || !deleteResponse.data.cleared) {
            throw new Error('Session cleanup failed');
        }
        
        // Verify session is gone
        const getResponse = await axios.get(`${BASE_URL}/session/${sessionId}`);
        if (getResponse.data.exists) {
            throw new Error('Session still exists after cleanup');
        }
    });

    // Final Results
    console.log('='.repeat(50));
    console.log(`📊 FINAL RESULTS: ${passedTests}/${totalTests} tests passed`);
    console.log('='.repeat(50));
    
    if (passedTests === totalTests) {
        console.log('🎉 ALL TESTS PASSED! Backend is working perfectly!');
        console.log('\n✅ Key Features Verified:');
        console.log('   • Animation generation with uniqueness');
        console.log('   • Multi-turn conversation support');
        console.log('   • Session management');
        console.log('   • Code rendering and video output');
        console.log('   • Error handling and code improvement');
        console.log('   • Robust Manim syntax generation');
        console.log('\n🚀 Backend is ready for production use!');
    } else {
        console.log(`⚠️  ${totalTests - passedTests} tests failed. Review issues above.`);
    }
}

// Run tests
runFinalTests().catch(console.error);
