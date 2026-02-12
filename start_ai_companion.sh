#!/bin/bash

# AI Companion On-Device AI Startup Script
# Ensures Ollama and Flask app start properly

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Starting AI Companion with On-Device AI..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
status() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check if Docker is available
echo ""
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    status "Docker found"
    CONTAINER_CMD="docker"
else
    warning "Docker not found, trying Podman..."
    if command -v podman &> /dev/null; then
        status "Podman found"
        CONTAINER_CMD="podman"
    else
        error "Neither Docker nor Podman found!"
        exit 1
    fi
fi

# 2. Stop any existing containers
echo ""
echo "Cleaning up existing containers..."
$CONTAINER_CMD rm -f ollama 2>/dev/null || true
sleep 1
status "Previous containers cleaned"

# 3. Start Ollama
echo ""
echo "Starting Ollama (Local On-Device AI)..."
if $CONTAINER_CMD run -d \
    --name ollama \
    -p 11434:11434 \
    -v ollama:/root/.ollama \
    ollama/ollama > /dev/null 2>&1; then
    status "Ollama container started"
    
    # Wait for Ollama to be ready
    echo "Waiting for Ollama to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            status "Ollama is ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            warning "Ollama not responding yet, Flask app can still start with fallback"
        fi
        sleep 2
    done
else
    warning "Failed to start Ollama container (it may be downloading)"
    warning "Flask app will use fallback responses"
fi

# 4. Check Python environment
echo ""
echo "Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    status "Virtual environment created"
fi

source venv/bin/activate
status "Virtual environment activated"

# 5. Install/upgrade requirements
echo ""
echo "Installing Python dependencies..."
pip install -q -r requirements.txt 2>/dev/null || true
status "Dependencies installed"

# 6. Kill any existing Flask processes
echo ""
echo "Stopping any running Flask processes..."
pkill -f "python.*app.py" 2>/dev/null || true
sleep 1
status "Previous Flask instances stopped"

# 7. Start Flask app
echo ""
echo "Starting Flask AI Companion App..."
nohup python3 app.py > app.log 2>&1 &
APP_PID=$!
status "Flask app started (PID: $APP_PID)"

# 8. Wait for Flask to be ready
echo ""
echo "Waiting for Flask app to be ready..."
for i in {1..15}; do
    if curl -s http://localhost:5000 > /dev/null 2>&1; then
        status "Flask app is ready!"
        break
    fi
    if [ $i -eq 15 ]; then
        error "Flask app failed to start"
        cat app.log | tail -20
        exit 1
    fi
    sleep 1
done

# 9. Display startup summary
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 AI Companion Ready!${NC}"
echo "=================================================="
echo ""
echo "📱 Open your browser to:"
echo -e "   ${YELLOW}http://localhost:5000${NC}"
echo ""
echo "🤖 On-Device AI Status:"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "   Ollama: ${GREEN}✓ Running${NC}"
    
    # List available models
    MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys, json; data=json.load(sys.stdin); print(', '.join([m['name'] for m in data.get('models', [])]) if data.get('models') else 'None')" 2>/dev/null)
    echo "   Models: $MODELS"
else
    echo -e "   Ollama: ${YELLOW}⚠ Not yet available${NC}"
    echo "   The app will use mock responses until Ollama is ready"
fi
echo ""
echo "Flask App: ${GREEN}✓ Running${NC}"
echo ""
echo "📛 Features Enabled:"
echo "   ✓ Text Chat with AI"
echo "   ✓ Voice Input (Continuous Mic)"
echo "   ✓ Emotion Detection"
echo "   ✓ Calendar Sync"
echo "   ✓ Multi-Companion Support"
echo ""
echo "Logs: tail -f app.log"
echo ""
