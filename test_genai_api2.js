import { GoogleGenAI } from "@google/genai";

console.log('Testing @google/genai detailed API...');

try {
    const genai = new GoogleGenAI(process.env.GEMINI_API_KEY || 'test-key');
    
    console.log('Available methods on models:', Object.getOwnPropertyNames(Object.getPrototypeOf(genai.models)));
    console.log('Available methods on chats:', Object.getOwnPropertyNames(Object.getPrototypeOf(genai.chats)));
    
    // Try to access model methods
    if (genai.models && typeof genai.models.generate === 'function') {
        console.log('✅ genai.models.generate is available');
    } else {
        console.log('❌ genai.models.generate is NOT available');
    }
    
    if (genai.chats && typeof genai.chats.create === 'function') {
        console.log('✅ genai.chats.create is available');
    } else {
        console.log('❌ genai.chats.create is NOT available');
    }
    
} catch (error) {
    console.error('Error testing genai API:', error.message);
}
