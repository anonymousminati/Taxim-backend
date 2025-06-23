@echo off
echo Setting up Taxim Backend...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed. Please install Python first.
    pause
    exit /b 1
)

REM Install Node.js dependencies
echo Installing Node.js dependencies...
npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install Node.js dependencies.
    pause
    exit /b 1
)

REM Check if Manim is installed
manim --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Manim is not installed. Installing Manim...
    pip install manim
    if %errorlevel% neq 0 (
        echo Error: Failed to install Manim.
        pause
        exit /b 1
    )
) else (
    echo Manim is already installed.
)

REM Create environment file if it doesn't exist
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo Please edit the .env file and add your GEMINI_API_KEY
    echo You can get it from: https://makersuite.google.com/app/apikey
)

REM Create necessary directories
if not exist temp mkdir temp
if not exist public mkdir public
if not exist public\animations mkdir public\animations

echo.
echo ✅ Setup completed successfully!
echo.
echo Next steps:
echo 1. Edit .env file and add your GEMINI_API_KEY
echo 2. Run 'npm run dev' to start the development server
echo.
pause
