// Media Stream Server
// Node.js + Express + Socket.io with local-only protections

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
    ],
    methods: ['GET', 'POST'],
  },
});

// Configuration
const PORT = process.env.MEDIA_SERVER_PORT || 4100;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava';

// Cloud consent flag. When false, we do not send media buffers to any
// external cloud provider and we avoid logging raw binary data.
const CLOUD_CONSENT = process.env.CLOUD_CONSENT === 'true';

// Middleware
app.use(express.json({ limit: '25mb' }));

// --- Privacy + Local-only helpers -------------------------------------------------

function isLocalAddress(address) {
  if (!address) return false;
  // socket.io may include IPv6 mapped addresses like ::ffff:127.0.0.1
  if (address === '::1' || address === '127.0.0.1') return true;
  if (address.startsWith('::ffff:')) {
    const v4 = address.replace('::ffff:', '');
    if (v4 === '127.0.0.1') return true;
  }
  return false;
}

/**
 * Privacy guard wrapper for handlers that might push data to cloud APIs.
 * If CLOUD_CONSENT is false, the wrapped handler will not be executed.
 */
function withPrivacyGuard(handler, { requiresCloudConsent = false } = {}) {
  return async (...args) => {
    if (requiresCloudConsent && !CLOUD_CONSENT) {
      // Intentionally do not log raw payloads here.
      console.warn('[PrivacyGuard] Blocked cloud-bound media processing (no consent).');
      return;
    }
    return handler(...args);
  };
}

// --- Socket.io setup -------------------------------------------------------------

io.on('connection', (socket) => {
  const addr = socket.handshake.address;

  if (!isLocalAddress(addr) && !CLOUD_CONSENT) {
    console.warn('[MediaServer] Non-local client blocked by privacy rules:', addr);
    socket.disconnect(true);
    return;
  }

  console.log('[MediaServer] Client connected:', addr);

  // Audio streaming from frontend (Base64 string or Buffer-like)
  socket.on(
    'audio-stream',
    withPrivacyGuard((payload) => {
      // Expect payload: { chunk: <string|Buffer>, mimeType?: string, ts?: number }
      // We do NOT log the raw chunk; only metadata.
      const size = payload && payload.chunk
        ? (typeof payload.chunk === 'string' ? payload.chunk.length : payload.chunk.byteLength || 0)
        : 0;

      console.log('[MediaServer] Audio chunk received. bytes ~', size);

      // TODO: In-memory processing pipeline (e.g., VAD, transcription) can be
      // plugged in here as long as it stays local and does not leak to cloud
      // unless CLOUD_CONSENT is true.
    })
  );

  // Video / frame capture from frontend for AI analysis
  socket.on(
    'frame-capture',
    withPrivacyGuard((payload) => {
      // Expect payload: { imageBase64: string, ts?: number }
      if (!payload || !payload.imageBase64) return;

      // We keep frames in memory only; no disk writes here.
      console.log('[MediaServer] Frame received for analysis.');

      // Example: emit to a local processing pipeline (another service or worker)
      // that prefers not to deal with websockets directly.
      socket.broadcast.emit('frame-received', { ts: payload.ts || Date.now() });
    })
  );

  socket.on('disconnect', () => {
    console.log('[MediaServer] Client disconnected:', addr);
  });
});

// --- Ollama multimodal integration ----------------------------------------------

// Route to send a single captured frame to a local multimodal model (e.g. Llava)
// running via Ollama. This does not require CLOUD_CONSENT because all traffic
// stays on localhost.
app.post('/api/ollama/vision-analyze', async (req, res) => {
  try {
    const { image_base64: imageBase64, prompt } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'image_base64 is required' });
    }

    const body = {
      model: OLLAMA_MODEL,
      prompt: prompt || 'Describe what you see in this frame.',
      stream: false,
      images: [imageBase64],
    };

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Ollama] Non-OK response:', response.status, text.slice(0, 256));
      return res.status(502).json({ success: false, error: 'Ollama request failed' });
    }

    const result = await response.json();
    return res.json({ success: true, model: OLLAMA_MODEL, result });
  } catch (err) {
    console.error('[Ollama] Vision analyze error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal error talking to Ollama' });
  }
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ ok: true, cloudConsent: CLOUD_CONSENT });
});

server.listen(PORT, () => {
  console.log(`[MediaServer] listening on http://localhost:${PORT}`);
});
