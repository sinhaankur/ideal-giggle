"""
AI Provider Configuration & Management
Supports: Local Ollama, Remote APIs, Hybrid Mode
"""

import os
import json
from enum import Enum
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
from pathlib import Path


class AIProvider(Enum):
    """Available AI providers"""
    LOCAL_OLLAMA = "ollama_local"      # Private, local Ollama instance
    OPENAI_API = "openai_api"          # Cloud-based OpenAI
    ANTHROPIC_API = "anthropic_api"    # Cloud-based Anthropic
    HYBRID = "hybrid"                  # Local-first, fallback to cloud


class OllamaModel(Enum):
    """Available Ollama models"""
    NEURAL_CHAT = "neural-chat"        # Fast, optimized for chat
    MISTRAL = "mistral"                # Good balance
    LLAMA2 = "llama2"                  # Comprehensive
    NEURAL_CHAT_SMALL = "neural-chat:7b"
    CUSTOM = "custom"                  # User-specified


@dataclass
class AIProviderConfig:
    """AI Provider Configuration"""
    provider: AIProvider
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "neural-chat"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    temperature: float = 0.7
    use_local_first: bool = True       # Try local before cloud
    fallback_to_cloud: bool = True     # Fallback if local fails
    enable_caching: bool = True
    cache_ttl: int = 3600              # 1 hour
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        data['provider'] = self.provider.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AIProviderConfig':
        """Create from dictionary"""
        provider_str = data.pop('provider', 'ollama_local')
        provider = AIProvider(provider_str)
        return cls(provider=provider, **data)


class AIConfigManager:
    """Manage AI provider configuration"""
    
    def __init__(self, config_file: Optional[str] = None):
        """Initialize config manager"""
        if config_file is None:
            config_file = os.path.join(
                os.path.dirname(__file__),
                '../../.ai_config.json'
            )
        self.config_file = config_file
        self.config = self._load_config()
    
    def _load_config(self) -> AIProviderConfig:
        """Load config from file or create default"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    return AIProviderConfig.from_dict(data)
            except Exception as e:
                print(f"Error loading config: {e}, using defaults")
        
        # Default: Local Ollama with cloud fallback (Hybrid)
        return AIProviderConfig(
            provider=AIProvider.HYBRID,
            ollama_host="http://localhost:11434",
            ollama_model="neural-chat",
            use_local_first=True,
            fallback_to_cloud=True
        )
    
    def save_config(self, config: AIProviderConfig) -> bool:
        """Save config to file"""
        try:
            # Ensure directory exists
            Path(self.config_file).parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_file, 'w') as f:
                json.dump(config.to_dict(), f, indent=2)
            self.config = config
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False
    
    def get_config(self) -> AIProviderConfig:
        """Get current configuration"""
        return self.config
    
    def set_provider(self, provider: AIProvider) -> bool:
        """Switch AI provider"""
        self.config.provider = provider
        return self.save_config(self.config)
    
    def set_ollama_config(self, host: str, model: str) -> bool:
        """Configure Ollama"""
        self.config.ollama_host = host
        self.config.ollama_model = model
        return self.save_config(self.config)
    
    def set_api_keys(self, openai_key: Optional[str] = None, 
                     anthropic_key: Optional[str] = None) -> bool:
        """Set API keys for cloud providers"""
        if openai_key:
            self.config.openai_api_key = openai_key
        if anthropic_key:
            self.config.anthropic_api_key = anthropic_key
        return self.save_config(self.config)
    
    def validate_ollama_connection(self) -> bool:
        """Check if Ollama is accessible"""
        try:
            import requests
            response = requests.get(
                f"{self.config.ollama_host}/api/tags",
                timeout=5
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Ollama check failed: {e}")
            return False
    
    def get_available_ollama_models(self) -> list:
        """Get list of available Ollama models"""
        try:
            import requests
            response = requests.get(
                f"{self.config.ollama_host}/api/tags",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                return [m['name'] for m in data.get('models', [])]
        except Exception as e:
            print(f"Error fetching models: {e}")
        return []


# Global config manager instance
_config_manager: Optional[AIConfigManager] = None


def get_ai_config_manager() -> AIConfigManager:
    """Get or create global config manager"""
    global _config_manager
    if _config_manager is None:
        _config_manager = AIConfigManager()
    return _config_manager


def get_current_config() -> AIProviderConfig:
    """Get current AI provider configuration"""
    return get_ai_config_manager().get_config()
