# 🤖 AI Companion - Node.js Backend

A clean, modular Node.js/Express backend for the AI Companion application. Features local Ollama integration, emotion detection, camera monitoring, and geolocation awareness.

## ✨ Features

- **🧠 Local AI Integration**: Uses Ollama for on-device AI (no cloud calls)
- **❤️ Emotion Detection**: Facial emotion recognition and text sentiment analysis
- **📷 Camera Monitoring**: Real-time camera access and frame capture
- **📍 Geolocation Awareness**: Context-aware companion responses
- **🔒 Privacy-First**: All data stays local on your device
- **⚡ Fast & Modular**: Express.js with clean route-based architecture
- **🎯 Stateless Sessions**: Browser-based state with server backing

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 14.0.0
- **npm** ≥ 6.0.0
- **Ollama** running on localhost:11434
- **Firefox** (or Chrome/Edge for full feature support)

### Installation

```bash
# Navigate to project directory
cd building-management-ai

# Install Node.js dependencies
npm install

# Copy environment template and configure
cp .env.example .env

# Optional: Install frontend dependencies
npm run install-all
```

### Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000`

## 📁 Project Structure

```
├── server.js                    # Main Express app
├── package.json                 # Dependencies
├── .env.example                 # Environment template
│
├── src/
│   ├── routes/
│   │   ├── auth.js             # User authentication
│   │   ├── companion.js        # Companion chat & management
│   │   ├── ai.js               # Ollama integration
│   │   ├── vision.js           # Camera & vision
│   │   └── emotion.js          # Emotion detection
│   │
│   ├── static/
│   │   ├── companion_app.html  # Main UI
│   │   ├── index.html          # Dashboard
│   │   └── styles.css          # Styling
│   │
│   └── frontend/               # React app (optional)
│       ├── vite.config.js
│       └── src/
│
└── data/
    └── companion.db            # SQLite database (optional)
```

## 🔌 API Endpoints

### Authentication

```
POST   /api/auth/register        Register user
POST   /api/auth/login           Login user
POST   /api/auth/logout          Logout user
GET    /api/auth/me              Get current user
```

### Companion

```
POST   /api/companion/create     Create new companion
GET    /api/companion/list       List companions
GET    /api/companion/info/:id   Get companion info
PUT    /api/companion/update/:id Update companion
POST   /api/companion/chat       Chat with companion
GET    /api/companion/greeting/:id/:userId  Get greeting
```

### AI & Ollama

```
GET    /api/ai/status            Ollama status
GET    /api/ai/health            Server health
GET    /api/ai/models            List models
POST   /api/ai/generate          Generate text
POST   /api/ai/embeddings        Generate embeddings
```

### Vision & Camera

```
GET    /api/vision/cameras       List cameras
POST   /api/vision/start         Start monitoring
POST   /api/vision/stop          Stop monitoring
GET    /api/vision/frame         Get current frame
POST   /api/vision/capture       Capture frame
```

### Emotion

```
POST   /api/emotion/frame-analysis      Analyze face emotion
POST   /api/emotion/analyze             Analyze text emotion
GET    /api/emotion/status              Emotion system status
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
# Server
NODE_ENV=development
PORT=5000

# Ollama
OLLAMA_BASE=http://localhost:11434
OLLAMA_MODEL=mistral

# Session
SESSION_SECRET=your-secure-secret
CORS_ORIGIN=http://localhost:5000
```

### Ollama Setup

Make sure Ollama is running:

```bash
# Start Ollama (if not already running)
ollama serve

# In another terminal, pull a model
ollama pull mistral
ollama pull nomic-embed-text
```

## 🎨 Frontend Integration

The Node.js backend serves the existing HTML frontend. For development:

```bash
# Terminal 1: Start Node.js backend
npm run dev

# Terminal 2 (optional): Start React dev server
npm run frontend:dev
```

Both serve from `http://localhost:5000` (Node acts as reverse proxy).

## 📊 Browser Permissions

The app requires browser permissions for:

- 📍 **Location**: Click the location indicator in header
- 🎥 **Camera**: Granted when clicking "Start" in Camera modal
- 🎤 **Microphone**: Granted when using Voice input
- 🔔 **Notifications**: Optional for alerts

## 🐛 Debugging

### View Server Logs

```bash
# Shows all requests and errors in terminal
tail -f console.log
```

### Check Browser Console

Press `F12` in Firefox to open Developer Tools:

- **Console**: Shows JS errors and device enumeration
- **Network**: Shows all API calls
- **Storage**: Shows cookies and local storage

### Test Endpoints

```bash
# Test AI status
curl http://localhost:5000/api/ai/status

# List cameras
curl http://localhost:5000/api/vision/cameras

# Create companion
curl -X POST http://localhost:5000/api/companion/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Anita"}'
```

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Update `CORS_ORIGIN` to your domain
- [ ] Generate secure `SESSION_SECRET`
- [ ] Use HTTPS (required for camera/location)
- [ ] Set up database (PostgreSQL recommended)
- [ ] Configure reverse proxy (Nginx/Apache)
- [ ] Set resource limits for Ollama

### Example Nginx Config

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📚 Code Organization

### Routes Pattern

Each route file follows this pattern:

```javascript
const express = require('express');
const router = express.Router();

/**
 * GET /api/example/path
 * Description of endpoint
 */
router.get('/path', (req, res) => {
  res.json({
    success: true,
    data: {}
  });
});

module.exports = router;
```

### Error Handling

The server uses consistent error responses:

```json
{
  "success": false,
  "error": "Descriptive error message",
  "details": "Additional context if in development mode"
}
```

## 🤝 Performance Tips

1. **Enable Caching**: Add Redis for session storage
2. **Connection Pooling**: Use database connection pools
3. **Compression**: Enable gzip middleware
4. **Rate Limiting**: Protect against abuse
5. **Load Balancing**: Use PM2 for multi-core usage

```bash
npm install -g pm2
pm2 start server.js -i max
pm2 logs
```

## 🐛 Troubleshooting

### "Cannot connect to Ollama"
- Ensure Ollama is running: `ollama serve`
- Check port: `netstat -an | grep 11434`

### "Camera not found"
- Browser needs HTTPS (except localhost)
- Check permissions: Allow camera in address bar
- Test with: `navigator.mediaDevices.getUserMedia({video: true})`

### "Port already in use"
```bash
# Find process using port 5000
lsof -i :5000
# Kill it
kill -9 <PID>
# Or use different port
PORT=5001 npm start
```

### "CORS errors"
- Check CORS_ORIGIN in .env
- Ensure it matches your access URL (with protocol)

## 📖 Additional Resources

- [Express.js Docs](https://expressjs.com/)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)

## 📝 License

MIT - See LICENSE file for details

---

**Last Updated**: February 2025  
**Node.js Version**: ≥14.0.0  
**Maintainer**: AI Companion Team
