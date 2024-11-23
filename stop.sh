#!/bin/bash

# Stop all processes
echo "Stopping all processes..."
pm2 stop all

# Delete all processes
echo "Deleting all processes..."
pm2 delete all

# Save PM2 process list
echo "Saving PM2 process list..."
pm2 save

echo "Services stopped successfully!" 