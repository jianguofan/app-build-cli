#!/bin/bash

echo "=========================================="
echo "App Build Platform - Upload Diagnostics"
echo "=========================================="
echo ""

# 1. Check Pgyer API Keys
echo "1. Checking Pgyer API Key Configuration:"
echo "----------------------------------------"
if [ -f "packages/backend/.env" ]; then
    echo "✓ .env file found"
    echo ""
    echo "Pgyer API Keys status:"
    grep "PGYER_API_KEY" packages/backend/.env | while read line; do
        key=$(echo "$line" | cut -d'=' -f1)
        value=$(echo "$line" | cut -d'=' -f2)
        if [[ "$value" == your_* ]]; then
            echo "  ✗ $key: NOT CONFIGURED (placeholder)"
        else
            echo "  ✓ $key: CONFIGURED (${value:0:10}...)"
        fi
    done
else
    echo "✗ .env file not found at packages/backend/.env"
fi
echo ""

# 2. Check App Store credentials
echo "2. Checking App Store Credentials:"
echo "----------------------------------------"
if [ -f "packages/backend/data/publishing-credentials.json" ]; then
    echo "✓ Publishing credentials file found"
    echo ""
    node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('packages/backend/data/publishing-credentials.json', 'utf-8'));
    const platforms = ['appstore', 'appstore_over'];
    platforms.forEach(p => {
        const cred = data.find(c => c.platform === p);
        if (cred) {
            const hasKeys = Object.keys(cred.credentials).length > 0;
            console.log(\`  \${cred.enabled ? '✓' : '✗'} \${p}: \${cred.enabled ? 'ENABLED' : 'DISABLED'}, \${hasKeys ? 'HAS CREDENTIALS' : 'NO CREDENTIALS'}\`);
        } else {
            console.log(\`  ✗ \${p}: NOT CONFIGURED\`);
        }
    });
    " 2>/dev/null || echo "  ⚠ Could not parse credentials file"
else
    echo "✗ Publishing credentials file not found"
fi
echo ""

# 3. Check recent builds
echo "3. Checking Recent Build Artifacts:"
echo "----------------------------------------"
WORKSPACE_DIR=$(grep "WORKSPACE_DIR" packages/backend/.env 2>/dev/null | cut -d'=' -f2)
if [ -z "$WORKSPACE_DIR" ]; then
    WORKSPACE_DIR="~/app-build-workspace"
fi
WORKSPACE_DIR=$(eval echo "$WORKSPACE_DIR")

if [ -d "$WORKSPACE_DIR/builds" ]; then
    echo "✓ Builds directory found: $WORKSPACE_DIR/builds"
    echo ""
    echo "Recent iOS builds:"
    ls -lt "$WORKSPACE_DIR/builds/ios/"*.ipa 2>/dev/null | head -3 | while read line; do
        echo "  - $line"
    done
    echo ""
    echo "Recent Android builds:"
    ls -lt "$WORKSPACE_DIR/builds/android/"*.apk 2>/dev/null | head -3 | while read line; do
        echo "  - $line"
    done
else
    echo "✗ Builds directory not found: $WORKSPACE_DIR/builds"
fi
echo ""

# 4. Check backend service
echo "4. Checking Backend Service:"
echo "----------------------------------------"
if pgrep -f "dist/main.js" > /dev/null; then
    echo "✓ Backend service is running (production mode)"
    PID=$(pgrep -f "dist/main.js")
    echo "  PID: $PID"
elif pgrep -f "packages/backend/src/main.ts" > /dev/null; then
    echo "✓ Backend service is running (development mode)"
    PID=$(pgrep -f "packages/backend/src/main.ts")
    echo "  PID: $PID"
else
    echo "✗ Backend service is NOT running"
    echo "  To start dev: cd packages/backend && npm run dev"
    echo "  To start prod: cd packages/backend && npm run start:prod"
fi
echo ""

# 5. Check Redis (for Bull queue)
echo "5. Checking Redis (required for publish queue):"
echo "----------------------------------------"
if pgrep -x redis-server > /dev/null; then
    echo "✓ Redis is running"
    PID=$(pgrep -x redis-server)
    echo "  PID: $PID"
elif redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is running (responding to ping)"
else
    echo "✗ Redis is NOT running"
    echo "  To start: brew services start redis"
fi
echo ""

# 6. Check recent publish records
echo "6. Checking Recent Publish Records:"
echo "----------------------------------------"
if [ -f "packages/backend/data/publishes.json" ]; then
    echo "✓ Publish records file found"
    echo ""
    node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('packages/backend/data/publishes.json', 'utf-8'));
    console.log(\`  Total publish records: \${data.length}\`);
    const recent = data.slice(-5).reverse();
    console.log('  Recent 5 publishes:');
    recent.forEach(p => {
        const date = new Date(p.publishedAt || p.createdAt || 0).toLocaleString();
        console.log(\`    - \${p.platform} | \${p.status} | \${date}\`);
        if (p.error) console.log(\`      Error: \${p.error}\`);
    });
    " 2>/dev/null || echo "  ⚠ Could not parse publish records"
else
    echo "✗ Publish records file not found"
fi
echo ""

echo "=========================================="
echo "Diagnostics Complete"
echo "=========================================="
echo ""
echo "Common Issues:"
echo "1. If Pgyer uploads fail: Check that the correct API key is configured"
echo "2. If App Store uploads fail: Check credentials and ensure backend/Redis are running"
echo "3. If no publish tasks are created: Check backend logs for errors"
echo ""
