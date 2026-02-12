# Emotion & Audio Analysis Guide

## Overview

The Building Management AI system now includes comprehensive emotion and audio analysis capabilities:

### 🎯 Features

1. **Facial Emotion Detection**
   - Detects facial expressions from video frames
   - Classifies emotions: happy, sad, angry, neutral, fear, surprise, disgust
   - Provides confidence scores for each emotion
   - Fallback support for multiple detection methods (DeepFace, MediaPipe, OpenCV)

2. **Audio Sentiment Analysis**
   - Transcribes speech to text
   - Analyzes sentiment: POSITIVE, NEGATIVE, NEUTRAL
   - Acoustic feature analysis (pitch, energy, speech rate)
   - Confidence scoring (0-100%)

3. **Real-Time Monitoring**
   - Live emotion detection from camera feed
   - Real-time sentiment analysis of detected speech
   - Combined emotion insights from facial + audio
   - Activity logging with emotion/sentiment events

## Installation

### Step 1: Install Core Dependencies

The emotion and audio analysis features require several heavy ML packages. Install them:

```bash
cd /home/ankursinha/building-management-ai
pip install -r requirements.txt
```

### Step 2: Optional - Install GPU Support

For faster emotion detection with CUDA:

```bash
# If using NVIDIA GPU
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install tensorflow[and-cuda]
```

### Step 3: Download Pre-trained Models

Some models download automatically on first use. Expect these downloads:

```
- DeepFace models (~400MB total)
- MFCC models (~50MB)
- Transformers sentiment model (~400MB)
- MediaPipe face detection (~200KB)
```

**Note**: First run may take 5-10 minutes while models download.

## API Endpoints

### Emotion Analysis

**POST** `/api/emotion/frame-analysis`
```json
{
  "frame": "base64_encoded_image_data",
  "audio_text": "optional transcribed text"
}
```

Response:
```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "facial": {
    "faces_detected": 1,
    "emotions": [
      {
        "emotion": "happy",
        "confidence": 85.5,
        "all_emotions": {
          "happy": 85.5,
          "sad": 5.2,
          "angry": 2.1,
          ...
        },
        "icon": "😊"
      }
    ],
    "dominant_emotion": "happy",
    "success": true,
    "method": "deepface"
  },
  "audio": { ... },
  "overall_emotion": {
    "emotion": "happy",
    "confidence": 85.5,
    "icon": "😊"
  }
}
```

**GET** `/api/emotion/continuous-analysis`
- Real-time emotion analysis from active camera stream
- Returns current emotion if camera is monitoring

**GET** `/api/emotion/statistics`
- Emotion detection statistics
- Distribution across facial and audio analyzers

**GET** `/api/emotion/history?limit=20`
- Emotion analysis history
- Separate histories for facial, audio, and combined

### Audio Analysis

**POST** `/api/audio/transcribe-file`
```
Content-Type: multipart/form-data
file: <audio_file>
language: en-US (optional)
```

Response:
```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "transcription": {
    "success": true,
    "text": "Hello, how are you doing?",
    "confidence": 0.95
  },
  "emotion": {
    "emotion": "neutral",
    "confidence": 60.0,
    "characteristics": {
      "pitch_variation": 0.045,
      "energy_mean": 0.024,
      ...
    }
  },
  "overall_audio_emotion": {
    "emotion": "neutral",
    "confidence": 60.0,
    "icon": "😐",
    "based_on": ["acoustic"]
  }
}
```

**POST** `/api/audio/sentiment-text`
```json
{
  "text": "I'm feeling great today!"
}
```

Response:
```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "text": "I'm feeling great today!",
  "sentiment": "POSITIVE",
  "confidence": 95.5,
  "emotion": "happy",
  "icon": "😊",
  "success": true
}
```

**POST** `/api/audio/analyze-emotion`
```
Content-Type: multipart/form-data
file: <audio_file>
```

**GET** `/api/audio/statistics`
- Audio processing statistics
- Transcription success rates

**GET** `/api/audio/transcription-history?limit=20`
- Recent transcriptions

## UI Components

### Facial Emotion Detection Panel
Located in right panel:
- **Detected Emotion**: Current emotion label
- **Emotion Icon**: Visual emoji representation
- **Faces Detected**: Number of faces in frame
- **Confidence**: Percentage confidence (0-100%)
- **Progress Bar**: Visual confidence indicator

### Audio Sentiment Panel
Located in right panel:
- **Detected Sentiment**: POSITIVE, NEGATIVE, NEUTRAL
- **Emotion Icon**: Emoji representation
- **Confidence**: Percentage confidence (0-100%)
- **Progress Bar**: Visual confidence indicator
- **Text**: Transcribed text snippet

## Usage Examples

### Example 1: Real-Time Emotion Monitoring

```javascript
// Start monitoring
POST /api/vision/start
{
  "camera_index": 0,
  "enable_audio": true
}

// Get continuous updates (called every 500ms)
GET /api/emotion/continuous-analysis

// Results include:
// - Current detected emotion
// - Confidence level
// - Facial detection status
// - Audio sentiment if speech detected
```

### Example 2: Analyze Recorded Audio

```bash
curl -X POST http://localhost:5001/api/audio/transcribe-file \
  -F "file=@/path/to/audio.wav" \
  -F "language=en-US"
```

### Example 3: Sentiment Analysis of Speech

```python
import requests

# First transcribe audio
with open('audio.wav', 'rb') as f:
    response = requests.post(
        'http://localhost:5001/api/audio/transcribe-file',
        files={'file': f}
    )
    transcription = response.json()['transcription']['text']

# Then analyze sentiment
response = requests.post(
    'http://localhost:5001/api/audio/sentiment-text',
    json={'text': transcription}
)
sentiment = response.json()
print(f"Emotion: {sentiment['emotion']} ({sentiment['confidence']}%)")
```

## Performance Considerations

### Hardware Requirements

| Component | CPU | GPU | Memory |
|-----------|-----|-----|--------|
| Facial Detection (OpenCV) | Light | No | 100MB |
| DeepFace Analysis | Moderate | Recommended | 2GB |
| Speech Recognition | Light | No | 500MB |
| Sentiment Analysis | Moderate | Recommended | 1.5GB |
| Combined System | Heavy | Recommended | 4GB+ |

### Optimization Tips

1. **Disable unused features:**
   ```python
   # In emotion_analyzer.py, comment out:
   # DEEPFACE_AVAILABLE = False
   # MEDIAPIPE_AVAILABLE = False
   ```

2. **Use GPU acceleration:**
   - Install CUDA, cuDNN, TensorFlow GPU
   - DeepFace will automatically use GPU if available

3. **Reduce analysis frequency:**
   - Adjust `analysis_interval` in VisionService (currently 0.5s)
   - Skip analysis for older frames

4. **Cache models:**
   - First run downloads models (~1GB total)
   - Subsequent runs load from cache (~5-10 seconds)

## Troubleshooting

### DeepFace Not Available
```
ImportError: No module named 'deepface'
```
**Solution:**
```bash
pip install deepface
# Also install dependencies
pip install opencv-python tensorflow mtcnn pillow scipy scikit-image
```

### Speech Recognition Fails
```
Error: Could not understand audio
```
**Solutions:**
- Audio quality too low - use better microphone/file
- Language mismatch - specify correct language code
- Check internet connection (Google API requires it)

### MediaPipe Installation Issues
```
ERROR: Could not build wheels for mediapipe
```
**Solution:**
```bash
# Pre-built wheels available for most platforms
pip install --upgrade mediapipe
# Or use anaconda for better binary support
conda install -c conda-forge mediapipe
```

### Out of Memory
```
RuntimeError: CUDA out of memory
```
**Solutions:**
- Reduce batch size (currently 1 frame at a time, already optimal)
- Disable GPU and use CPU: `pip install tensorflow-cpu`
- Close other applications using GPU memory

### Slow Emotion Detection
- First frame takes 5-10s while models load
- Subsequent frames should be <1s with GPU, <3s with CPU
- DeepFace adds ~500ms per frame analysis
- Consider lower resolution input

## Advanced Configuration

### Custom Model Fine-tuning

```python
from src.ai.emotion_analyzer import FacialEmotionDetector

# Use different DeepFace model
detector = FacialEmotionDetector(model='resnet')  # 'vgg' (default), 'resnet', 'mobilenet'
```

### Audio Analysis Sensitivity

```python
from src.ai.audio_emotion import AudioEmotionDetector

detector = AudioEmotionDetector()

# Adjust classification thresholds in _classify_emotion_from_audio()
# Lower thresholds = more sensitive to emotional changes
```

### Custom Sentiment Categories

```python
# In audio_emotion.py, extend SENTIMENT_SCORES
SENTIMENT_SCORES = {
    'POSITIVE': {'label': 'happy', 'icon': '😊', 'score': 1.0},
    'NEGATIVE': {'label': 'sad', 'icon': '😢', 'score': -1.0},
    'NEUTRAL': {'label': 'neutral', 'icon': '😐', 'score': 0.0},
    'SARCASTIC': {'label': 'sarcastic', 'icon': '😏', 'score': -0.5},  # NEW
}
```

## API Rate Limits

No built-in rate limiting, but recommended:
- Emotional analysis: Once per frame (500ms)
- Sentiment analysis: Once per audio segment
- Transcription: As needed

## Data Privacy

⚠️ **Important**: Emotion and audio analysis may involve:
- Facial feature extraction
- Audio transcription (may be sent to external APIs like Google)
- Processing personal data

**Recommendations:**
- Enable encryption features
- Use local speech-to-text when available
- Store emotion data securely
- Implement access controls

## Future Enhancements

Planned improvements:
- [ ] Local speech-to-text (Whisper.cpp)
- [ ] On-device emotion classification (TFLite)
- [ ] Multi-face emotion tracking
- [ ] Emotion timeline visualization
- [ ] Emotion-triggered alerts
- [ ] Historical emotion trends
- [ ] Integration with building automation

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error logs in `/home/ankursinha/building-management-ai/logs/`
3. Test individual components with curl examples
4. Verify camera/microphone are accessible
5. Check file permissions in `/home/ankursinha/`

---

**Last Updated**: January 2024
**Emotion Analysis Version**: 1.0
**Audio Analysis Version**: 1.0
