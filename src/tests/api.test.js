import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server.js';

describe('Manim API Tests', () => {
    let server;

    beforeAll((done) => {
        server = app.listen(0, done);
    });

    afterAll((done) => {
        server.close(done);
    });

    test('GET /health should return 200', async () => {
        const response = await request(server).get('/health');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    test('GET /api/manim/status should return system status', async () => {
        const response = await request(server).get('/api/manim/status');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.environment).toBeDefined();
    });

    test('POST /api/manim/validate should validate code', async () => {
        const validCode = `from manim import *
        
class TestAnimation(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))`;

        const response = await request(server)
            .post('/api/manim/validate')
            .send({ code: validCode });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.valid).toBe(true);
    });

    test('POST /api/manim/validate should reject invalid code', async () => {
        const invalidCode = 'not valid python code';

        const response = await request(server)
            .post('/api/manim/validate')
            .send({ code: invalidCode });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.valid).toBe(false);
    });    test('POST /api/manim/generate should require prompt', async () => {
        const response = await request(server)
            .post('/api/manim/generate')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Prompt is required');
    });

    test('POST /api/manim/generate should generate circle animation and create MP4', async () => {
        // Skip this test if GEMINI_API_KEY is not available
        if (!process.env.GEMINI_API_KEY) {
            console.log('⚠️  Skipping Manim generation test - GEMINI_API_KEY not found');
            return;
        }

        const circlePrompt = 'Create a simple circle animation';

        const response = await request(server)
            .post('/api/manim/generate')
            .send({ prompt: circlePrompt });

        // Test response structure
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.code).toBeDefined();
        expect(response.body.videoPath).toBeDefined();
        expect(response.body.videoFileName).toBeDefined();
        expect(response.body.message).toContain('Animation generated successfully');

        // Test that generated code is valid Manim code
        const { code } = response.body;
        expect(code).toContain('from manim import');
        expect(code).toContain('class');
        expect(code).toContain('Scene');
        expect(code).toContain('def construct');
        expect(code).toContain('Circle');

        // Test video file properties
        const { videoPath, videoFileName } = response.body;
        expect(videoPath).toMatch(/^\/animations\/.*\.mp4$/);
        expect(videoFileName).toMatch(/.*\.mp4$/);

        // Verify the actual MP4 file exists
        const fullVideoPath = path.join(process.cwd(), 'public/animations', videoFileName);
        expect(fs.existsSync(fullVideoPath)).toBe(true);

        // Verify file is actually an MP4 (check file size and basic properties)
        const stats = fs.statSync(fullVideoPath);
        expect(stats.size).toBeGreaterThan(1000); // Should be at least 1KB
        expect(stats.isFile()).toBe(true);

        // Clean up the generated file after test
        try {
            fs.unlinkSync(fullVideoPath);
            console.log('✅ Test cleanup: Removed generated MP4 file');
        } catch (error) {
            console.warn('⚠️  Could not clean up test file:', error.message);
        }
    }, 60000); // 60 second timeout for this test

    test('POST /api/manim/render should render custom code and create MP4', async () => {
        const customCode = `from manim import *

class TestCircle(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        self.play(Create(circle))
        self.wait(1)`;

        const response = await request(server)
            .post('/api/manim/render')
            .send({ code: customCode });

        // Test response structure
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.videoPath).toBeDefined();
        expect(response.body.videoFileName).toBeDefined();
        expect(response.body.message).toContain('Animation rendered successfully');

        // Test video file properties
        const { videoPath, videoFileName } = response.body;
        expect(videoPath).toMatch(/^\/animations\/.*\.mp4$/);
        expect(videoFileName).toMatch(/.*\.mp4$/);

        // Verify the actual MP4 file exists
        const fullVideoPath = path.join(process.cwd(), 'public/animations', videoFileName);
        expect(fs.existsSync(fullVideoPath)).toBe(true);

        // Verify file properties
        const stats = fs.statSync(fullVideoPath);
        expect(stats.size).toBeGreaterThan(1000); // Should be at least 1KB
        expect(stats.isFile()).toBe(true);

        // Clean up the generated file after test
        try {
            fs.unlinkSync(fullVideoPath);
            console.log('✅ Test cleanup: Removed rendered MP4 file');
        } catch (error) {
            console.warn('⚠️  Could not clean up test file:', error.message);
        }
    }, 30000); // 30 second timeout for this test

    test('Manim installation check', async () => {
        const response = await request(server).get('/api/manim/status');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const { manim } = response.body;
        expect(manim).toBeDefined();
        
        if (manim.installed) {
            expect(manim.version).toBeDefined();
            console.log('✅ Manim is installed:', manim.version);
        } else {
            console.log('⚠️  Manim is not installed:', manim.error);
        }
    });
});
