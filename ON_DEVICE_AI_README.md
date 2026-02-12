# 🤖 AI Companion - On-Device AI Setup

This is a privacy-first AI companion that runs entirely on your device using **Ollama** for local LLM inference. No data leaves your machine.

## 🎯 Features

- ✅ **On-Device AI** - All processing happens locally
- ✅ **Privacy-First** - Zero cloud connectivity required
- ✅ **Emotion Detection** - Real-time facial expression analysis
- ✅ **Continuous Voice** - Always-listening voice commands
- ✅ **Multi-Companion** - Create multiple AI companions
- ✅ **Persistent Memory** - Relationships and memories saved locally
- ✅ **Calendar Integration** - Sync with Google, Outlook, Apple Calendar
- ✅ **Zero Latency** - Local processing means instant responses

## 🚀 Quick Start

### Option 1: Automatic Startup (Recommended)

```bash
cd /home/ankursinha/building-management-ai
./start_ai_companion.sh
```

This script will:
1. Set up the Python environment
2. Start Ollama container (if Docker/Podman available)
3. Launch the Flask app
4. Open the companion interface

### Option 2: Manual Startup

#### 1. Start Ollama (On-Device LLM)
```bash
# Using Docker (recommended)
docker run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama ollama/ollama

# Or using Podman
podman run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama ollama/ollama
```

#### 2. Pull a Model (Optional - downloads on first use)
```bash
docker exec ollama ollama pull neural-chat
# or
docker exec ollama ollama pull mistral
```

#### 3. Start Flask App
```bash
cd /home/ankursinha/building-management-ai
source venv/bin/activate
python3 app.py
```

#### 4. Open in Browser
```
http://localhost:5000
```

## 🛠️ System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB+ recommended (depends on model)
- **Disk**: 5GB+ for Ollama models
- **Python**: 3.8+
- **Docker** or **Podman** (for containerized Ollama)

## 📊 API Endpoints

### On-Device AI Status
```bash
curl http://localhost:5000/api/ai/status
```

Response shows:
- Flask app status
- Ollama (local LLM) status
- Available models
- Feature status

### Health Check
```bash
curl http://localhost:5000/api/ai/health
```

### Available Models
```bash
curl http://localhost:5000/api/ai/models
```

### Chat with Companion
```bash
curl -X POST http://localhost:5000/api/companion/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "companion_id": "anita",
    "message": "Hello!"
  }'
```

## 🧠 Supported Ollama Models

Popular lightweight models for on-device use:

- **neural-chat** (7B) - Balanced, recommended
- **mistral** (7B) - Fast, good quality
- **llama2** (7B-13B) - Reliable, well-tested
- **phi** (2.7B) - Smallest, fastest
- **orca-mini** (3B) - Compact alternative

Pull a model:
```bash
docker exec ollama ollama pull neural-chat
```

Check available models:
```bash
curl http://localhost:11434/api/tags
```

## 🔐 Privacy & Security

- **No Cloud Calls**: All inference happens locally
- **No API Keys**: No OpenAI, Anthropic, or other API keys needed
- **Local Storage**: Relationships and memories stored in `.companions/` directory
- **Device Only**: Your data never leaves your machine
- **Open Source**: Full control over your AI

## 🎤 Voice Input

- Click the **🎤 Mic** button to toggle continuous listening
- Speak naturally - phrases are appended together
- Button pulses when actively listening
- Speech recognition runs in browser (Web Speech API)

## 👥 Multi-Companion Support

Create multiple AI companions with different personalities:

1. Click **➕ New** to create a companion
2. Set name and personality traits:
   - Warmth (0-100)
   - Humor (0-100)
   - Intelligence (0-100)
   - Mystery (0-100)
   - Ambition (0-100)
3. Start chatting!

## 📅 Calendar Sync

Companions can be aware of your schedule:

1. Click **📅 Calendar**
2. Select provider (Google, Outlook, Apple, iCal)
3. Configure privacy settings
4. Companion will reference your events

## 🐛 Troubleshooting

### Ollama not starting
```bash
# Check Docker
docker ps

# Check if port 11434 is in use
lsof -i :11434

# Clean up old containers
docker rm -f ollama
```

### Flask app not responding
```bash
# Check logs
tail -f app.log

# Kill hanging processes
pkill -9 -f "python.*app.py"

# Restart
python3 app.py
```

### Slow responses
- LLM response time depends on model size and CPU
- Smaller models (phi, orca-mini) are faster
- More RAM = faster processing
- GPU acceleration can be enabled with compatible hardware

### Voice recognition not working
- Check browser permissions for microphone
- Works best in Chrome, Edge, Safari
- Firefox has limited support
- Requires HTTPS in production (HTTP OK for localhost)

## 📚 Architecture

```
Web Browser (localhost:5000)
    ↓
Flask API (Python)
    ↓
AI Handler (Unified interface)
    ↓
Ollama Client → Ollama Container → Local LLM Model
```

All communication is local - no internet required.

## 🔄 Data Flow (All Local)

1. User types/speaks message
2. Browser sends to Flask API
3. Flask enriches with context (emotion, companion personality)
4. Unified AI Handler routes to Ollama
5. Ollama generates response locally
6. Response sent back to browser
7. Relationship & memories updated locally

## 📖 Configuration

Environment variables (optional):
```bash
export OLLAMA_URL=http://localhost:11434
export FLASK_DEBUG=True
export PORT=5000
```

## 🚦 Status Indicators

- 🟢 **Green**: Full on-device AI working
- 🟡 **Yellow**: Fallback mode (Ollama unavailable)
- 🔴 **Red**: Service error

Check status at: http://localhost:5000/api/ai/status

## 📝 Logs

```bash
# Flask app logs
tail -f app.log

# Ollama logs
docker logs ollama -f
```

## 🎓 Learning & Customization

Companions learn from interactions:
- Relationship levels tracked
- Emotional context stored
- Memory of past conversations
- Personality influences responses

Customize companion personalities by editing traits.

## 🤝 Integration

### Pull from Other Apps
The Flask API is fully RESTful - integrate with:
- Discord bots
- Telegram bots
- Custom applications
- Smart home systems

All endpoints are at `/api/companion/*` and `/api/ai/*`

## 📦 Files Structure

```
.
├── app.py                    # Flask entry point
├── start_ai_companion.sh     # Startup script (this file)
├── src/
│   ├── ai/
│   │   ├── ai_client.py      # Unified AI interface
│   │   ├── ollama_client.py  # Ollama integration
│   │   ├── companion.py      # Companion personality
│   │   └── emotion_*.py      # Emotion detection
│   ├── api/
│   │   ├── routes.py         # Core API routes
│   │   └── companion_routes.py # Companion endpoints
│   ├── config/
│   │   └── companion_memory.py # Memory management
│   ├── database/
│   │   └── db.py             # Local database
│   └── static/
│       └── companion_app.html # Web UI
└── .companions/              # Saved companions & memories
```

## 🎯 Next Steps

1. **First Run**: Open http://localhost:5000
2. **Create Companion**: Click ➕ New
3. **Start Chatting**: Begin your conversation
4. **Enable Features**: Turn on voice, emotion, calendar as needed
5. **Customize**: Edit traits to match your preferences

## 💬 Support

Check logs for detailed error information:
```bash
curl http://localhost:5000/api/ai/status | python3 -m json.tool
```

---

**Privacy First, AI Everywhere** 🔒🤖
