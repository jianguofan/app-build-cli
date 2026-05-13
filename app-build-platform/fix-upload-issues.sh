#!/bin/bash

echo "=========================================="
echo "Fixing Upload Issues"
echo "=========================================="
echo ""

# 1. Start Redis
echo "1. Starting Redis..."
if pgrep -x redis-server > /dev/null; then
    echo "✓ Redis is already running"
else
    echo "Starting Redis..."
    brew services start redis
    sleep 2
    if pgrep -x redis-server > /dev/null; then
        echo "✓ Redis started successfully"
    else
        echo "✗ Failed to start Redis. Please run: brew services start redis"
        exit 1
    fi
fi
echo ""

# 2. Create data directory if it doesn't exist
echo "2. Creating data directory..."
mkdir -p packages/backend/data
echo "✓ Data directory ready"
echo ""

# 3. Initialize empty publish records if not exists
echo "3. Initializing publish records..."
if [ ! -f "packages/backend/data/publishes.json" ]; then
    echo "[]" > packages/backend/data/publishes.json
    echo "✓ Created empty publishes.json"
else
    echo "✓ publishes.json already exists"
fi
echo ""

# 4. Initialize empty credentials if not exists
echo "4. Initializing publishing credentials..."
if [ ! -f "packages/backend/data/publishing-credentials.json" ]; then
    echo "[]" > packages/backend/data/publishing-credentials.json
    echo "✓ Created empty publishing-credentials.json"
else
    echo "✓ publishing-credentials.json already exists"
fi
echo ""

# 5. Build backend if needed
echo "5. Checking backend build..."
if [ ! -d "packages/backend/dist" ]; then
    echo "Building backend..."
    cd packages/backend
    npm run build
    cd ../..
    echo "✓ Backend built successfully"
else
    echo "✓ Backend already built"
fi
echo ""

# 6. Start backend service
echo "6. Starting backend service..."
cd packages/backend

# Check if already running
if pgrep -f "dist/main.js" > /dev/null; then
    echo "Backend is already running. Restarting..."
    pkill -f "dist/main.js"
    sleep 2
fi

# Start in background
nohup node dist/main.js > ../../logs/out.log 2> ../../logs/err.log &
BACKEND_PID=$!

sleep 3

if pgrep -f "dist/main.js" > /dev/null; then
    echo "✓ Backend started successfully (PID: $BACKEND_PID)"
else
    echo "✗ Failed to start backend. Check logs/err.log for errors"
    exit 1
fi

cd ../..
echo ""

echo "=========================================="
echo "✓ All services started successfully!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Configure App Store credentials via the web UI (Settings page)"
echo "2. When creating a build with Pgyer upload, select one of these accounts:"
echo "   - lupeilong"
echo "   - allenli"
echo "   - alanwu"
echo "   - lb"
echo "3. Check logs at: logs/out.log and logs/err.log"
echo ""
echo "To check service status, run: ./diagnose-upload.sh"
echo ""
