// Quick test for Gemini API without systemInstruction
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const MANIM_SYSTEM_PROMPT = `You are a specialized AI assistant that generates Python Manim code for mathematical and educational animations.

IMPORTANT RULES:
1. Always respond with ONLY Python Manim code - no explanations, no markdown formatting
2. Use proper Manim syntax with the latest version conventions
3. Create a class that inherits from Scene
4. Include proper imports at the top
5. The main animation method should be called 'construct'
6. Generate complete, runnable code that creates engaging visual animations
7. Focus on mathematical concepts, educational content, or visual demonstrations
8. Use appropriate Manim objects like Text, MathTex, Circle, Square, Arrow, etc.

Example structure:
from manim import *

class MyAnimation(Scene):
    def construct(self):
        # Your animation code here
        pass

Remember: Output ONLY the Python code, nothing else.`;

async function testGeminiAPI() {
    try {
        console.log('Testing Gemini API without systemInstruction...');
        
        if (!process.env.GEMINI_API_KEY) {
            console.log('❌ GEMINI_API_KEY not found in environment variables');
            return;
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });
        
        const prompt = `${MANIM_SYSTEM_PROMPT}\n\nUser Request: Create a simple animation with a blue circle that moves from left to right`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ API call successful!');
        console.log('Response length:', text.length);
        console.log('Contains "from manim":', text.includes('from manim'));
        console.log('Contains "class":', text.includes('class'));
        console.log('First 200 chars:', text.substring(0, 200));
        
    } catch (error) {
        console.log('❌ API call failed:', error.message);
    }
}

testGeminiAPI();
