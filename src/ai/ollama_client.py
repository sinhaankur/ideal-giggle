"""
Ollama Local AI Integration
Provides interface to local Ollama instances for private AI capabilities
"""

import requests
import json
from typing import Optional, Dict, Any, Generator
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class OllamaResponse:
    """Response from Ollama"""
    text: str
    model: str
    tokens_used: int = 0
    duration_ms: int = 0
    success: bool = True
    error: Optional[str] = None


class OllamaClient:
    """Interface to local Ollama AI"""
    
    def __init__(self, host: str = "http://localhost:11434", 
                 model: str = "neural-chat",
                 timeout: int = 30):
        """
        Initialize Ollama client
        
        Args:
            host: Ollama server URL
            model: Model name to use
            timeout: Request timeout in seconds
        """
        self.host = host
        self.model = model
        self.timeout = timeout
        self.is_available = False
        self._check_availability()
    
    def _check_availability(self) -> bool:
        """Check if Ollama server is available"""
        try:
            response = requests.get(
                f"{self.host}/api/tags",
                timeout=5
            )
            self.is_available = response.status_code == 200
            return self.is_available
        except Exception as e:
            logger.warning(f"Ollama not available at {self.host}: {e}")
            self.is_available = False
            return False
    
    def health_check(self) -> Dict[str, Any]:
        """Check Ollama server health"""
        if not self._check_availability():
            return {
                'status': 'unavailable',
                'host': self.host,
                'error': 'Connection failed'
            }
        
        try:
            response = requests.get(
                f"{self.host}/api/tags",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'healthy',
                    'host': self.host,
                    'models': [m['name'] for m in data.get('models', [])],
                    'current_model': self.model
                }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
        
        return {
            'status': 'unhealthy',
            'host': self.host,
            'error': 'Unknown error'
        }
    
    def list_models(self) -> list:
        """Get list of available models"""
        try:
            response = requests.get(
                f"{self.host}/api/tags",
                timeout=self.timeout
            )
            if response.status_code == 200:
                data = response.json()
                return [m['name'] for m in data.get('models', [])]
        except Exception as e:
            logger.error(f"Error listing models: {e}")
        return []
    
    def generate(self, prompt: str, stream: bool = False,
                 system: Optional[str] = None,
                 temperature: float = 0.7,
                 top_p: float = 0.9,
                 top_k: int = 40,
                 num_predict: int = 512) -> OllamaResponse:
        """
        Generate response from Ollama
        
        Args:
            prompt: Input prompt
            stream: Whether to stream response
            system: System prompt/instruction
            temperature: Randomness (0-1)
            top_p: Nucleus sampling
            top_k: Top-k sampling
            num_predict: Max tokens to generate
        
        Returns:
            OllamaResponse with generated text
        """
        if not self.is_available:
            logger.warning(f"Ollama not available, cannot generate")
            return OllamaResponse(
                text="",
                model=self.model,
                success=False,
                error="Ollama not available"
            )
        
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": stream,
                "temperature": temperature,
                "top_p": top_p,
                "top_k": top_k,
                "num_predict": num_predict
            }
            
            if system:
                payload["system"] = system
            
            response = requests.post(
                f"{self.host}/api/generate",
                json=payload,
                timeout=self.timeout,
                stream=stream
            )
            
            if response.status_code != 200:
                return OllamaResponse(
                    text="",
                    model=self.model,
                    success=False,
                    error=f"HTTP {response.status_code}"
                )
            
            if stream:
                return self._handle_streaming_response(response)
            else:
                data = response.json()
                return OllamaResponse(
                    text=data.get('response', ''),
                    model=self.model,
                    tokens_used=data.get('eval_count', 0),
                    duration_ms=data.get('total_duration', 0) // 1_000_000,
                    success=True
                )
        
        except requests.Timeout:
            return OllamaResponse(
                text="",
                model=self.model,
                success=False,
                error="Request timeout"
            )
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return OllamaResponse(
                text="",
                model=self.model,
                success=False,
                error=str(e)
            )
    
    def _handle_streaming_response(self, response) -> OllamaResponse:
        """Handle streaming response"""
        text_parts = []
        total_tokens = 0
        
        try:
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    text_parts.append(data.get('response', ''))
                    total_tokens += data.get('eval_count', 0)
            
            return OllamaResponse(
                text=''.join(text_parts),
                model=self.model,
                tokens_used=total_tokens,
                success=True
            )
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            return OllamaResponse(
                text=''.join(text_parts),
                model=self.model,
                success=False,
                error=str(e)
            )
    
    def chat(self, messages: list, stream: bool = False,
             system: Optional[str] = None,
             temperature: float = 0.7) -> OllamaResponse:
        """
        Multi-turn conversation interface
        
        Args:
            messages: List of {"role": "user"/"assistant", "content": "..."}
            stream: Stream response
            system: System prompt
            temperature: Randomness
        
        Returns:
            OllamaResponse
        """
        if not self.is_available:
            return OllamaResponse(
                text="",
                model=self.model,
                success=False,
                error="Ollama not available"
            )
        
        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": stream,
                "temperature": temperature
            }
            
            if system:
                payload["system"] = system
            
            response = requests.post(
                f"{self.host}/api/chat",
                json=payload,
                timeout=self.timeout,
                stream=stream
            )
            
            if response.status_code != 200:
                return OllamaResponse(
                    text="",
                    model=self.model,
                    success=False,
                    error=f"HTTP {response.status_code}"
                )
            
            if stream:
                return self._handle_streaming_chat_response(response)
            else:
                data = response.json()
                message = data.get('message', {})
                return OllamaResponse(
                    text=message.get('content', ''),
                    model=self.model,
                    tokens_used=data.get('eval_count', 0),
                    success=True
                )
        
        except Exception as e:
            logger.error(f"Chat error: {e}")
            return OllamaResponse(
                text="",
                model=self.model,
                success=False,
                error=str(e)
            )
    
    def _handle_streaming_chat_response(self, response) -> OllamaResponse:
        """Handle streaming chat response"""
        text_parts = []
        
        try:
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    message = data.get('message', {})
                    text_parts.append(message.get('content', ''))
            
            return OllamaResponse(
                text=''.join(text_parts),
                model=self.model,
                success=True
            )
        except Exception as e:
            logger.error(f"Streaming chat error: {e}")
            return OllamaResponse(
                text=''.join(text_parts),
                model=self.model,
                success=False,
                error=str(e)
            )
    
    def pull_model(self, model: str) -> bool:
        """Download/pull a model"""
        try:
            response = requests.post(
                f"{self.host}/api/pull",
                json={"name": model},
                timeout=300  # Long timeout for downloads
            )
            if response.status_code in [200, 201]:
                self.model = model
                return True
        except Exception as e:
            logger.error(f"Model pull error: {e}")
        return False


def get_ollama_client(host: str = "http://localhost:11434",
                     model: str = "neural-chat") -> OllamaClient:
    """Factory function to get Ollama client"""
    return OllamaClient(host, model)
