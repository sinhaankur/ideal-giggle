"""
AI Client for Building Management AI
Supports multiple AI providers: Ollama, OpenAI, Anthropic, etc.
"""

import os
import json
import requests
from typing import Dict, List, Optional, Generator
from enum import Enum


class AIProvider(Enum):
    """Supported AI providers"""
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    CUSTOM = "custom"


class AIClient:
    """Unified AI client for multiple providers"""
    
    def __init__(
        self,
        provider: AIProvider = AIProvider.OLLAMA,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        Initialize AI Client
        
        Args:
            provider: AI provider to use
            api_key: API key for the provider (if required)
            base_url: Base URL for the API
            model: Model name to use
        """
        self.provider = provider
        self.api_key = api_key or os.getenv('AI_API_KEY')
        
        # Set default base URLs
        if base_url:
            self.base_url = base_url
        else:
            if provider == AIProvider.OLLAMA:
                self.base_url = os.getenv('OLLAMA_URL', 'http://localhost:11434')
            elif provider == AIProvider.OPENAI:
                self.base_url = 'https://api.openai.com/v1'
            elif provider == AIProvider.ANTHROPIC:
                self.base_url = 'https://api.anthropic.com/v1'
            else:
                self.base_url = base_url or 'http://localhost:11434'
        
        # Set default models
        if model:
            self.model = model
        else:
            if provider == AIProvider.OLLAMA:
                self.model = os.getenv('OLLAMA_MODEL', 'llama3.1:8b')
            elif provider == AIProvider.OPENAI:
                self.model = 'gpt-4'
            elif provider == AIProvider.ANTHROPIC:
                self.model = 'claude-3-sonnet-20240229'
            else:
                self.model = 'llama3.1:8b'
    
    def chat(
        self,
        message: str,
        context: Optional[List[Dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False
    ) -> Dict:
        """
        Send a chat message to the AI
        
        Args:
            message: User message
            context: Previous conversation context
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            
        Returns:
            AI response with message and metadata
        """
        if self.provider == AIProvider.OLLAMA:
            return self._chat_ollama(message, context, temperature, stream)
        elif self.provider == AIProvider.OPENAI:
            return self._chat_openai(message, context, temperature, max_tokens)
        elif self.provider == AIProvider.ANTHROPIC:
            return self._chat_anthropic(message, context, temperature, max_tokens)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
    
    def _chat_ollama(
        self,
        message: str,
        context: Optional[List[Dict]] = None,
        temperature: float = 0.7,
        stream: bool = False
    ) -> Dict:
        """Chat with Ollama"""
        url = f"{self.base_url}/api/chat"
        
        messages = []
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": message})
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream
        }
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            
            if stream:
                return self._handle_stream(response)
            
            data = response.json()
            return {
                "message": data.get("message", {}).get("content", ""),
                "model": data.get("model"),
                "done": data.get("done"),
                "context": data.get("context"),
                "provider": "ollama"
            }
        except Exception as e:
            return {
                "error": str(e),
                "message": "Sorry, I couldn't process your request.",
                "provider": "ollama"
            }
    
    def _chat_openai(
        self,
        message: str,
        context: Optional[List[Dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> Dict:
        """Chat with OpenAI"""
        url = f"{self.base_url}/chat/completions"
        
        messages = []
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": message})
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            return {
                "message": data["choices"][0]["message"]["content"],
                "model": data["model"],
                "usage": data.get("usage"),
                "provider": "openai"
            }
        except Exception as e:
            return {
                "error": str(e),
                "message": "Sorry, I couldn't process your request.",
                "provider": "openai"
            }
    
    def _chat_anthropic(
        self,
        message: str,
        context: Optional[List[Dict]] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> Dict:
        """Chat with Anthropic"""
        url = f"{self.base_url}/messages"
        
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        messages = []
        if context:
            messages.extend(context)
        messages.append({"role": "user", "content": message})
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            return {
                "message": data["content"][0]["text"],
                "model": data["model"],
                "usage": data.get("usage"),
                "provider": "anthropic"
            }
        except Exception as e:
            return {
                "error": str(e),
                "message": "Sorry, I couldn't process your request.",
                "provider": "anthropic"
            }
    
    def analyze_building_data(self, data: Dict) -> Dict:
        """
        Analyze building management data using AI
        
        Args:
            data: Building data to analyze
            
        Returns:
            AI analysis and recommendations
        """
        prompt = f"""
        Analyze the following building management data and provide insights:
        
        Data: {json.dumps(data, indent=2)}
        
        Please provide:
        1. Key observations
        2. Energy efficiency recommendations
        3. Potential issues or anomalies
        4. Optimization suggestions
        
        Format your response as JSON with keys: observations, recommendations, issues, optimizations
        """
        
        response = self.chat(prompt, temperature=0.3)
        return response
    
    def predict_energy_consumption(self, input_data: Dict) -> Dict:
        """
        Predict energy consumption based on input parameters
        
        Args:
            input_data: Input parameters (temperature, occupancy, time, etc.)
            
        Returns:
            Energy consumption prediction
        """
        prompt = f"""
        Based on the following building parameters, predict the energy consumption:
        
        Parameters: {json.dumps(input_data, indent=2)}
        
        Provide:
        1. Estimated energy consumption in kWh
        2. Confidence level (0-1)
        3. Key factors affecting consumption
        4. Recommendations to reduce consumption
        
        Format your response as JSON with keys: consumption_kwh, confidence, factors, recommendations
        """
        
        response = self.chat(prompt, temperature=0.2)
        return response
    
    def get_available_models(self) -> List[Dict]:
        """Get list of available models from the provider"""
        if self.provider == AIProvider.OLLAMA:
            try:
                url = f"{self.base_url}/api/tags"
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
            except Exception as e:
                return [{"error": str(e)}]
        
        return []
    
    def health_check(self) -> Dict:
        """Check if the AI service is available"""
        try:
            if self.provider == AIProvider.OLLAMA:
                url = f"{self.base_url}/api/tags"
                response = requests.get(url, timeout=5)
                response.raise_for_status()
                return {
                    "status": "healthy",
                    "provider": self.provider.value,
                    "base_url": self.base_url,
                    "model": self.model
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": self.provider.value,
                "error": str(e)
            }
    
    def _handle_stream(self, response) -> Generator:
        """Handle streaming response"""
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    yield data
                except json.JSONDecodeError:
                    continue


# Factory function for easy client creation
def create_ai_client(
    provider: str = "ollama",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None
) -> AIClient:
    """
    Factory function to create AI client
    
    Args:
        provider: Provider name (ollama, openai, anthropic)
        api_key: API key for the provider
        base_url: Base URL for the API
        model: Model name to use
        
    Returns:
        Configured AIClient instance
    """
    provider_enum = AIProvider(provider.lower())
    return AIClient(
        provider=provider_enum,
        api_key=api_key,
        base_url=base_url,
        model=model
    )
