# AI Client for Building Management AI

## Overview
The AI Client is a unified interface for interacting with multiple AI providers (Ollama, OpenAI, Anthropic, and custom APIs) for building management tasks.

## Features

### Multi-Provider Support
- **Ollama** - Local AI models (llama3.1, mistral, etc.)
- **OpenAI** - GPT models
- **Anthropic** - Claude models
- **Custom** - Any compatible API

### Core Functionality
- 🤖 **Chat Interface** - Natural language conversations
- 📊 **Building Data Analysis** - AI-powered insights
- ⚡ **Energy Predictions** - Consumption forecasting
- 🔍 **Model Management** - List and switch between models
- ❤️ **Health Checks** - Monitor AI service availability

## Quick Start

### Using with Ollama (Recommended)

1. **Start Ollama** (using VS Code tasks or terminal):
   ```bash
   podman run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama docker.io/ollama/ollama:latest
   ```

2. **Pull a model**:
   ```bash
   podman exec -it ollama ollama pull llama3.1:8b
   ```

3. **Use the AI Client**:
   ```python
   from src.ai.ai_client import create_ai_client
   
   # Create client
   ai = create_ai_client(provider="ollama")
   
   # Chat
   response = ai.chat("How can I reduce energy consumption in my building?")
   print(response['message'])
   
   # Analyze building data
   data = {
       "temperature": 22.5,
       "occupancy": 45,
       "energy_consumption": 150
   }
   analysis = ai.analyze_building_data(data)
   print(analysis)
   ```

### Using with OpenAI

```python
ai = create_ai_client(
    provider="openai",
    api_key="your-api-key",
    model="gpt-4"
)

response = ai.chat("Analyze this building's HVAC efficiency")
```

### Using with Anthropic

```python
ai = create_ai_client(
    provider="anthropic",
    api_key="your-api-key",
    model="claude-3-sonnet-20240229"
)

response = ai.chat("Suggest energy optimization strategies")
```

## API Reference

### AIClient Class

#### Constructor
```python
AIClient(
    provider: AIProvider,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None
)
```

#### Methods

##### `chat(message, context, temperature, max_tokens, stream)`
Send a chat message to the AI.

**Parameters:**
- `message` (str): User message
- `context` (List[Dict], optional): Conversation history
- `temperature` (float): Sampling temperature (0-1)
- `max_tokens` (int): Maximum response length
- `stream` (bool): Enable streaming responses

**Returns:** Dict with 'message', 'model', 'provider', etc.

##### `analyze_building_data(data)`
Analyze building management data.

**Parameters:**
- `data` (Dict): Building data to analyze

**Returns:** Dict with AI analysis and recommendations

##### `predict_energy_consumption(input_data)`
Predict energy consumption.

**Parameters:**
- `input_data` (Dict): Input parameters (temperature, occupancy, etc.)

**Returns:** Dict with prediction and confidence

##### `get_available_models()`
List available models from the provider.

**Returns:** List of available models

##### `health_check()`
Check if the AI service is available.

**Returns:** Dict with status information

## Environment Variables

Configure the AI client using environment variables:

```bash
# Ollama Configuration
export OLLAMA_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1:8b

# OpenAI Configuration
export OPENAI_API_KEY=your-key-here

# Anthropic Configuration
export ANTHROPIC_API_KEY=your-key-here

# Custom API
export AI_API_KEY=your-key
export AI_BASE_URL=https://your-api.com
```

## Web API Endpoints

The AI client is exposed through REST API:

### POST `/api/chat`
Chat with AI assistant.

**Request:**
```json
{
  "message": "How can I optimize HVAC?",
  "session_id": "optional-session-id"
}
```

**Response:**
```json
{
  "response": "Here are some HVAC optimization strategies...",
  "session_id": "abc123",
  "model": "llama3.1:8b",
  "provider": "ollama"
}
```

### POST `/api/ai/analyze`
Analyze building data.

**Request:**
```json
{
  "temperature": 22.5,
  "occupancy": 45,
  "energy_consumption": 150
}
```

### GET `/api/ai/health`
Check AI service health.

**Response:**
```json
{
  "status": "healthy",
  "provider": "ollama",
  "base_url": "http://localhost:11434",
  "model": "llama3.1:8b"
}
```

### GET `/api/ai/models`
Get available models.

**Response:**
```json
{
  "models": [
    {
      "name": "llama3.1:8b",
      "size": 4661211808
    }
  ]
}
```

## Examples

### Building Energy Analysis
```python
from src.ai.ai_client import create_ai_client

ai = create_ai_client()

building_data = {
    "building_id": "HQ-001",
    "temperature": 22.5,
    "occupancy": 45,
    "energy_consumption": 150,
    "hvac_status": "running",
    "time_of_day": "14:30",
    "day_of_week": "Monday"
}

analysis = ai.analyze_building_data(building_data)
print("AI Analysis:", analysis['message'])
```

### Energy Prediction
```python
prediction_input = {
    "temperature": 25.0,
    "occupancy": 60,
    "time": "18:00",
    "day": "Friday"
}

prediction = ai.predict_energy_consumption(prediction_input)
print("Predicted Energy:", prediction['message'])
```

### Conversation Context
```python
context = []

# First message
response1 = ai.chat("What factors affect energy consumption?")
context.append({"role": "user", "content": "What factors affect energy consumption?"})
context.append({"role": "assistant", "content": response1['message']})

# Follow-up with context
response2 = ai.chat("How can I optimize those factors?", context=context)
print(response2['message'])
```

## Troubleshooting

### Ollama Not Connecting
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
podman run -d --name ollama -p 11434:11434 ollama/ollama

# Check logs
podman logs ollama
```

### Model Not Found
```bash
# List available models
curl http://localhost:11434/api/tags

# Pull a model
podman exec -it ollama ollama pull llama3.1:8b
```

### API Errors
- Ensure your API keys are correctly set
- Check network connectivity
- Verify API endpoint URLs
- Check rate limits and quotas

## Best Practices

1. **Use Context**: Pass conversation context for coherent multi-turn conversations
2. **Temperature**: Use lower temperatures (0.2-0.3) for factual tasks, higher (0.7-0.9) for creative tasks
3. **Error Handling**: Always check for 'error' key in responses
4. **Model Selection**: Choose appropriate models based on task complexity
5. **Health Checks**: Implement regular health checks before critical operations

## Performance Tips

- **Local Models (Ollama)**: Best for privacy and low latency
- **Cloud APIs**: Better for complex reasoning tasks
- **Caching**: Implement response caching for repeated queries
- **Batch Processing**: Process multiple requests efficiently
- **Streaming**: Use streaming for long responses

## License

Part of Building Management AI project.
