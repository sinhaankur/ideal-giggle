/**
 * AI Companion Server - Node.js/Express Backend
 * Handles chat, camera, emotion detection, and companion management
 */

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const companionRoutes = require('./src/routes/companion');
const aiRoutes = require('./src/routes/ai');
const visionRoutes = require('./src/routes/vision');
const emotionRoutes = require('./src/routes/emotion');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================================================
// Middleware Configuration
// ============================================================================

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files
app.use('/static', express.static(path.join(__dirname, 'src/static')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ============================================================================
// Logging Middleware
// ============================================================================

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ============================================================================
// API Routes
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/companion', companionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/emotion', emotionRoutes);

// ============================================================================
// Frontend Routes - Building AI Ecosystem
// ============================================================================
// 1. buildingai.cloud (main website)  → /
// 2. ai.buildingai.cloud (Open WebUI) → external
// 3. Empathy AI (Camera & Audio)      → /empathy

// Main website - Building Management AI Dashboard (buildingai.cloud)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/static/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/static/index.html'));
});

// Empathy AI - Camera & Audio tool (branched from main site)
app.get('/empathy', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/static/companion_app_empathy.html'));
});

// Companion variants
app.get('/companion', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/static/companion_app.html'));
});

app.get('/advanced', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/static/companion_app_advanced.html'));
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         🤖 AI Companion - Node.js Backend Server              ║
║                                                                ║
║  🌐 Server running on:                                         ║
║     http://localhost:${PORT}                                    ║
║                                                                ║
║  ✨ Features:                                                  ║
║     • Local Ollama Integration (Port 11434)                   ║
║     • Privacy-First - All data stays local                    ║
║     • Real-time chat & emotion detection                      ║
║     • Camera monitoring & vision AI                           ║
║     • Geolocation context awareness                           ║
║                                                                ║
║  🔌 API Endpoints:                                             ║
║     • POST /api/companion/chat     - Chat with AI             ║
║     • POST /api/companion/create   - Create companion         ║
║     • GET  /api/ai/status          - AI health                ║
║     • GET  /api/vision/cameras     - List cameras             ║
║     • POST /api/emotion/analyze    - Emotion detection        ║
║                                                                ║
║  📚 Environment: ${NODE_ENV}                                    ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
