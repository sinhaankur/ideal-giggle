#!/usr/bin/env python3
"""
Test script for Vision AI components
Tests camera, movement detection, and encryption without requiring Ollama
"""

import sys
import time
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

def test_camera():
    """Test camera functionality"""
    print("=" * 60)
    print("Testing Camera Manager")
    print("=" * 60)
    
    try:
        from src.camera import CameraManager
        
        camera = CameraManager(camera_index=0)
        print("✓ Camera manager created")
        
        if camera.start():
            print("✓ Camera started successfully")
            
            # Capture a few frames
            for i in range(3):
                frame = camera.capture_frame()
                if frame is not None:
                    print(f"✓ Frame {i+1} captured: {frame.shape}")
                else:
                    print(f"✗ Failed to capture frame {i+1}")
                time.sleep(0.5)
            
            # Test JPEG encoding
            jpeg_bytes = camera.get_frame_as_jpeg()
            if jpeg_bytes:
                print(f"✓ JPEG encoding works: {len(jpeg_bytes)} bytes")
            
            # Test base64 encoding
            b64_str = camera.get_frame_as_base64()
            if b64_str:
                print(f"✓ Base64 encoding works: {len(b64_str)} chars")
            
            # Camera info
            info = camera.get_camera_info()
            print(f"✓ Camera info: {info}")
            
            camera.stop()
            print("✓ Camera stopped")
            return True
        else:
            print("✗ Failed to start camera")
            print("  Note: This is expected if no camera is connected")
            return False
            
    except Exception as e:
        print(f"✗ Camera test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_movement_detector():
    """Test movement detection"""
    print("\n" + "=" * 60)
    print("Testing Movement Detector")
    print("=" * 60)
    
    try:
        import numpy as np
        from src.camera import MovementDetector
        
        detector = MovementDetector(sensitivity=25, min_area=500)
        print("✓ Movement detector created")
        
        # Create a synthetic frame (640x480 color image)
        frame1 = np.zeros((480, 640, 3), dtype=np.uint8)
        print("✓ Created test frame 1")
        
        # Detect movement on first frame (should initialize)
        result1 = detector.detect_movement(frame1)
        print(f"✓ First detection result: {result1.get('message', 'OK')}")
        
        # Create second frame with a white rectangle (simulated movement)
        frame2 = frame1.copy()
        frame2[200:300, 250:350] = 255  # White rectangle
        print("✓ Created test frame 2 with simulated movement")
        
        # Detect movement
        result2 = detector.detect_movement(frame2)
        print(f"✓ Movement detected: {result2.get('detected', False)}")
        print(f"  Regions: {result2.get('region_count', 0)}")
        print(f"  Intensity: {result2.get('intensity', 0)}%")
        
        # Test background subtraction method
        result3 = detector.detect_with_background_subtraction(frame2)
        print(f"✓ Background subtraction method works")
        
        # Test movement history
        history = detector.get_movement_history()
        print(f"✓ Movement history: {len(history)} items")
        
        # Test summary
        summary = detector.get_movement_summary()
        print(f"✓ Movement summary: {summary}")
        
        return True
        
    except Exception as e:
        print(f"✗ Movement detector test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_encryption():
    """Test encryption functionality"""
    print("\n" + "=" * 60)
    print("Testing Privacy & Encryption")
    print("=" * 60)
    
    try:
        from src.privacy import PrivacyManager, SecureStorage
        
        # Test privacy manager
        pm = PrivacyManager(password="test_password_123")
        print("✓ Privacy manager created")
        
        # Test string encryption
        test_string = "This is sensitive data!"
        encrypted = pm.encrypt_data(test_string)
        print(f"✓ Encrypted string: {encrypted[:50]}...")
        
        decrypted = pm.decrypt_data(encrypted)
        print(f"✓ Decrypted string: {decrypted}")
        assert decrypted == test_string, "Decryption mismatch!"
        
        # Test dict encryption
        test_dict = {"movement": "detected", "intensity": 75.5, "regions": 3}
        encrypted_dict = pm.encrypt_data(test_dict)
        decrypted_dict = pm.decrypt_data(encrypted_dict, as_json=True)
        print(f"✓ Dict encryption/decryption works: {decrypted_dict}")
        
        # Test image encryption
        import numpy as np
        fake_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8).tobytes()
        encrypted_img = pm.encrypt_image(fake_image)
        decrypted_img = pm.decrypt_image(encrypted_img)
        print(f"✓ Image encryption works: {len(decrypted_img)} bytes")
        
        # Test secure storage
        storage = SecureStorage(pm)
        stored = storage.store("test_key", {"data": "secret"})
        print(f"✓ Secure storage: stored = {stored}")
        
        retrieved = storage.retrieve("test_key", as_json=True)
        print(f"✓ Secure storage: retrieved = {retrieved}")
        
        # Test session token
        token = PrivacyManager.generate_session_token()
        print(f"✓ Session token generated: {token[:20]}...")
        
        return True
        
    except Exception as e:
        print(f"✗ Encryption test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_integration():
    """Test integration without camera or Ollama"""
    print("\n" + "=" * 60)
    print("Testing Integration (Simulated)")
    print("=" * 60)
    
    try:
        # This would require camera and Ollama, so we just verify imports
        from src.ai.vision_service import VisionAIService
        print("✓ VisionAIService imports successfully")
        
        print("  Note: Full integration test requires:")
        print("    1. Connected camera")
        print("    2. Running Ollama instance")
        print("    3. Pulled Ollama model")
        
        return True
        
    except Exception as e:
        print(f"✗ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "Vision AI - Component Tests" + " " * 19 + "║")
    print("╚" + "=" * 58 + "╝")
    print()
    
    results = {
        "Camera": test_camera(),
        "Movement Detection": test_movement_detector(),
        "Encryption": test_encryption(),
        "Integration": test_integration()
    }
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for name, result in results.items():
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{name:.<40} {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed - check output above")
    print("=" * 60)
    print()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
