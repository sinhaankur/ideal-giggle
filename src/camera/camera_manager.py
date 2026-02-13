"""
Camera Manager for Building Management AI
Handles camera capture and video streaming with privacy features
"""

import cv2
import numpy as np
from typing import Optional, Tuple, Dict
import base64
import threading
import time
from datetime import datetime


class CameraManager:
    """Manages camera capture and video processing"""
    
    @staticmethod
    def list_available_cameras(max_test: int = 10) -> list:
        """
        List all available camera devices
        
        Args:
            max_test: Maximum number of camera indices to test
            
        Returns:
            List of available camera indices with their names
        """
        available = []
        import os
        
        # First check for /dev/video* devices (Linux)
        video_devices = []
        for i in range(max_test):
            device_path = f'/dev/video{i}'
            if os.path.exists(device_path):
                video_devices.append((i, device_path))
        
        # Test each potential camera
        for i in range(max_test):
            # Try multiple backends
            for backend in [cv2.CAP_V4L2, cv2.CAP_ANY]:
                try:
                    cap = cv2.VideoCapture(i, backend)
                    if cap.isOpened():
                        # Try to read a frame to verify it works
                        ret, frame = cap.read()
                        if ret and frame is not None:
                            backend_name = cap.getBackendName()
                            available.append({
                                'index': i,
                                'name': f'Camera {i}',
                                'backend': backend_name,
                                'device': f'/dev/video{i}' if (i, f'/dev/video{i}') in video_devices else 'Unknown'
                            })
                            cap.release()
                            break  # Found working camera, no need to try other backends
                    cap.release()
                except Exception as e:
                    pass
        
        # If no cameras found but /dev/video* exists, add them with warning
        if not available and video_devices:
            for idx, device in video_devices:
                available.append({
                    'index': idx,
                    'name': f'Camera {idx} (Permission Issue)',
                    'backend': 'None',
                    'device': device,
                    'warning': 'Device exists but cannot be opened - check permissions'
                })
        
        return available
    
    def __init__(self, camera_index: int = 0):
        """
        Initialize camera manager
        
        Args:
            camera_index: Index of the camera device (default: 0 for primary camera)
        """
        self.camera_index = camera_index
        self.camera = None
        self.is_active = False
        self.current_frame = None
        self.lock = threading.Lock()
        self.frame_count = 0
        self.fps = 30
        
    def start(self) -> bool:
        """
        Start camera capture
        
        Returns:
            True if camera started successfully, False otherwise
        """
        try:
            # Try different backends in order of preference
            backends = [
                cv2.CAP_V4L2,      # Linux Video4Linux2
                cv2.CAP_ANY,       # Auto-detect
                cv2.CAP_GSTREAMER  # GStreamer fallback
            ]
            
            last_error = None
            for backend in backends:
                try:
                    self.camera = cv2.VideoCapture(self.camera_index, backend)
                    
                    if self.camera.isOpened():
                        # Try to read a test frame to verify camera works
                        ret, test_frame = self.camera.read()
                        if ret and test_frame is not None:
                            # Set camera properties
                            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                            self.camera.set(cv2.CAP_PROP_FPS, self.fps)
                            
                            self.is_active = True
                            print(f"✓ Camera {self.camera_index} started with backend: {backend}")
                            return True
                        else:
                            self.camera.release()
                            last_error = f"Camera opened but cannot read frames (backend {backend})"
                    else:
                        self.camera = None
                        last_error = f"Cannot open camera with backend {backend}"
                except Exception as e:
                    last_error = f"Backend {backend} error: {str(e)}"
                    if self.camera:
                        self.camera.release()
                        self.camera = None
            
            # All backends failed
            error_msg = last_error or "All backends failed"
            print(f"✗ Failed to start camera {self.camera_index}: {error_msg}")
            print(f"  Hint: Check if user is in 'video' group: groups | grep video")
            print(f"  Hint: Check camera permissions: ls -l /dev/video{self.camera_index}")
            return False
            
        except Exception as e:
            print(f"✗ Error starting camera: {e}")
            print(f"  Hint: Ensure OpenCV is properly installed: pip install opencv-python")
            return False
    
    def stop(self):
        """Stop camera capture"""
        self.is_active = False
        if self.camera:
            self.camera.release()
            self.camera = None
    
    def capture_frame(self) -> Optional[np.ndarray]:
        """
        Capture a single frame from camera
        
        Returns:
            Frame as numpy array or None if capture failed
        """
        if not self.camera or not self.is_active:
            return None
        
        try:
            ret, frame = self.camera.read()
            if ret:
                with self.lock:
                    self.current_frame = frame
                    self.frame_count += 1
                return frame
            return None
        except Exception as e:
            print(f"Error capturing frame: {e}")
            return None
    
    def get_frame_as_jpeg(self, quality: int = 85) -> Optional[bytes]:
        """
        Get current frame as JPEG bytes
        
        Args:
            quality: JPEG quality (1-100)
            
        Returns:
            JPEG image as bytes or None
        """
        if self.current_frame is None:
            frame = self.capture_frame()
        else:
            frame = self.current_frame
        
        if frame is None:
            return None
        
        try:
            # Encode frame as JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
            _, buffer = cv2.imencode('.jpg', frame, encode_param)
            return buffer.tobytes()
        except Exception as e:
            print(f"Error encoding frame: {e}")
            return None
    
    def get_frame_as_base64(self, quality: int = 85) -> Optional[str]:
        """
        Get current frame as base64-encoded JPEG
        
        Args:
            quality: JPEG quality (1-100)
            
        Returns:
            Base64-encoded JPEG string or None
        """
        jpeg_bytes = self.get_frame_as_jpeg(quality)
        if jpeg_bytes:
            return base64.b64encode(jpeg_bytes).decode('utf-8')
        return None
    
    def get_camera_info(self) -> Dict:
        """
        Get camera information
        
        Returns:
            Dictionary with camera properties
        """
        if not self.camera:
            return {
                'active': False,
                'error': 'Camera not initialized'
            }
        
        return {
            'active': self.is_active,
            'width': int(self.camera.get(cv2.CAP_PROP_FRAME_WIDTH)),
            'height': int(self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            'fps': int(self.camera.get(cv2.CAP_PROP_FPS)),
            'frame_count': self.frame_count
        }
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop()


# Global camera instance
_camera_instance = None
_camera_lock = threading.Lock()


def get_camera_manager(camera_index: int = 0) -> CameraManager:
    """
    Get or create camera manager instance (singleton pattern)
    
    Args:
        camera_index: Camera device index
        
    Returns:
        CameraManager instance
    """
    global _camera_instance
    with _camera_lock:
        if _camera_instance is None:
            _camera_instance = CameraManager(camera_index)
        return _camera_instance
