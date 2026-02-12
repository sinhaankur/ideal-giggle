#!/bin/bash
# Installation and setup guide for Emotion & Audio Analysis

echo "🎬 Building Management AI - Emotion & Audio Setup Guide"
echo "========================================================="
echo ""

# Check Python environment
echo "Step 1: Verify Python Environment"
echo "-----------------------------------"
if [ -f "venv/bin/activate" ]; then
    echo "✅ Virtual environment found at ./venv/"
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️  Virtual environment not found!"
    echo "   Run: python3 -m venv venv"
    exit 1
fi

# Check if dependencies installed
echo ""
echo "Step 2: Check Dependencies"
echo "--------------------------"
python3 -c "import cv2; print('✅ OpenCV')" 2>/dev/null || echo "❌ OpenCV missing"
python3 -c "import numpy; print('✅ NumPy')" 2>/dev/null || echo "❌ NumPy missing"
python3 -c "import flask; print('✅ Flask')" 2>/dev/null || echo "❌ Flask missing"

echo ""
echo "Optional ML Dependencies (for enhanced features):"
python3 -c "import deepface; print('✅ DeepFace')" 2>/dev/null || echo "⚠️  DeepFace (install: pip install deepface)"
python3 -c "import mediapipe; print('✅ MediaPipe')" 2>/dev/null || echo "⚠️  MediaPipe (install: pip install mediapipe)"
python3 -c "import librosa; print('✅ Librosa')" 2>/dev/null || echo "⚠️  Librosa (install: pip install librosa)"
python3 -c "import speech_recognition; print('✅ SpeechRecognition')" 2>/dev/null || echo "⚠️  SpeechRecognition (install: pip install SpeechRecognition)"

# Check camera access
echo ""
echo "Step 3: Check Camera Access"
echo "----------------------------"
if [ -e "/dev/video0" ]; then
    echo "✅ Camera device found: /dev/video0"
    if groups | grep -q "video"; then
        echo "✅ User is in 'video' group (can access camera)"
    else
        echo "❌ User NOT in 'video' group!"
        echo "   Run: sudo usermod -aG video \$USER"
        echo "   Then: log out and back in, or reboot"
    fi
else
    echo "❌ No camera device found at /dev/video0"
    ls -la /dev/video* 2>/dev/null || echo "   No /dev/video* devices found"
fi

# Check if routes file has emotion endpoints
echo ""
echo "Step 4: Verify Emotion/Audio Integration"
echo "-----------------------------------------"
if grep -q "emotion/frame-analysis" src/api/routes.py; then
    echo "✅ Emotion API endpoints registered"
else
    echo "❌ Emotion endpoints not found in routes"
fi

if grep -q "audio/sentiment-text" src/api/routes.py; then
    echo "✅ Audio API endpoints registered"
else
    echo "❌ Audio endpoints not found in routes"
fi

# Check emotion analyzer module
echo ""
echo "Step 5: Check Emotion Analyzer Module"
echo "--------------------------------------"
if [ -f "src/ai/emotion_analyzer.py" ]; then
    echo "✅ emotion_analyzer.py exists"
    python3 -c "from src.ai.emotion_analyzer import get_emotion_analyzer; print('✅ EmotionAnalyzer loads successfully')" 2>/dev/null || echo "❌ EmotionAnalyzer import failed"
else
    echo "❌ emotion_analyzer.py not found"
fi

# Check audio emotion module
if [ -f "src/ai/audio_emotion.py" ]; then
    echo "✅ audio_emotion.py exists"
    python3 -c "from src.ai.audio_emotion import get_audio_processor; print('✅ AudioProcessor loads successfully')" 2>/dev/null || echo "❌ AudioProcessor import failed"
else
    echo "❌ audio_emotion.py not found"
fi

# Check UI updates
echo ""
echo "Step 6: Check UI Components"
echo "----------------------------"
if grep -q "emotionLabel" src/static/vision_enhanced.html; then
    echo "✅ Emotion UI components present"
else
    echo "❌ Emotion UI components missing"
fi

if grep -q "sentimentLabel" src/static/vision_enhanced.html; then
    echo "✅ Audio sentiment UI components present"
else
    echo "❌ Audio sentiment UI components missing"
fi

# Test imports
echo ""
echo "Step 7: Module Import Test"
echo "--------------------------"
echo "Testing emotion_analyzer..."
python3 -c "from src.ai.emotion_analyzer import get_emotion_analyzer, FacialEmotionDetector, AudioSentimentAnalyzer; print('✅ All emotion classes load')" 2>&1 | head -5

echo "Testing audio_emotion..."
python3 -c "from src.ai.audio_emotion import get_audio_processor, AudioEmotionDetector, SpeechRecognizer; print('✅ All audio classes load')" 2>&1 | head -5

# Final recommendations
echo ""
echo "========================================================="
echo "📋 Setup Summary"
echo "========================================================="
echo ""
echo "Status: Configuration Check Complete"
echo ""
echo "Next Steps:"
echo "1. Install optional ML models:"
echo "   pip install -r requirements.txt"
echo ""
echo "2. (If camera not accessible) Fix permissions:"
echo "   sudo usermod -aG video \$USER"
echo "   (Then reboot)"
echo ""
echo "3. Start the server:"
echo "   python3 app.py"
echo ""
echo "4. Open dashboard:"
echo "   http://localhost:5001/static/vision_enhanced.html"
echo ""
echo "5. Click 'Start Monitoring' to begin emotion & audio analysis"
echo ""
echo "========================================================="
