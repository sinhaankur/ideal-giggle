"""
Movement Detection Module for Building Management AI
Detects and tracks movement using computer vision
"""

import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import json


class MovementDetector:
    """Detects and tracks movement in video frames"""
    
    def __init__(self, sensitivity: int = 25, min_area: int = 500):
        """
        Initialize movement detector
        
        Args:
            sensitivity: Motion detection sensitivity (lower = more sensitive)
            min_area: Minimum contour area to be considered as movement
        """
        self.sensitivity = sensitivity
        self.min_area = min_area
        self.previous_frame = None
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500,
            varThreshold=sensitivity,
            detectShadows=True
        )
        self.movement_history = []
        self.max_history = 100
        
    def detect_movement(self, frame: np.ndarray) -> Dict:
        """
        Detect movement in frame
        
        Args:
            frame: Current video frame
            
        Returns:
            Dictionary containing movement detection results
        """
        if frame is None:
            return {
                'detected': False,
                'error': 'No frame provided'
            }
        
        timestamp = datetime.now().isoformat()
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        # Initialize previous frame if needed
        if self.previous_frame is None:
            self.previous_frame = gray
            return {
                'detected': False,
                'timestamp': timestamp,
                'message': 'Initializing'
            }
        
        # Calculate frame difference
        frame_delta = cv2.absdiff(self.previous_frame, gray)
        thresh = cv2.threshold(frame_delta, self.sensitivity, 255, cv2.THRESH_BINARY)[1]
        
        # Dilate to fill holes
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        # Find contours
        contours, _ = cv2.findContours(
            thresh.copy(),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Filter contours by area
        movement_regions = []
        total_movement_area = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.min_area:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            movement_regions.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
                'area': int(area),
                'center': (int(x + w/2), int(y + h/2))
            })
            total_movement_area += area
        
        # Calculate movement intensity
        frame_area = frame.shape[0] * frame.shape[1]
        movement_intensity = (total_movement_area / frame_area) * 100
        
        # Update previous frame
        self.previous_frame = gray
        
        # Create result
        result = {
            'detected': len(movement_regions) > 0,
            'timestamp': timestamp,
            'regions': movement_regions,
            'region_count': len(movement_regions),
            'total_area': int(total_movement_area),
            'intensity': round(movement_intensity, 2),
            'frame_size': {
                'width': frame.shape[1],
                'height': frame.shape[0]
            }
        }
        
        # Add to history
        self._add_to_history(result)
        
        return result
    
    def detect_with_background_subtraction(self, frame: np.ndarray) -> Dict:
        """
        Detect movement using background subtraction (more advanced)
        
        Args:
            frame: Current video frame
            
        Returns:
            Dictionary containing movement detection results
        """
        if frame is None:
            return {
                'detected': False,
                'error': 'No frame provided'
            }
        
        timestamp = datetime.now().isoformat()
        
        # Apply background subtraction
        fg_mask = self.background_subtractor.apply(frame)
        
        # Remove shadows (value 127)
        _, fg_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
        
        # Morphological operations to remove noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(
            fg_mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Process contours
        movement_regions = []
        total_movement_area = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.min_area:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            movement_regions.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
                'area': int(area),
                'center': (int(x + w/2), int(y + h/2))
            })
            total_movement_area += area
        
        # Calculate movement intensity
        frame_area = frame.shape[0] * frame.shape[1]
        movement_intensity = (total_movement_area / frame_area) * 100
        
        # Create result
        result = {
            'detected': len(movement_regions) > 0,
            'timestamp': timestamp,
            'regions': movement_regions,
            'region_count': len(movement_regions),
            'total_area': int(total_movement_area),
            'intensity': round(movement_intensity, 2),
            'frame_size': {
                'width': frame.shape[1],
                'height': frame.shape[0]
            },
            'method': 'background_subtraction'
        }
        
        # Add to history
        self._add_to_history(result)
        
        return result
    
    def draw_movement(self, frame: np.ndarray, detection_result: Dict) -> np.ndarray:
        """
        Draw movement detection results on frame
        
        Args:
            frame: Original frame
            detection_result: Detection result from detect_movement()
            
        Returns:
            Frame with movement visualization
        """
        if not detection_result.get('detected', False):
            return frame
        
        annotated_frame = frame.copy()
        
        # Draw rectangles around movement regions
        for region in detection_result.get('regions', []):
            x, y, w, h = region['x'], region['y'], region['width'], region['height']
            
            # Draw rectangle
            cv2.rectangle(annotated_frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # Draw center point
            center = region['center']
            cv2.circle(annotated_frame, center, 5, (0, 0, 255), -1)
            
            # Add area text
            area_text = f"Area: {region['area']}"
            cv2.putText(
                annotated_frame,
                area_text,
                (x, y - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2
            )
        
        # Add summary info
        info_text = f"Regions: {detection_result['region_count']} | Intensity: {detection_result['intensity']}%"
        cv2.putText(
            annotated_frame,
            info_text,
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 255),
            2
        )
        
        return annotated_frame
    
    def get_movement_history(self, limit: Optional[int] = None) -> List[Dict]:
        """
        Get movement detection history
        
        Args:
            limit: Maximum number of history items to return
            
        Returns:
            List of detection results
        """
        if limit:
            return self.movement_history[-limit:]
        return self.movement_history.copy()
    
    def _add_to_history(self, result: Dict):
        """Add detection result to history"""
        # Only store if movement detected
        if result.get('detected', False):
            self.movement_history.append({
                'timestamp': result['timestamp'],
                'region_count': result['region_count'],
                'total_area': result['total_area'],
                'intensity': result['intensity']
            })
            
            # Limit history size
            if len(self.movement_history) > self.max_history:
                self.movement_history = self.movement_history[-self.max_history:]
    
    def get_movement_summary(self) -> Dict:
        """
        Get summary statistics of recent movement
        
        Returns:
            Dictionary with movement statistics
        """
        if not self.movement_history:
            return {
                'total_detections': 0,
                'average_intensity': 0,
                'max_intensity': 0,
                'message': 'No movement detected yet'
            }
        
        intensities = [h['intensity'] for h in self.movement_history]
        
        return {
            'total_detections': len(self.movement_history),
            'average_intensity': round(sum(intensities) / len(intensities), 2),
            'max_intensity': max(intensities),
            'min_intensity': min(intensities),
            'recent_detection': self.movement_history[-1]['timestamp']
        }
    
    def reset(self):
        """Reset detector state"""
        self.previous_frame = None
        self.movement_history = []
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500,
            varThreshold=self.sensitivity,
            detectShadows=True
        )
