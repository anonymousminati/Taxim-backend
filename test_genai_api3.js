import { GoogleGenAI } from "@google/genai";

console.log('Testing @google/genai chat session API...');

try {
    const genai = new GoogleGenAI(process.env.GEMINI_API_KEY || 'test-key');
    
    console.log('Creating chat session...');
    const chatSession = genai.chats.create({
        model: "gemini-2.5-flash",
        systemInstruction: "You are a helpful assistant.",
        generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
        },
    });
    
    console.log('Chat session created successfully');
    console.log('Available methods on chat session:', Object.getOwnPropertyNames(Object.getPrototypeOf(chatSession)));
    
    // Try send methods
    if (typeof chatSession.sendMessage === 'function') {
        console.log('✅ chatSession.sendMessage is available');
    } else {
        console.log('❌ chatSession.sendMessage is NOT available');
    }
    
    if (typeof chatSession.send === 'function') {
        console.log('✅ chatSession.send is available');
    } else {
        console.log('❌ chatSession.send is NOT available');
    }
    
    // Check for models API for single-shot generation
    console.log('Testing models API...');
    if (typeof genai.models.generateContentInternal === 'function') {
        console.log('✅ genai.models.generateContentInternal is available');
    } else {
        console.log('❌ genai.models.generateContentInternal is NOT available');
    }
    
} catch (error) {
    console.error('Error testing chat session:', error.message);
}
