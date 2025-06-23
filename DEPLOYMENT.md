# Backend Deployment Guide

## Prerequisites
- Node.js 18+ installed on the server
- Python 3.8+ with Manim and FFmpeg installed
- Google Gemini API key

## Environment Setup

1. **Create production environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure production environment variables:**
   ```bash
   NODE_ENV=production
   PORT=3001
   
   # Google Gemini API Key (Required)
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   
   # Frontend URL (Update for production)
   FRONTEND_URL=https://your-frontend-domain.com
   
   # File upload settings
   MAX_FILE_SIZE=10485760
   UPLOAD_DIR=uploads
   
   # Animation settings
   ANIMATION_OUTPUT_DIR=public/animations
   TEMP_DIR=temp
   
   # Rate limiting (production values)
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=50
   ```

## Deployment Options

### Option 1: Railway (Recommended for Backend)

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and deploy:**
   ```bash
   railway login
   railway init
   railway add
   ```

3. **Set environment variables in Railway dashboard:**
   - `GEMINI_API_KEY`
   - `FRONTEND_URL`
   - `NODE_ENV=production`

4. **Deploy:**
   ```bash
   railway deploy
   ```

### Option 2: Heroku

1. **Install Heroku CLI and login:**
   ```bash
   heroku login
   ```

2. **Create Heroku app:**
   ```bash
   heroku create your-manim-backend
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set GEMINI_API_KEY=your_key_here
   heroku config:set FRONTEND_URL=https://your-frontend-url.com
   heroku config:set NODE_ENV=production
   ```

4. **Add Python buildpack for Manim:**
   ```bash
   heroku buildpacks:add heroku/python
   heroku buildpacks:add heroku/nodejs
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

### Option 3: DigitalOcean App Platform

1. **Create `app.yaml` in backend root:**
   ```yaml
   name: manim-backend
   services:
   - name: api
     source_dir: /
     github:
       repo: your-username/your-repo
       branch: main
     run_command: npm start
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: NODE_ENV
       value: production
     - key: GEMINI_API_KEY
       value: your_key_here
     - key: FRONTEND_URL
       value: https://your-frontend-url.com
   ```

### Option 4: VPS/Server Deployment

1. **Install dependencies on server:**
   ```bash
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Python and Manim
   sudo apt-get install python3 python3-pip ffmpeg
   pip3 install manim
   ```

2. **Clone and setup:**
   ```bash
   git clone your-repo
   cd backend
   npm install --production
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "manim-backend"
   pm2 startup
   pm2 save
   ```

## System Requirements for Manim

The server needs these installed:
- **Python 3.8+** with pip
- **FFmpeg** for video processing
- **Manim** Python library
- **LaTeX** (optional, for complex math rendering)

Install command for Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install python3 python3-pip ffmpeg texlive texlive-latex-extra
pip3 install manim
```

## Health Check Endpoint

The backend includes a health check at `/health` that verifies:
- API is running
- Manim installation
- FFmpeg availability

## Important Notes

1. **Memory Requirements:** Manim video rendering can be memory-intensive. Use at least 1GB RAM.
2. **Disk Space:** Videos and temp files need storage. Configure cleanup schedules.
3. **API Keys:** Keep your Gemini API key secure and never commit it to version control.
4. **CORS:** Update `FRONTEND_URL` to match your frontend domain.
