#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    echo "PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2 || {
        echo "Failed to install PM2. Trying with sudo..."
        sudo npm install -g pm2
    }
fi

# Kill existing PM2 processes
echo "Stopping existing processes..."
pm2 kill

# Install dependencies if needed
echo "Installing dependencies..."
cd recipe-processor-backend && npm install
cd ../recipe-processor-frontend && npm install
cd ..

# Verify Vite and React plugin are installed
echo "Verifying frontend dependencies..."
cd recipe-processor-frontend
npm install @vitejs/plugin-react vite react react-dom
cd ..

# Get the absolute path of ecosystem.config.js
ECOSYSTEM_PATH="$SCRIPT_DIR/ecosystem.config.js"

# Verify paths exist
echo "Verifying paths..."
if [ ! -f "$ECOSYSTEM_PATH" ]; then
    echo "Error: ecosystem.config.js not found at $ECOSYSTEM_PATH"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/recipe-processor-backend" ]; then
    echo "Error: Backend directory not found"
    exit 1
fi

if [ ! -d "$SCRIPT_DIR/recipe-processor-frontend" ]; then
    echo "Error: Frontend directory not found"
    exit 1
fi

# Start backend first
echo "Starting backend..."
pm2 start "$ECOSYSTEM_PATH" --only recipe-processor-backend

# Wait for backend to start
sleep 5

# Start frontend
echo "Starting frontend..."
pm2 start "$ECOSYSTEM_PATH" --only recipe-processor-frontend

# Save PM2 process list
echo "Saving PM2 process list..."
pm2 save

# Display running processes
echo "Displaying running processes..."
pm2 list

# Setup PM2 startup
echo "Setting up PM2 startup..."
pm2 startup

# Run the startup command that PM2 suggests
echo "To complete setup, run the startup command that PM2 suggested above."

echo "Services started successfully!"

# Show logs
echo "Showing logs (press Ctrl+C to exit)..."
pm2 logs 