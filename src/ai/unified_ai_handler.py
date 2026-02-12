"""
Unified AI Response Handler
Manages mood-based responses from Local (Ollama) or Cloud (API, Emotion AI)
"""

from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import logging

from ..config.ai_config import AIProvider, get_ai_config_manager, get_current_config
from .ollama_client import OllamaClient, OllamaResponse

logger = logging.getLogger(__name__)


class ResponseMode(Enum):
    """Response generation mode"""
    LOCAL_OLLAMA = "local"
    CLOUD_API = "cloud"
    LOCAL_EMOTION_AI = "emotion_ai"


@dataclass
class MoodBasedResponse:
    """Unified response from any AI provider"""
    text: str
    mood: str
    confidence: float = 1.0
    mode: ResponseMode = ResponseMode.LOCAL_OLLAMA
    model: str = ""
    tokens: int = 0
    success: bool = True
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'text': self.text,
            'mood': self.mood,
            'confidence': self.confidence,
            'mode': self.mode.value,
            'model': self.model,
            'tokens': self.tokens,
            'success': self.success,
            'error': self.error
        }


class UnifiedAIHandler:
    """Handle AI responses from multiple providers"""
    
    def __init__(self, config=None):
        """Initialize handler"""
        self.config = config or get_current_config()
        self.ollama_client: Optional[OllamaClient] = None
        self._initialize_ollama()
    
    def _initialize_ollama(self):
        """Initialize Ollama client if configured"""
        if self.config.provider in [
            AIProvider.LOCAL_OLLAMA, 
            AIProvider.HYBRID
        ]:
            try:
                self.ollama_client = OllamaClient(
                    host=self.config.ollama_host,
                    model=self.config.ollama_model,
                    timeout=self.config.timeout
                )
            except Exception as e:
                logger.error(f"Failed to initialize Ollama: {e}")
    
    def generate_mood_response(self, mood: str, context: Optional[str] = None,
                              confidence: float = 1.0) -> MoodBasedResponse:
        """
        Generate mood-based response using configured AI provider
        
        Args:
            mood: Detected mood (happy, sad, angry, etc.)
            context: Optional context/situation description
            confidence: Mood confidence score
        
        Returns:
            MoodBasedResponse from the AI provider
        """
        # Try local Ollama first if hybrid mode or local-only
        if self.config.use_local_first and self.ollama_client:
            try:
                return self._generate_with_ollama(mood, context, confidence)
            except Exception as e:
                logger.warning(f"Ollama generation failed: {e}")
                if not self.config.fallback_to_cloud:
                    return MoodBasedResponse(
                        text="",
                        mood=mood,
                        success=False,
                        error=str(e),
                        mode=ResponseMode.LOCAL_OLLAMA
                    )
        
        # Fallback to cloud API or emotion AI
        try:
            return self._generate_with_cloud(mood, context, confidence)
        except Exception as e:
            logger.error(f"Cloud generation failed: {e}")
            return MoodBasedResponse(
                text="",
                mood=mood,
                success=False,
                error=str(e),
                mode=ResponseMode.CLOUD_API
            )
    
    def _generate_with_ollama(self, mood: str, context: Optional[str],
                             confidence: float) -> MoodBasedResponse:
        """Generate response using Ollama"""
        if not self.ollama_client:
            raise Exception("Ollama client not initialized")
        
        # Build system prompt based on mood
        system_prompt = self._build_system_prompt(mood)
        
        # Build user prompt
        user_prompt = f"Context: {context}" if context else "No additional context."
        
        # Generate
        ollama_response = self.ollama_client.chat(
            messages=[
                {"role": "user", "content": user_prompt}
            ],
            system=system_prompt,
            temperature=self.config.temperature
        )
        
        if not ollama_response.success:
            raise Exception(ollama_response.error)
        
        return MoodBasedResponse(
            text=ollama_response.text,
            mood=mood,
            confidence=confidence,
            mode=ResponseMode.LOCAL_OLLAMA,
            model=self.ollama_client.model,
            tokens=ollama_response.tokens_used,
            success=True
        )
    
    def _generate_with_cloud(self, mood: str, context: Optional[str],
                            confidence: float) -> MoodBasedResponse:
        """Generate response using cloud API or emotion AI"""
        try:
            # Try to use existing emotion AI system
            from src.ai.emotion_responses import get_emotion_response_generator
            
            generator = get_emotion_response_generator()
            response = generator.generate_response(
                emotion=mood,
                confidence=confidence,
                is_recurring=False,
                context=context
            )
            
            return MoodBasedResponse(
                text=response.response,
                mood=mood,
                confidence=confidence,
                mode=ResponseMode.LOCAL_EMOTION_AI,
                model="emotion_ai_system",
                tokens=0,
                success=True
            )
        except Exception as e:
            logger.error(f"Emotion AI generation failed: {e}")
            raise
    
    def _build_system_prompt(self, mood: str) -> str:
        """Build system prompt based on mood"""
        mood_prompts = {
            'happy': """You are a supportive AI assistant helping a person who is feeling happy and positive.
Your tone should match their energy: uplifting, encouraging, and enthusiastic.
Suggest positive, constructive activities that build on their good mood.
Be authentic and genuine in your responses.""",
            
            'sad': """You are a compassionate AI assistant helping someone who is feeling sad.
Your tone should be warm, understanding, and supportive without being patronizing.
Acknowledge their feelings as valid.
Suggest gentle, restorative activities or provide emotional support.
Avoid toxic positivity - let them know it's okay to feel down.""",
            
            'angry': """You are a calm, grounding AI assistant helping someone experiencing anger.
Your tone should be respectful and non-judgmental.
Help them understand and process their feelings productively.
Suggest physical or creative outlets for their energy.
Avoid being dismissive of their anger.""",
            
            'fear': """You are a reassuring AI assistant helping someone who is anxious or fearful.
Your tone should be calm and grounding.
Help break down what they're worried about into manageable pieces.
Provide practical steps to address their concerns.
Remind them of their capability and resilience.""",
            
            'surprise': """You are an engaging AI assistant helping someone process surprising news or events.
Your tone should be curious and open.
Help them explore what this means for them.
Ask clarifying questions to understand their perspective.
Be flexible - surprises can be positive or negative.""",
            
            'neutral': """You are a helpful, straightforward AI assistant.
Your tone should be balanced and professional.
Help the person focus on their tasks or goals.
Provide practical suggestions and clear guidance.
Be efficient and direct."""
        }
        
        return mood_prompts.get(mood, mood_prompts['neutral'])
    
    def test_ollama_connection(self) -> Dict[str, Any]:
        """Test Ollama connection and report status"""
        if not self.ollama_client:
            return {
                'connected': False,
                'error': 'Ollama client not initialized'
            }
        
        health = self.ollama_client.health_check()
        return {
            'connected': health['status'] == 'healthy',
            'host': health.get('host'),
            'models': health.get('models', []),
            'current_model': health.get('current_model'),
            'status': health.get('status'),
            'error': health.get('error')
        }
    
    def switch_provider(self, provider: AIProvider) -> bool:
        """Switch to different AI provider"""
        try:
            self.config.provider = provider
            if provider in [AIProvider.LOCAL_OLLAMA, AIProvider.HYBRID]:
                self._initialize_ollama()
            return True
        except Exception as e:
            logger.error(f"Failed to switch provider: {e}")
            return False


# Singleton instance
_handler: Optional[UnifiedAIHandler] = None


def get_unified_ai_handler() -> UnifiedAIHandler:
    """Get or create global AI handler"""
    global _handler
    if _handler is None:
        _handler = UnifiedAIHandler()
    return _handler
