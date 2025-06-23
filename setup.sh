#!/bin/bash

echo "Setting up Taxim Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "Error: Python is not installed. Please install Python first."
    exit 1
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: Failed to install Node.js dependencies."
    exit 1
fi

# Check if Manim is installed
if ! command -v manim &> /dev/null; then
    echo "Manim is not installed. Installing Manim..."
    
    # Try pip3 first, then pip
    if command -v pip3 &> /dev/null; then
        pip3 install manim
    elif command -v pip &> /dev/null; then
        pip install manim
    else
        echo "Error: pip is not installed. Please install pip first."
        exit 1
    fi
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install Manim."
        exit 1
    fi
else
    echo "Manim is already installed."
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "Please edit the .env file and add your GEMINI_API_KEY"
    echo "You can get it from: https://makersuite.google.com/app/apikey"
fi

# Create necessary directories
mkdir -p temp
mkdir -p public/animations

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your GEMINI_API_KEY"
echo "2. Run 'npm run dev' to start the development server"
echo ""
