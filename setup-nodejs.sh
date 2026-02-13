#!/bin/bash

# AI Companion - Node.js Setup Script
# Quick setup for development environment

set -e

echo "🤖 AI Companion - Node.js Backend Setup"
echo "=========================================="
echo ""

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js ≥ 14.0.0"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js installed: $(node --version)"
echo "✅ npm installed: $(npm --version)"
echo ""

# Create .env if doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "   → Edit .env to configure your settings"
else
    echo "✅ .env already exists"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "📖 Next steps:"
echo ""
echo "1. Start Ollama (if not running):"
echo "   $ ollama serve"
echo ""
echo "2. In another terminal, start the Node.js server:"
echo "   $ npm run dev"
echo ""
echo "3. Open browser:"
echo "   → http://localhost:5000"
echo ""
echo "4. Check server health:"
echo "   $ curl http://localhost:5000/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Full documentation: NODE_README.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
