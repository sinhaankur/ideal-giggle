# Vision AI - Private Movement Tracking

## Overview

This system connects your camera to Ollama AI for intelligent movement tracking with complete privacy and encryption. All processing happens locally on your machine - no data is sent to external servers.

## Features

### 🎥 Camera Integration
- Real-time video capture from your webcam
- Configurable resolution and frame rate
- Automatic camera initialization and cleanup

### 🔍 Movement Detection
- Advanced computer vision algorithms for movement detection
- Background subtraction for accurate tracking
- Configurable sensitivity and minimum detection area
- Bounding box visualization around detected movement
- Movement intensity calculation

### 🤖 Ollama AI Analysis
- Automatic AI analysis of detected movements
- Security assessment and pattern recognition
- Natural language descriptions of activity
- Configurable analysis intervals

### 🔐 Privacy & Encryption
- End-to-end encryption using Fernet (AES-128-CBC)
- All camera frames encrypted at rest
- Movement data encrypted before storage
- Password-based key derivation (PBKDF2)
- Secure session tokens
- Local processing only - no cloud uploads

## Architecture

```
Camera → Movement Detection → Ollama AI → Encrypted Storage
   ↓            ↓                  ↓              ↓
Capture     Analyze Video      AI Analysis    Secure DB
```

### Components

1. **CameraManager** (`src/camera/camera_manager.py`)
   - Handles camera initialization and capture
   - Frame conversion and encoding
   - Thread-safe operations

2. **MovementDetector** (`src/camera/movement_detector.py`)
   - Frame differencing algorithm
   - Background subtraction (MOG2)
   - Contour detection and filtering
   - Movement visualization

3. **PrivacyManager** (`src/privacy/encryption.py`)
   - Fernet encryption/decryption
   - Key derivation from password
   - Secure storage management

4. **VisionAIService** (`src/ai/vision_service.py`)
   - Integrates all components
   - Monitoring loop
   - AI analysis orchestration
   - Statistics tracking

## API Endpoints

### Start Monitoring
```
POST /api/vision/start
Authorization: Bearer {token}
```
Starts camera monitoring and movement detection.

### Stop Monitoring
```
POST /api/vision/stop
Authorization: Bearer {token}
```
Stops monitoring and returns statistics.

### Get Current Frame
```
GET /api/vision/frame?encrypted=true&annotated=true
Authorization: Bearer {token}
```
Returns current camera frame with optional encryption and movement annotations.

### Get Movement History
```
GET /api/vision/movement/history?limit=50
Authorization: Bearer {token}
```
Returns recent movement detections.

### Get AI Analyses
```
GET /api/vision/analysis?limit=10
Authorization: Bearer {token}
```
Returns recent AI analyses of movements.

### Analyze Now
```
POST /api/vision/analyze-now
Authorization: Bearer {token}
```
Triggers immediate AI analysis of current view.

### Get Statistics
```
GET /api/vision/stats
Authorization: Bearer {token}
```
Returns monitoring statistics.

### Get Encryption Status
```
GET /api/vision/encryption-status
Authorization: Bearer {token}
```
Returns encryption and privacy information.

## Usage

### 1. Start Ollama

Make sure Ollama is running on port 11434:
```bash
# Using the task
podman run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama docker.io/ollama/ollama:latest

# Or use the VS Code task: "podman: start ollama"
```

### 2. Pull an Ollama Model
```bash
podman exec -it ollama ollama pull llama3.1:8b
```

### 3. Start the Application
```bash
cd /home/ankursinha/building-management-ai
source venv/bin/activate
python app.py
```

### 4. Access the Vision AI Interface

1. Open browser to http://localhost:5000
2. Login with credentials (admin/admin123)
3. Click "Vision AI 🔐" in the sidebar
4. Click "Start Monitoring" to begin

## Configuration

### Camera Settings
Edit `src/ai/vision_service.py`:
```python
vision_service = VisionAIService(
    camera_index=0,  # Change camera device
    privacy_password="your_secure_password",
    ollama_url="http://localhost:11434",
    ollama_model="llama3.1:8b"
)
```

### Movement Detection Sensitivity
```python
detector = MovementDetector(
    sensitivity=25,  # Lower = more sensitive (0-100)
    min_area=500     # Minimum pixels for detection
)
```

### Analysis Interval
```python
self.analysis_interval = 2.0  # Seconds between AI analyses
```

## Privacy Features

### Local Processing
- All video processing happens on your machine
- Ollama runs locally (no external API calls)
- No data transmission to external servers

### Encryption
- **Algorithm**: Fernet (AES-128-CBC + HMAC)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Salt**: Unique per installation
- **Data Encrypted**:
  - Camera frames
  - Movement detection results
  - AI analysis results

### Data Storage
- Encrypted data stored in memory (SecureStorage)
- Automatic cleanup after session ends
- No persistent storage by default

### Access Control
- Authentication required for all endpoints
- Bearer token authorization
- Session management

## Security Recommendations

1. **Change Default Password**: Update the privacy password in production
2. **Use HTTPS**: Enable HTTPS for web interface in production
3. **Restrict Access**: Use firewall rules to limit access
4. **Regular Updates**: Keep OpenCV and cryptography packages updated
5. **Camera Permissions**: Only grant camera access when needed

## Troubleshooting

### Camera Not Found
- Check camera is connected
- Verify camera index (try 0, 1, 2...)
- Check camera permissions: `ls -l /dev/video*`
- May need to add user to video group: `sudo usermod -a -G video $USER`

### Ollama Connection Failed
- Verify Ollama is running: `podman ps | grep ollama`
- Check logs: `podman logs ollama`
- Test connection: `curl http://localhost:11434/api/tags`

### Low FPS / Performance
- Reduce camera resolution in CameraManager
- Increase analysis_interval
- Lower movement detection sensitivity
- Use smaller Ollama model (e.g., llama2:7b)

### Movement Not Detected
- Check lighting conditions
- Adjust sensitivity parameter (lower value = more sensitive)
- Reduce min_area parameter
- Try background_subtraction method instead

## Examples

### Python API Usage
```python
from src.ai.vision_service import get_vision_service

# Initialize service
service = get_vision_service(
    camera_index=0,
    privacy_password="my_secure_password"
)

# Start monitoring
result = service.start_monitoring()
print(result)

# Get current frame (encrypted)
frame_data = service.get_current_frame(encrypted=True, annotated=True)

# Get AI analysis
analysis = service.analyze_current_situation()
print(analysis['ai_analysis'])

# Get statistics
stats = service.get_statistics()
print(f"Movements detected: {stats['movements_detected']}")

# Stop monitoring
service.stop_monitoring()
```

### Command Line Testing
```bash
# Start monitoring
curl -X POST http://localhost:5000/api/vision/start \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get frame
curl http://localhost:5000/api/vision/frame \
  -H "Authorization: Bearer YOUR_TOKEN"

# Analyze now
curl -X POST http://localhost:5000/api/vision/analyze-now \
  -H "Authorization: Bearer YOUR_TOKEN"

# Stop monitoring
curl -X POST http://localhost:5000/api/vision/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance

- **Frame Processing**: ~30 FPS
- **Movement Detection**: ~50ms per frame
- **AI Analysis**: ~2-5 seconds (depends on Ollama model)
- **Memory Usage**: ~200-500MB
- **CPU Usage**: 15-30% on modern processors

## Future Enhancements

- [ ] Multiple camera support
- [ ] Recording of detected movements
- [ ] Advanced person detection (YOLO)
- [ ] Face blurring for additional privacy
- [ ] Alert notifications
- [ ] Movement pattern learning
- [ ] Cloud sync (optional, encrypted)
- [ ] Mobile app integration

## License

This is part of the Building Management AI system. All rights reserved.

## Support

For issues or questions, please check the logs:
```bash
# Application logs
tail -f app.log

# Ollama logs
podman logs -f ollama
```
