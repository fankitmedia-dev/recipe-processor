#!/bin/bash

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm run install-all

# Check if .env file exists
if [ ! -f "./recipe-processor-backend/.env" ]; then
    echo "Creating .env file..."
    cat > "./recipe-processor-backend/.env" << EOL
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
CLAUDE_API_KEY=your_claude_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
PORT=3001
EOL
    echo "Please update the API keys in recipe-processor-backend/.env"
fi

echo "Setup complete! You can now run the app with: npm start" 