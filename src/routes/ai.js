/**
 * AI Integration Routes
 * Ollama status, model management, health checks
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434';

/**
 * GET /api/ai/status
 * Get Ollama AI status
 */
router.get('/status', async (req, res) => {
  try {
    // Try to connect to Ollama
    const response = await axios.get(`${OLLAMA_BASE}/api/tags`, {
      timeout: 5000
    });

    const models = response.data.models || [];
    const isRunning = models.length > 0;

    res.json({
      success: true,
      ollama: {
        status: isRunning ? 'running' : 'idle',
        version: response.data.version || 'unknown',
        models_available: models.length,
        models: models.map(m => ({
          name: m.name,
          size: m.size,
          digest: m.digest
        }))
      },
      backend: {
        status: 'running',
        type: 'node.js',
        version: 'v1.0'
      }
    });
  } catch (error) {
    console.warn('Ollama status check failed:', error.message);

    res.json({
      success: true,
      ollama: {
        status: 'offline',
        message: 'Unable to reach Ollama service. Make sure it\'s running on ' + OLLAMA_BASE,
        error: error.message
      },
      backend: {
        status: 'running',
        type: 'node.js'
      }
    });
  }
});

/**
 * GET /api/ai/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/ai/models
 * List available models
 */
router.get('/models', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_BASE}/api/tags`, {
      timeout: 10000
    });

    const models = response.data.models || [];

    res.json({
      success: true,
      models: models.map(m => ({
        name: m.name,
        size: m.size,
        digest: m.digest,
        modified_at: m.modified_at,
        model: m.model
      })),
      count: models.length
    });
  } catch (error) {
    console.error('Models list error:', error.message);

    res.status(503).json({
      success: false,
      error: 'Unable to fetch models from Ollama',
      details: error.message
    });
  }
});

/**
 * POST /api/ai/generate
 * Generate text using Ollama
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, model, system, temperature = 0.7 } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const selectedModel = model || process.env.OLLAMA_MODEL || 'mistral';

    const response = await axios.post(`${OLLAMA_BASE}/api/generate`, {
      model: selectedModel,
      prompt,
      system,
      stream: false,
      temperature,
      top_p: 0.9,
      top_k: 40
    }, {
      timeout: 60000
    });

    res.json({
      success: true,
      response: response.data.response,
      model: selectedModel,
      done: response.data.done,
      eval_count: response.data.eval_count
    });
  } catch (error) {
    console.error('Generation error:', error.message);

    res.status(503).json({
      success: false,
      error: 'Failed to generate response',
      details: error.message
    });
  }
});

/**
 * POST /api/ai/embeddings
 * Generate embeddings using Ollama
 */
router.post('/embeddings', async (req, res) => {
  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const selectedModel = model || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

    const response = await axios.post(`${OLLAMA_BASE}/api/embeddings`, {
      model: selectedModel,
      prompt
    }, {
      timeout: 30000
    });

    res.json({
      success: true,
      embedding: response.data.embedding,
      model: selectedModel
    });
  } catch (error) {
    console.error('Embeddings error:', error.message);

    res.status(503).json({
      success: false,
      error: 'Failed to generate embeddings',
      details: error.message
    });
  }
});

module.exports = router;
