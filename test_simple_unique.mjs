#!/usr/bin/env node

// Simple test for code uniqueness
import axios from 'axios';

async function testCodeUniqueness() {
    console.log('🧪 Testing Code Uniqueness (Simple Version)\n');
    
    try {
        const prompt = "Create a circle animation";
        const results = [];
        
        // Generate 3 animations with different sessions
        for (let i = 1; i <= 3; i++) {
            console.log(`Generating animation ${i}...`);
            
            const sessionId = `test_unique_${i}_${Date.now()}`;
            const response = await axios.post('http://localhost:3001/api/manim/generate', {
                prompt: prompt,
                sessionId: sessionId
            });
            
            if (response.data.success) {
                const code = response.data.code;
                const className = code.match(/class (\w+)/)?.[1] || 'Unknown';
                
                results.push({
                    index: i,
                    sessionId: sessionId,
                    className: className,
                    codeLength: code.length,
                    codeHash: Buffer.from(code).toString('base64').substring(0, 20) + '...'
                });
                
                console.log(`   ✅ Session: ${sessionId}`);
                console.log(`   📝 Class: ${className}`);
                console.log(`   📏 Length: ${code.length} chars`);
                console.log(`   🔑 Hash: ${results[i-1].codeHash}`);
                console.log('');
            } else {
                console.log(`   ❌ Failed: ${response.data.error}`);
                return;
            }
        }
        
        // Compare results
        console.log('🔍 Uniqueness Check:');
        const classNames = results.map(r => r.className);
        const uniqueClasses = [...new Set(classNames)];
        
        console.log(`   Classes: ${classNames.join(', ')}`);
        console.log(`   Unique classes: ${uniqueClasses.length}/${results.length}`);
        console.log(`   All different: ${uniqueClasses.length === results.length ? '✅ YES' : '❌ NO'}`);
        
        if (uniqueClasses.length === results.length) {
            console.log('\n🎉 SUCCESS: Code uniqueness is working!');
        } else {
            console.log('\n⚠️  WARNING: Some animations may be similar');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data?.error || error.message);
    }
}

testCodeUniqueness();
