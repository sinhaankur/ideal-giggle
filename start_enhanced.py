#!/usr/bin/env python3
"""
Startup script for Enhanced Vision AI system
Shows system status and launches the application
"""

import sys
import os
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

def check_dependencies():
    """Check if all dependencies are available"""
    print("="  * 70)
    print(" 🔍 Checking System Dependencies...")
    print("=" * 70)
    
    issues = []
    
    # Check camera
    try:
        import cv2
        print("✅ OpenCV (camera) - Available")
    except ImportError:
        print("❌ OpenCV - MISSING")
        issues.append("Install: pip install opencv-python")
    
    # Check encryption
    try:
        from cryptography.fernet import Fernet
        print("✅ Cryptography (encryption) - Available")
    except ImportError:
        print("❌ Cryptography - MISSING")
        issues.append("Install: pip install cryptography")
    
    # Check AI client
    try:
        import requests
        print("✅ Requests (Ollama API) - Available")
    except ImportError:
        print("❌ Requests - MISSING")
        issues.append("Install: pip install requests")
    
    # Check audio (optional)
    try:
        import pyaudio
        print("✅ PyAudio (microphone) - Available")
        audio_ok = True
    except ImportError:
        print("⚠️  PyAudio- OPTIONAL (audio features disabled)")
        print("   Install with: sudo apt-get install portaudio19-dev && pip install pyaudio")
        audio_ok = False
    
    try:
        import speech_recognition
        print("✅ SpeechRecognition (transcription) - Available")
    except ImportError:
        if audio_ok:
            print("⚠️  SpeechRecognition - OPTIONAL")
            print("   Install with: pip install SpeechRecognition")
    
    print()
    
    if issues:
        print("❌ Missing required dependencies:")
        for issue in issues:
            print(f"   {issue}")
        print()
        return False
    
    print("✅ All required dependencies available!")
    return True

def show_status():
    """Show system status and links"""
    print()
    print("=" * 70)
    print(" 🎥 Enhanced Vision AI - Multimodal Monitoring System")
    print("=" * 70)
    print()
    print(" Features:")
    print("   📹 Real-time camera monitoring with movement detection")
    print("   🎤 Audio capture and speech transcription")
    print("   🤖 AI analysis powered by Ollama (local)")
    print("   🔐 End-to-end encryption for privacy")
    print("   📊 Real-time metrics and activity logging")
    print()
    print(" Interfaces:")
    print("   🌟 Enhanced Vision AI Pro (Recommended)")
    print("      → http://localhost:5000/static/vision_enhanced.html")
    print("      Features: Video + Audio + AI Analysis + Advanced UI")
    print()
    print("   📹 Vision AI Basic")
    print("      → http://localhost:5000/static/vision.html")
    print("      Features: Video + AI Analysis + Basic UI")
    print()
    print(" Documentation:")
    print("   📖 ENHANCED_VISION_README.md - Complete guide")
    print("   📖 VISION_AI_README.md - Basic features")
    print()
    print("=" * 70)
    print()

def main():
    """Main startup function"""
    print("\n" * 2)
    
    # Check dependencies
    if not check_dependencies():
        print("❌ Please install missing dependencies before continuing.")
        print("   Run: pip install -r requirements.txt")
        print()
        return 1
    
    # Show status
    show_status()
    
    # Import and start Flask app
    print(" 🚀 Starting Flask application...")
    print()
    
    try:
        from app import create_app
        app = create_app()
        
        print(" ✅ Application started successfully!")
        print(" 🌐 Server running on: http://localhost:5000")
        print()
        print(" 📝 Quick Start:")
        print("    1. Open http://localhost:5000 in your browser")
        print("    2. Login with: admin / admin123")
        print("    3. Click '🎥 Vision AI Pro' in the sidebar")
        print("    4. Click 'Start Monitoring' to begin")
        print()
        print(" ⚠️  Note: Make sure Ollama is running on port 11434")
        print(" 💡 Tip: Press Ctrl+C to stop the server")
        print()
        print("=" * 70)
        print()
        
        # Run the app
        app.run(host='0.0.0.0', port=5000, debug=False)
        
    except KeyboardInterrupt:
        print("\n\n ⏹️  Server stopped by user")
        return 0
    except Exception as e:
        print(f"\n\n ❌ Error starting application: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
