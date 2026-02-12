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
        for i in range(max_test):
            cap = cv2.VideoCapture(i, cv2.CAP_V4L2)
            try:
                if not cap.isOpened():
                    continue
                # Avoid blocking read during enumeration
                backend = cap.getBackendName()
                available.append({
                    'index': i,
                    'name': f'Camera {i}',
                    'backend': backend
                })
            finally:
                cap.release()
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
            self.camera = cv2.VideoCapture(self.camera_index)
            if not self.camera.isOpened():
                return False
            
            # Set camera properties
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, self.fps)
            
            self.is_active = True
            return True
        except Exception as e:
            print(f"Error starting camera: {e}")
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
