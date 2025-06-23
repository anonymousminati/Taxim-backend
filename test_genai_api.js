import { GoogleGenAI } from "@google/genai";

console.log('Testing @google/genai API structure...');

try {
    const genai = new GoogleGenAI(process.env.GEMINI_API_KEY || 'test-key');
    console.log('genai object created successfully');
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(genai)));
    console.log('Available properties:', Object.keys(genai));
    
    // Test if getGenerativeModel exists
    if (typeof genai.getGenerativeModel === 'function') {
        console.log('✅ getGenerativeModel is available');
    } else {
        console.log('❌ getGenerativeModel is NOT available');
    }
    
    // Test if startChat exists
    if (typeof genai.startChat === 'function') {
        console.log('✅ startChat is available');
    } else {
        console.log('❌ startChat is NOT available');
    }
    
} catch (error) {
    console.error('Error creating genai instance:', error.message);
}
