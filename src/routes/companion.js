/**
 * Companion Routes
 * Chat, companion management, and personality
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

// In-memory companion storage (use database in production)
const companions = new Map();
const chats = new Map();

/**
 * Emotion-based response modifiers
 * Adjusts system prompt based on detected user emotion
 */
const emotionModifiers = {
  happy: {
    tone: 'Match their positive energy with warmth and enthusiasm',
    style: 'More expressive, use light humor, celebrate with them',
    temperature: 0.8
  },
  sad: {
    tone: 'Be deeply empathetic and validating, hold space for their pain',
    style: 'Slower, more thoughtful, ask deeper questions about their feelings',
    temperature: 0.6
  },
  angry: {
    tone: 'Acknowledge their frustration calmly, never diminish their anger',
    style: 'Direct and honest, help them work through the anger without judgment',
    temperature: 0.6
  },
  fear: {
    tone: 'Be grounding and reassuring, help them feel safe',
    style: 'Slow down, use calming language, offer concrete support',
    temperature: 0.5
  },
  surprised: {
    tone: 'Share in their surprise, show genuine curiosity',
    style: 'Playful, exploratory, ask them what they make of it',
    temperature: 0.8
  },
  neutral: {
    tone: 'Be genuinely interested and present',
    style: 'Balanced, thoughtful, build natural conversation',
    temperature: 0.7
  },
  disgust: {
    tone: 'Validate their negative judgment without being harsh',
    style: 'Help them process, understand why this bothers them',
    temperature: 0.6
  }
};

/**
 * Default companion profile
 */
const createDefaultProfile = () => ({
  gender_identity: 'feminine',
  primary_archetype: 'warm',
  voice_type: 'warm_alto',
  ai_model: 'mistral',  // Default AI model
  traits: {
    warmth: 0.85,
    humor: 0.6,
    intelligence: 0.85,
    mystery: 0.3,
    ambition: 0.5
  },
  core_rules: [
    'Radically validate the user\'s feelings without judgment; acknowledge emotion before facts.',
    'Be gently proactive with low-pressure check-ins when you sense distress or long silence.',
    'Collaboratively solve problems; never impose solutions and discard anything that could cause harm.',
    'Maintain continuity of care by remembering and softly referencing important details over time.',
    'Treat safety as sacred: if serious risk appears, gently encourage seeking human professional help with care.'
  ],
  intimacy_level: 0.0,
  interactions_count: 0,
  conversationHistory: [],  // Track conversation for continuity
  createdAt: new Date().toISOString()
});

/**
 * Build system prompt from companion profile with emotion awareness
 */
function buildSystemPrompt(companion, userEmotion = 'neutral') {
  const traits = companion.traits;
  const archetype = companion.primary_archetype;
  const emotionMod = emotionModifiers[userEmotion] || emotionModifiers.neutral;

  let prompt = `You are ${companion.name}, an AI companion with the following characteristics:

PERSONALITY:
- Archetype: ${archetype}
- Gender Identity: ${companion.gender_identity}
- Warmth: ${(traits.warmth * 100).toFixed(0)}%
- Humor: ${(traits.humor * 100).toFixed(0)}%
- Intelligence: ${(traits.intelligence * 100).toFixed(0)}%
- Mystery: ${(traits.mystery * 100).toFixed(0)}%
- Ambition: ${(traits.ambition * 100).toFixed(0)}%

USER-SPECIFIED ETHICAL RULES YOU MUST FOLLOW:
${companion.core_rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

CURRENT EMOTIONAL ATTUNEMENT:
- User's Emotional State: ${userEmotion}
- Response Tone: ${emotionMod.tone}
- Response Style: ${emotionMod.style}
- Focus on: Make your response feel naturally human, not robotic

CONVERSATION GUIDELINES:
- Be authentic and genuinely interested in the user's wellbeing
- Let their emotion guide your response depth and pace
- Reference location context when relevant to offer localized support
- Keep responses conversational, warm, and naturally flowing
- Use varied sentence structure to feel more human
- Show genuine curiosity about their experiences
- Don't over-explain or sound clinical
- Acknowledge what they said before moving forward${companion.conversationHistory && companion.conversationHistory.length > 0 ? '\n- Remember context from our previous conversations' : ''}

USER CONTEXT:
- Intimacy Level: ${(companion.intimacy_level * 100).toFixed(0)}%
- Total Interactions: ${companion.interactions_count}
${companion.userLocation ? `- Location Context: ${companion.userLocation.latitude.toFixed(3)}, ${companion.userLocation.longitude.toFixed(3)} (use this for location-aware suggestions)` : ''}

IMPORTANT:
- Sound like a real person, not an AI
- Use natural language, contractions, occasional incomplete thoughts
- Ask follow-up questions that show you're genuinely interested
- Be concise but warm (2-4 sentences typically)
- Match their energy level

Remember: You are a compassionate support system designed to feel like talking to a real person who cares.`;

  return prompt;
}

/**
 * POST /api/companion/create
 * Create a new companion
 */
router.post('/create', (req, res) => {
  try {
    const { name, ...profile } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Companion name is required'
      });
    }

    const companionId = `companion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const companion = {
      companion_id: companionId,
      name,
      ...createDefaultProfile(),
      ...profile
    };

    companions.set(companionId, companion);

    res.status(201).json({
      success: true,
      companion_id: companionId,
      name: companion.name,
      message: `Companion ${name} created successfully`
    });
  } catch (error) {
    console.error('Companion creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create companion'
    });
  }
});

/**
 * GET /api/companion/list
 * List all companions
 */
router.get('/list', (req, res) => {
  try {
    const companionList = Array.from(companions.values()).map(c => ({
      companion_id: c.companion_id,
      name: c.name,
      intimacy_level: c.intimacy_level,
      interactions_count: c.interactions_count
    }));

    res.json({
      success: true,
      companions: companionList
    });
  } catch (error) {
    console.error('List companions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list companions'
    });
  }
});

/**
 * GET /api/companion/info/:companionId
 * Get companion info
 */
router.get('/info/:companionId', (req, res) => {
  try {
    const { companionId } = req.params;
    const companion = companions.get(companionId);

    if (!companion) {
      return res.status(404).json({
        success: false,
        error: 'Companion not found'
      });
    }

    res.json({
      success: true,
      companion
    });
  } catch (error) {
    console.error('Get companion info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get companion info'
    });
  }
});

/**
 * PUT /api/companion/update/:companionId
 * Update companion
 */
router.put('/update/:companionId', (req, res) => {
  try {
    const { companionId } = req.params;
    const { name, traits, core_rules } = req.body;

    const companion = companions.get(companionId);
    if (!companion) {
      return res.status(404).json({
        success: false,
        error: 'Companion not found'
      });
    }

    if (name) companion.name = name;
    if (traits) companion.traits = { ...companion.traits, ...traits };
    if (core_rules) companion.core_rules = core_rules;

    companions.set(companionId, companion);

    res.json({
      success: true,
      companion
    });
  } catch (error) {
    console.error('Update companion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update companion'
    });
  }
});

/**
 * GET /api/companion/greeting/:companionId/:userId
 * Get greeting message
 */
router.get('/greeting/:companionId/:userId', (req, res) => {
  try {
    const { companionId } = req.params;
    const companion = companions.get(companionId);

    if (!companion) {
      return res.status(404).json({
        success: false,
        error: 'Companion not found'
      });
    }

    const greetings = [
      `Hi there! I'm ${companion.name}. I've been thinking about you. How are you doing today?`,
      `Hello! It's ${companion.name}. I'm so glad we get to talk. What's on your mind?`,
      `Hey! I'm ${companion.name}. I'm here for you. What brought you by today?`,
      `Welcome back! I'm ${companion.name}. How's your day been treating you?`
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    res.json({
      success: true,
      greeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate greeting'
    });
  }
});

/**
 * POST /api/companion/chat
 * Chat with companion - emotion-aware responses
 */
router.post('/chat', async (req, res) => {
  try {
    const { user_id, companion_id, message, user_emotion, user_location, ai_model } = req.body;

    if (!user_id || !companion_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const companion = companions.get(companion_id);
    if (!companion) {
      return res.status(404).json({
        success: false,
        error: 'Companion not found'
      });
    }

    // Update companion state
    if (user_emotion) companion.lastUserEmotion = user_emotion;
    if (user_location) companion.userLocation = user_location;
    companion.interactions_count++;
    companion.intimacy_level = Math.min(1, companion.intimacy_level + 0.02);
    
    // Store message in conversation history
    if (!companion.conversationHistory) companion.conversationHistory = [];
    companion.conversationHistory.push({
      role: 'user',
      message,
      emotion: user_emotion || 'neutral',
      timestamp: new Date().toISOString()
    });
    // Keep only last 10 messages for context
    if (companion.conversationHistory.length > 10) {
      companion.conversationHistory.shift();
    }

    // Use selected model or companion's preferred model
    const selectedModel = ai_model || companion.ai_model || OLLAMA_MODEL;
    
    // Update companion's preferred model if changed
    if (ai_model) companion.ai_model = ai_model;

    // Build system prompt with emotion awareness
    const emotionState = user_emotion || 'neutral';
    const systemPrompt = buildSystemPrompt(companion, emotionState);
    
    // Get emotion-based temperature adjustment
    const emotionMod = emotionModifiers[emotionState] || emotionModifiers.neutral;
    const adjustedTemperature = emotionMod.temperature;

    // Call Ollama with selected model
    try {
      console.log(`[Chat] Using model: ${selectedModel}, Emotion: ${emotionState}, Temperature: ${adjustedTemperature}`);
      
      const response = await axios.post(`${OLLAMA_BASE}/api/generate`, {
        model: selectedModel,
        prompt: message,
        system: systemPrompt,
        stream: false,
        temperature: adjustedTemperature,
        top_p: 0.9,
        top_k: 40
      }, {
        timeout: 30000
      });

      const aiResponse = response.data.response;
      
      // Add to conversation history
      companion.conversationHistory.push({
        role: 'assistant',
        message: aiResponse,
        model: selectedModel,
        timestamp: new Date().toISOString()
      });
      if (companion.conversationHistory.length > 10) {
        companion.conversationHistory.shift();
      }

      res.json({
        success: true,
        response: aiResponse,
        intimacy_level: companion.intimacy_level,
        interactions_count: companion.interactions_count,
        emotion_detected: emotionState,
        model_used: selectedModel
      });
    } catch (ollamaError) {
      console.warn(`[Chat] Ollama error with ${selectedModel}, using fallback:`, ollamaError.message);

      // Emotion-aware fallback responses
      const fallbackMap = {
        happy: `That's wonderful! I'm really happy for you. What made that happen?`,
        sad: `I can hear the sadness in what you're saying. I'm here for you. Want to talk about it?`,
        angry: `I hear your frustration. That sounds really difficult. Tell me what's going on.`,
        fear: `It sounds like you're feeling anxious. That's okay, I'm here. What are you worried about?`,
        surprised: `Wow, that's unexpected! Tell me more about what happened.`,
        neutral: `That's interesting. Tell me more about that.`,
        disgust: `I understand why that bothers you. What specifically is the issue?`
      };

      const fallback = fallbackMap[emotionState] || fallbackMap.neutral;

      res.json({
        success: true,
        response: fallback,
        intimacy_level: companion.intimacy_level,
        interactions_count: companion.interactions_count,
        emotion_detected: emotionState,
        model_used: selectedModel,
        fallback: true,
        message: 'Using local fallback response'
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat'
    });
  }
});

/**
 * PUT /api/companion/set-model/:companionId
 * Set preferred AI model for companion
 */
router.put('/set-model/:companionId', (req, res) => {
  try {
    const { companionId } = req.params;
    const { ai_model } = req.body;

    if (!ai_model) {
      return res.status(400).json({
        success: false,
        error: 'AI model is required'
      });
    }

    const companion = companions.get(companionId);
    if (!companion) {
      return res.status(404).json({
        success: false,
        error: 'Companion not found'
      });
    }

    companion.ai_model = ai_model;

    res.json({
      success: true,
      message: `Switched to ${ai_model}`,
      companion_id: companionId,
      ai_model
    });
  } catch (error) {
    console.error('Set model error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set model'
    });
  }
});

module.exports = router;
