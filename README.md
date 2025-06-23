# Taxim Backend API

Backend API server for the Taxim Manim Studio application, providing AI-powered Manim code generation and animation rendering capabilities.

## Features

- 🤖 AI-powered Manim code generation using Google Gemini
- 🎬 Automatic animation rendering with Manim
- ✅ Code validation and syntax checking
- 🔒 Security middleware and rate limiting
- 📁 File management and cleanup
- 🌐 CORS support for frontend integration

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
- Download from https://ffmpeg.org/download.html
- Add to PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
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

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required) | - |
| `PORT` | Server port | 3001 |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |
| `ANIMATION_OUTPUT_DIR` | Directory for rendered animations | public/animations |
| `TEMP_DIR` | Temporary files directory | temp |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

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

### Health Check
```http
GET /health
```

### Check System Status
```http
GET /api/manim/status
```

### Generate Animation from Prompt
```http
POST /api/manim/generate
Content-Type: application/json

{
  "prompt": "Create a circle that transforms into a square"
}
```

### Validate Manim Code
```http
POST /api/manim/validate
Content-Type: application/json

{
  "code": "from manim import *\n\nclass MyAnimation(Scene):\n    def construct(self):\n        circle = Circle()\n        self.play(Create(circle))"
}
```

### Render Custom Manim Code
```http
POST /api/manim/render
Content-Type: application/json

{
  "code": "from manim import *\n\nclass MyAnimation(Scene):\n    def construct(self):\n        circle = Circle()\n        self.play(Create(circle))"
}
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description"
}
```

## Directory Structure

```
backend/
├── src/
│   ├── routes/
│   │   └── manim.js          # Manim API routes
│   └── services/
│       └── manimAgent.js     # Manim AI agent service
├── public/
│   └── animations/           # Rendered animation files
├── temp/                     # Temporary Python files
├── server.js                 # Main server file
├── package.json
├── .env.example
└── README.md
```

## Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Prevents API abuse
- **CORS** - Configurable cross-origin requests
- **Input Validation** - Request payload validation
- **File Cleanup** - Automatic temporary file removal

## Troubleshooting

### Common Issues

**1. Manim not found:**
```bash
# Verify Manim installation
manim --version

# If not installed, install it:
pip install manim
```

**2. FFmpeg not found:**
- Ensure FFmpeg is installed and in PATH
- Try reinstalling FFmpeg

**3. Permission errors:**
- Check write permissions for `temp/` and `public/animations/` directories
- Run with appropriate permissions

**4. API Key errors:**
- Verify your Gemini API key is correct
- Check API key permissions and quotas

### Debug Mode

Set environment variable for detailed logs:
```bash
NODE_ENV=development npm run dev
```

## Performance Considerations

- Manim rendering can be CPU-intensive
- Consider implementing a job queue for production
- Monitor disk space for animation files
- Set up log rotation for production deployments

## Development

### Adding New Features

1. Create new route files in `src/routes/`
2. Add service logic in `src/services/`
3. Update main server.js to include new routes
4. Add appropriate tests

### Testing

```bash
npm test
```

## License

MIT License - see LICENSE file for details.
