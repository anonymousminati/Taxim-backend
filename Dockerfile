# Backend Dockerfile
FROM node:18-alpine

# Install Python and dependencies for Manim
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    gcc \
    musl-dev \
    python3-dev \
    && ln -sf python3 /usr/bin/python

# Install Manim
RUN pip3 install manim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p public/animations temp uploads

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
