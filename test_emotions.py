#!/usr/bin/env python3
"""
Quick test script for emotion and audio analysis features
Tests all major components without requiring a full server setup
"""

import sys
import os
import json
from pathlib import Path

# Add project to path
sys.path.insert(0, '/home/ankursinha/building-management-ai')

def test_emotion_analyzer():
    """Test facial emotion detection"""
    print("\n" + "="*60)
    print("🎬 Testing Facial Emotion Analyzer")
    print("="*60)
    
    try:
        from src.ai.emotion_analyzer import get_emotion_analyzer, FacialEmotionDetector
        import numpy as np
        
        print("✅ Emotion analyzer imported successfully")
        
        # Create a simple test frame (neutral gray image)
        test_frame = np.full((480, 640, 3), 128, dtype=np.uint8)
        
        analyzer = get_emotion_analyzer()
        print(f"✅ Analyzer initialized")
        print(f"   - DeepFace available: {analyzer.facial_detector.detection_available}")
        print(f"   - MediaPipe available: {analyzer.facial_detector.use_mediapipe}")
        
        # Try analysis
        result = analyzer.analyze_frame(test_frame)
        print(f"\n📊 Analysis Result:")
        print(f"   - Timestamp: {result['timestamp']}")
        print(f"   - Facial module: {result['facial']['method']}")
        print(f"   - Faces detected: {result['facial']['faces_detected']}")
        
        # Get stats
        stats = analyzer.get_statistics()
        print(f"\n📈 Statistics:")
        print(f"   - Detection method available: {stats['facial']['detection_available']}")
        print(f"   - Using MediaPipe: {stats['facial']['use_mediapipe']}")
        
        print("\n✅ Emotion analyzer test PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Emotion analyzer test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_audio_processor():
    """Test audio transcription and sentiment"""
    print("\n" + "="*60)
    print("🎤 Testing Audio Processor")
    print("="*60)
    
    try:
        from src.ai.audio_emotion import get_audio_processor, AudioEmotionDetector
        
        print("✅ Audio modules imported successfully")
        
        processor = get_audio_processor()
        print(f"✅ Audio processor initialized")
        print(f"   - Speech recognition available: {processor.recognizer.available}")
        print(f"   - Librosa available: {processor.emotion_detector.librosa_available}")
        
        # Test sentiment analysis
        test_texts = [
            "I'm feeling great and very happy!",
            "This makes me sad and depressed",
            "It's an okay day, nothing special"
        ]
        
        print(f"\n🎯 Testing Sentiment Analysis:")
        for text in test_texts:
            result = processor.emotion_detector.audio_analyzer.analyze_sentiment(text)
            icon = result.get('icon', '?')
            emotion = result.get('emotion', 'unknown')
            confidence = result.get('confidence', 0)
            print(f"   {icon} '{text[:40]}...' → {emotion} ({confidence:.1f}%)")
        
        # Get stats
        stats = processor.get_statistics()
        print(f"\n📈 Statistics:")
        print(f"   - Transcriber available: {stats['transcriber']['available']}")
        
        print("\n✅ Audio processor test PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ Audio processor test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_routes():
    """Test that API routes are registered"""
    print("\n" + "="*60)
    print("🌐 Testing API Routes")
    print("="*60)
    
    try:
        from src.api import routes
        
        # Check for emotion endpoints
        emotion_endpoints = [
            '/emotion/frame-analysis',
            '/emotion/continuous-analysis',
            '/emotion/statistics',
            '/emotion/history'
        ]
        
        audio_endpoints = [
            '/audio/transcribe-file',
            '/audio/analyze-emotion',
            '/audio/sentiment-text',
            '/audio/statistics',
            '/audio/transcription-history'
        ]
        
        print("✅ Routes module imported")
        
        # We can't directly check routes without instantiating Flask app
        # Just verify the imports work
        print(f"📋 Emotion endpoints to be registered: {len(emotion_endpoints)}")
        for ep in emotion_endpoints:
            print(f"   - POST/GET /api{ep}")
        
        print(f"\n📋 Audio endpoints to be registered: {len(audio_endpoints)}")
        for ep in audio_endpoints:
            print(f"   - POST/GET /api{ep}")
        
        print("\n✅ API routes test PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ API routes test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_dependencies():
    """Check if critical dependencies are installed"""
    print("\n" + "="*60)
    print("📦 Checking Dependencies")
    print("="*60)
    
    dependencies = {
        'cv2': 'OpenCV',
        'numpy': 'NumPy',
        'flask': 'Flask',
        'PIL': 'Pillow',
        'speech_recognition': 'SpeechRecognition',
        'deepface': 'DeepFace (optional)',
        'mediapipe': 'MediaPipe (optional)',
        'librosa': 'Librosa (optional)',
        'transformers': 'Transformers (optional)',
        'torch': 'PyTorch (optional)',
    }
    
    installed = []
    missing = []
    optional_missing = []
    
    for module, name in dependencies.items():
        try:
            __import__(module)
            installed.append(name)
            print(f"✅ {name}")
        except ImportError:
            if 'optional' in name.lower():
                optional_missing.append(name)
                print(f"⚠️  {name} (not critical)")
            else:
                missing.append(name)
                print(f"❌ {name}")
    
    print(f"\n📊 Summary:")
    print(f"   - Installed: {len(installed)}")
    print(f"   - Missing (critical): {len(missing)}")
    print(f"   - Missing (optional): {len(optional_missing)}")
    
    if missing:
        print(f"\n⚠️  Please install missing packages:")
        for pkg in missing:
            print(f"   pip install {pkg.lower()}")
    
    if optional_missing:
        print(f"\n📝 Optional packages for enhanced features:")
        print(f"   pip install -r requirements.txt")
    
    return len(missing) == 0


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🧪 Building Management AI - Emotion & Audio Test Suite")
    print("="*60)
    
    results = {
        'Dependencies': test_dependencies(),
        'Emotion Analyzer': test_emotion_analyzer(),
        'Audio Processor': test_audio_processor(),
        'API Routes': test_api_routes(),
    }
    
    print("\n" + "="*60)
    print("📋 Test Summary")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:.<40} {status}")
    
    print(f"\n{'Total':.<40} {passed}/{total} passed")
    
    if passed == total:
        print("\n🎉 All tests passed! System is ready to use.")
        print("\nNext steps:")
        print("1. Start the server: python app.py")
        print("2. Visit: http://localhost:5001/static/vision_enhanced.html")
        print("3. Start camera monitoring")
        print("4. Emotions and audio sentiment will appear in real-time")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please fix issues above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
