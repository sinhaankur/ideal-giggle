"""Camera module for video capture and processing"""

from .camera_manager import CameraManager, get_camera_manager
from .movement_detector import MovementDetector

__all__ = ['CameraManager', 'get_camera_manager', 'MovementDetector']
