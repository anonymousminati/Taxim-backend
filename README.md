# Taxim Backend - AI-Powered Ma### Pre-built Docker Image

The easiest way to run the backend is using the pre-built Docker image from Docker Hub:

```bash
# Pull and run the latest image
docker pull prathameshmalode/taxim-backend:latest

# Run with environment variables
docker run -p 3001:3001 \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  -e CORS_ORIGIN="http://localhost:3002" \
  prathameshmalode/taxim-backend:latest

# Run in detached mode with restart policy
docker run -d --restart unless-stopped \
  -p 3001:3001 \
  -e GEMINI_API_KEY="your-gemini-api-key" \
  -e CORS_ORIGIN="https://yourusername.github.io" \
  --name taxim-backend \
  prathameshmalode/taxim-backend:latest
```

### Building from Source

```bash
# Clone the repositoryr

A robust Node.js backend service that generates mathematical animations using Manim (Mathematical Animation Engine) through AI-powered natural language processing. The backend integrates with Google Gemini AI to convert user prompts into executable Manim code and renders high-quality mathematical visualizations.

## 🚀 Features

- **AI-Powered Code Generation**: Converts natural language prompts into Manim animation code using Google Gemini AI
- **Intelligent Error Handling**: Automatically detects and fixes common Manim coding errors with progressive error correction
- **Session Management**: Maintains conversation context and user preferences across multiple interactions
- **Real-time Rendering**: Executes Manim code and generates MP4 video animations with optimized rendering pipeline
- **System Requirements Checking**: Validates Manim, FFmpeg, and LaTeX installations
- **Automated Cleanup**: Scheduled cleanup of temporary files and old animations
- **Rate Limiting**: Protects against abuse with configurable request limits
- **CORS Support**: Properly configured for cross-origin requests from frontend applications
- **Health Monitoring**: Comprehensive health checks and system status endpoints
- **Docker Support**: Fully containerized with all dependencies pre-installed

## 🛠 Tech Stack

- **Runtime**: Node.js 20.x with ES modules
- **Framework**: Express.js with TypeScript-style JSDoc
- **AI Integration**: Google Gemini AI API (gemini-2.5-flash model)
- **Animation Engine**: Manim Community Edition v0.18.x
- **Video Processing**: FFmpeg 4.4.x
- **LaTeX Support**: MiKTeX for mathematical typesetting
- **Containerization**: Docker with Ubuntu 22.04 base
- **Security**: Helmet.js, express-rate-limit, CORS
- **Monitoring**: Custom health checks and performance monitoring

## 🐳 Docker Deployment

### Pre-built Docker Image

The easiest way to run the backend is using the pre-built Docker image:

```bash
# Pull and run the latest image
docker pull prathameshmalode/taxim-backend:latest

# Run with environment variables
docker run -p 3001:3001 \\
  -e GEMINI_API_KEY="your-gemini-api-key" \\
  -e CORS_ORIGIN="http://localhost:3002" \\
  prathameshmalode/taxim-backend:latest
```

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd taxim/backend

# Build the Docker image
docker build -t taxim-backend .

# Run the container
docker run -p 3001:3001 \\
  -e GEMINI_API_KEY="your-gemini-api-key" \\
  taxim-backend
```

### Docker Image Details

The Docker image includes:
- **Ubuntu 22.04** base system
- **Node.js 20.x** runtime environment
- **Python 3.11** with Manim Community Edition v0.18.x
- **FFmpeg 4.4.x** for video processing
- **MiKTeX** for LaTeX mathematical typesetting
- **Build tools** and system dependencies
- **Non-root user** (appuser) for security
- **Optimized layers** for faster builds and smaller image size

### Please Note- Clone Frontend from [Taxim-Frontend repo](https://github.com/anonymousminati/Taxim-frontend)


## 📋 Prerequisites

### For Docker Deployment (Recommended)
- Docker Desktop or Docker Engine
- 4GB+ RAM available for container
- Google Gemini API key

### For Local Development
- Node.js 20.x or higher
- Python 3.11+
- Manim Community Edition v0.18.x
- FFmpeg 4.4.x or higher
- LaTeX distribution (MiKTeX or TeX Live)
- Google Gemini API key

## ⚙️ Environment Variables

Create a `.env` file in the backend directory:

```bash
# Required
GEMINI_API_KEY=your-google-gemini-api-key

# Server Configuration
NODE_ENV=production
PORT=3001

# CORS Settings
CORS_ORIGIN=http://localhost:3002
FRONTEND_URL=http://localhost:3002

# File Management
ANIMATION_OUTPUT_DIR=public/animations
TEMP_DIR=temp
MAX_FILE_SIZE=10485760

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Getting Started

### Option 1: Docker (Recommended)

```bash
# Quick start with Docker
docker run -p 3001:3001 \\
  -e GEMINI_API_KEY="your-api-key" \\
  prathameshmalode/taxim-backend:latest

# The server will be available at http://localhost:3001
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm run dev

# Or start production server
npm start
```

- 🤖 **AI-powered Code Generation** - Google Gemini integration for intelligent Manim code creation
- 🎬 **Automatic Animation Rendering** - Seamless Manim video generation with error handling
- 🔄 **Session Management** - Multi-turn conversations with context awareness
- ✅ **Code Validation & Testing** - Comprehensive syntax and compilation checking
- 🛠️ **Error Recovery** - Smart code fixing with LaTeX error handling
- 🔒 **Security & Rate Limiting** - Production-grade security middleware
- 📁 **Smart File Management** - Automatic cleanup and optimization
- � **Monitoring & Health Checks** - Performance metrics and system status
- 🌐 **CORS & Frontend Integration** - Seamless frontend connectivity

## Prerequisites

Before running the backend, ensure you have:

1. **Node.js** (v18 or higher)
2. **Python** (v3.8 or higher)
3. **Manim** installed globally
4. **Google Gemini API Key**

### Installing Manim

```bash
# Install Manim using pip
pip install manim

# Verify installation
manim --version
```

### Installing FFmpeg (required by Manim)

**Windows:**
```bash
# Using Chocolatey (recommended)
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html and add to PATH
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### Installing LaTeX (optional, for mathematical expressions)

**Windows:**
```bash
# Install MiKTeX
choco install miktex
```

**macOS:**
```bash
brew install --cask mactex
```

**Linux:**
```bash
sudo apt install texlive-latex-base texlive-fonts-recommended
```

## Installation

1. **Clone the repository and navigate to backend:**
```bash
cd taxim/backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
```

4. **Edit `.env` file with your configuration:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | - | ✅ Yes |
| `PORT` | Server port | 3001 | No |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 | No |
| `ANIMATION_OUTPUT_DIR` | Directory for rendered animations | public/animations | No |
| `TEMP_DIR` | Temporary files directory | temp | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | 900000 (15 min) | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 | No |
| `NODE_ENV` | Environment mode | development | No |

## Getting Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to your `.env` file

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured PORT).

## API Endpoints

### System Health & Status

#### Health Check
```http
GET /health
```
Returns basic API health status.

#### System Requirements Check
```http
GET /api/manim/status
```
Returns detailed system status including Manim, FFmpeg, and LaTeX availability.

#### Performance Metrics
```http
GET /api/manim/status/performance
```
Returns performance metrics and monitoring data.

### Animation Generation

#### Generate Animation from Prompt
```http
POST /api/manim/generate
Content-Type: application/json

{
  "prompt": "Create a circle that transforms into a square",
  "sessionId": "optional-session-id",
  "userPreferences": {
    "style": "modern",
    "colors": ["blue", "red"]
  }
}
```

#### Render Custom Manim Code
```http
POST /api/manim/render
Content-Type: application/json

{
  "code": "from manim import *\n\nclass MyAnimation(Scene):\n    def construct(self):\n        circle = Circle()\n        self.play(Create(circle))",
  "sessionId": "optional-session-id"
}
```

#### Improve Existing Code
```http
POST /api/manim/improve
Content-Type: application/json

{
  "code": "existing manim code",
  "feedback": "make it more colorful",
  "sessionId": "optional-session-id"
}
```

### Session Management

#### Get Session Information
```http
GET /api/manim/sessions/session/{sessionId}
```

#### Clear Session
```http
DELETE /api/manim/sessions/session/{sessionId}
```

#### List Active Sessions
```http
GET /api/manim/sessions/active
```

## Response Format

### Success Response
```json
{
  "success": true,
  "code": "generated manim code",
  "videoPath": "/animations/MyAnimation_1234567890.mp4",
  "videoFileName": "MyAnimation_1234567890.mp4",
  "message": "Animation generated successfully",
  "sessionId": "session-uuid",
  "sessionInfo": {
    "exists": true,
    "codeHistory": 3,
    "conversationLength": 5
  },
  "metadata": {
    "generationAttempts": 1,
    "wasCodeFixed": false,
    "renderAttempts": 1
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Detailed error description",
  "timestamp": "2025-06-24T12:00:00.000Z"
}
```

### System Status Response
```json
{
  "success": true,
  "requirements": {
    "manim": {
      "installed": true,
      "version": "Manim Community v0.18.0"
    },
    "ffmpeg": {
      "installed": true,
      "version": "ffmpeg version 7.1.1"
    },
    "latex": {
      "installed": false,
      "error": "pdflatex not found"
    },
    "allRequirementsMet": false
  },
  "environment": {
    "nodeVersion": "v20.15.1",
    "platform": "win32"
  },
  "recommendations": ["Install LaTeX (MiKTeX or TeX Live)"]
}
```

## Directory Structure

```
backend/
├── src/
│   ├── routes/                   # API route handlers
│   │   ├── manim.js             # Main router with legacy endpoints
│   │   ├── render.js            # Generation & rendering routes
│   │   ├── sessions.js          # Session management routes
│   │   └── status.js            # Health & monitoring routes
│   ├── services/                # Business logic services
│   │   ├── manimAgent.js        # Main AI agent with enhanced features
│   │   ├── agentManager.js      # Singleton agent management
│   │   └── startup.js           # Server initialization
│   ├── utils/                   # Utility modules
│   │   ├── latexUtils.js        # LaTeX error handling & fallbacks
│   │   ├── fileSearch.js        # File management & cleanup
│   │   ├── systemUtils.js       # System requirements checking
│   │   ├── retryUtils.js        # Retry logic & circuit breakers
│   │   ├── errorUtils.js        # Error classification & aggregation
│   │   ├── monitoringUtils.js   # Performance monitoring
│   │   └── fileUtils.js         # File system utilities
│   ├── middleware/              # Express middleware
│   │   └── validation.js        # Request validation & logging
│   └── prompts.js              # AI prompt templates & config
├── public/
│   └── animations/             # Rendered animation files (auto-created)
├── server.js                   # Main Express server
├── package.json               # Dependencies & scripts
├── Dockerfile                 # Container configuration
├── .env.example              # Environment template
├── .env.production           # Production environment
└── README.md                 # This file
```

## Security Features

- **🛡️ Helmet.js** - Comprehensive security headers
- **⏱️ Rate Limiting** - Configurable request throttling to prevent abuse
- **🌐 CORS** - Secure cross-origin resource sharing
- **✅ Input Validation** - Robust request payload validation
- **🧹 Automatic Cleanup** - Secure temporary file removal
- **🔒 Environment Isolation** - Secure environment variable handling
- **📝 Request Logging** - Detailed audit trails for security monitoring

## Deployment

### Using Docker (Recommended)

```bash
# Build the container
docker build -t taxim-backend .

# Run with environment variables
docker run -p 3001:3001 \
  -e GEMINI_API_KEY=your_api_key \
  -e NODE_ENV=production \
  taxim-backend
```

### Using Docker Compose

```bash
# Start both backend and frontend
docker-compose up -d

# View logs
docker-compose logs -f backend
```

### Manual Deployment

```bash
# Install dependencies
npm ci --only=production

# Start in production mode
NODE_ENV=production npm start
```

### Environment Configuration

For production deployments, create a `.env.production` file:

```env
GEMINI_API_KEY=your_production_api_key
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Troubleshooting

### System Requirements Issues

**1. Manim not found:**
```bash
# Verify Manim installation
manim --version

# If not installed:
pip install manim

# If multiple Python versions:
python -m pip install manim
```

**2. FFmpeg not found:**
```bash
# Verify FFmpeg installation
ffmpeg -version

# Windows (with Chocolatey):
choco install ffmpeg

# macOS:
brew install ffmpeg

# Linux:
sudo apt install ffmpeg
```

**3. LaTeX errors (optional):**
```bash
# Check LaTeX installation
pdflatex --version

# Install if needed (Windows):
choco install miktex

# The application includes LaTeX fallbacks for basic math expressions
```

### API & Runtime Issues

**4. Gemini API errors:**
- Verify API key is correct and active
- Check API quotas and rate limits
- Ensure internet connectivity

**5. Permission errors:**
```bash
# Create required directories
mkdir -p public/animations temp

# Set permissions (Linux/macOS)
chmod 755 public/animations temp
```

**6. Memory/Performance issues:**
- Monitor system resources during rendering
- Consider reducing animation complexity
- Implement request queuing for high load

### Development & Debugging

**7. Enable debug logging:**
```bash
NODE_ENV=development npm run dev
```

**8. Check system status:**
```bash
curl http://localhost:3001/api/manim/status
```

**9. Monitor performance:**
```bash
curl http://localhost:3001/api/manim/status/performance
```

## Performance Considerations

### Resource Management
- **CPU Usage**: Manim rendering is CPU-intensive; consider multi-core systems
- **Memory**: Each session maintains context; monitor memory usage with many concurrent users
- **Disk Space**: Animations are stored temporarily; automatic cleanup prevents disk overflow
- **Network**: Large video files may impact bandwidth; consider CDN for production

### Scaling Recommendations
- **Horizontal Scaling**: Deploy multiple instances behind a load balancer
- **Job Queue**: Implement Redis/Bull queue for render jobs in high-load scenarios
- **Caching**: Cache generated code and common animations
- **Storage**: Use cloud storage (AWS S3, Google Cloud) for animation files

### Monitoring
- Monitor response times via `/api/manim/status/performance`
- Set up alerts for system resource thresholds
- Track error rates and API key usage
- Log rotation for production deployments

## Architecture & Design

### Core Components

**ManimAgent** - Main AI service with:
- Session management for multi-turn conversations
- Context-aware prompt building
- Error recovery and retry logic
- Performance monitoring

**Route Modules** - Clean separation:
- `render.js` - Animation generation and rendering
- `sessions.js` - Session lifecycle management  
- `status.js` - Health checks and monitoring
- `manim.js` - Main router with legacy compatibility

**Utility Modules** - Reusable components:
- `latexUtils.js` - LaTeX error handling and fallbacks
- `systemUtils.js` - System requirements validation
- `retryUtils.js` - Configurable retry patterns
- `errorUtils.js` - Error classification and aggregation
- `monitoringUtils.js` - Performance metrics collection

### Development Workflow

1. **Setup**: Environment configuration and dependency installation
2. **Development**: Hot-reload server with debug logging
3. **Testing**: System requirements and API endpoint validation  
4. **Production**: Docker containerization with optimized builds

## Contributing

### Development Setup

1. **Fork and clone** the repository
2. **Install dependencies**: `npm install`
3. **Copy environment**: `cp .env.example .env`
4. **Configure API key**: Add your Gemini API key to `.env`
5. **Start development server**: `npm run dev`

### Code Style

- **ESLint**: Follow the established linting rules
- **Modular Design**: Keep utilities separate and reusable
- **Error Handling**: Use typed errors with proper context
- **Documentation**: Update README for new features

### Adding New Features

1. **Routes**: Create new route files in `src/routes/`
2. **Services**: Add business logic in `src/services/`
3. **Utilities**: Reusable code goes in `src/utils/`
4. **Middleware**: Request handling in `src/middleware/`

## License

MIT License - see LICENSE file for details.

---

## Quick Start Checklist

- [ ] ✅ **Node.js v18+** installed
- [ ] 🐍 **Python 3.9+** installed  
- [ ] 🎬 **Manim** installed (`pip install manim`)
- [ ] 📹 **FFmpeg** installed and in PATH
- [ ] 🤖 **Gemini API key** obtained from Google AI Studio
- [ ] ⚙️ **Environment variables** configured in `.env`
- [ ] 🚀 **Server started** with `npm run dev`
- [ ] 🔍 **Health check** at `http://localhost:3001/health`

**Ready to create mathematical animations with AI!** 🎉
