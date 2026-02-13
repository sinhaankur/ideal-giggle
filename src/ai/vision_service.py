"""
Vision AI Service - Integrates camera, movement detection, audio, and Ollama AI
Analyzes movement patterns with AI while maintaining privacy through encryption
Includes multimodal analysis with audio transcription
"""

import json
from typing import Dict, List, Optional
import base64
from datetime import datetime
import threading
import time

from src.camera import CameraManager, MovementDetector, get_camera_manager
from src.privacy import PrivacyManager, SecureStorage, get_privacy_manager
from src.ai.ai_client import AIClient, AIProvider
from src.audio import AudioManager, get_audio_manager


class VisionAIService:
    """
    Integrated service for AI-powered vision analysis with privacy
    Includes audio capture and multimodal analysis
    """
    
    def __init__(
        self,
        camera_index: int = 0,
        privacy_password: str = "secure_building_mgmt_2026",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "llama3.1:8b"
    ):
        """
        Initialize Vision AI Service
        
        Args:
            camera_index: Camera device index
            privacy_password: Password for encryption
            ollama_url: Ollama server URL
            ollama_model: Ollama model name
        """
        # Initialize components
        self.camera = get_camera_manager(camera_index)
        self.detector = MovementDetector(sensitivity=25, min_area=500)
        self.privacy = get_privacy_manager(privacy_password)
        self.secure_storage = SecureStorage(self.privacy)
        self.audio = get_audio_manager()
        
        # Initialize AI client
        self.ai_client = AIClient(
            provider=AIProvider.OLLAMA,
            base_url=ollama_url,
            model=ollama_model
        )
        
        # Monitoring state
        self.is_monitoring = False
        self.monitoring_thread = None
        self.analysis_interval = 2.0  # Analyze every 2 seconds
        self.last_analysis_time = 0
        self.last_audio_transcription = ""
        self.last_transcription_time = 0
        
        # Statistics
        self.stats = {
            'total_frames': 0,
            'movements_detected': 0,
            'ai_analyses': 0,
            'audio_transcriptions': 0,
            'started_at': None
        }
    
    def start_monitoring(self, camera_index: int = None, enable_audio: bool = True) -> Dict:
        """
        Start camera monitoring and movement detection
        
        Args:
            camera_index: Camera device index (None to use existing)
            enable_audio: Whether to enable audio recording
            
        Returns:
            Status dictionary
        """
        if self.is_monitoring:
            return {
                'success': False,
                'message': 'Monitoring already active'
            }
        
        # Reinitialize camera if different index specified
        if camera_index is not None and camera_index != self.camera.camera_index:
            self.camera.stop()
            from src.camera.camera_manager import get_camera_manager
            self.camera = get_camera_manager(camera_index)
        
        # Start camera
        if not self.camera.start():
            # Get more detailed error information
            import subprocess
            import os
            
            error_details = {
                'success': False,
                'error': 'Failed to start camera',
                'troubleshooting': []
            }
            
            # Check if camera device exists
            camera_device = f'/dev/video{self.camera.camera_index}'
            if os.path.exists(camera_device):
                error_details['troubleshooting'].append(f'✓ Camera device exists: {camera_device}')
                
                # Check permissions
                try:
                    stat_info = os.stat(camera_device)
                    error_details['troubleshooting'].append(f'Camera permissions: {oct(stat_info.st_mode)[-3:]}')
                except:
                    pass
                
                # Check if user in video group
                try:
                    result = subprocess.run(['groups'], capture_output=True, text=True)
                    if 'video' not in result.stdout:
                        error_details['troubleshooting'].append('✗ User NOT in "video" group')
                        error_details['fix'] = 'Run: sudo usermod -a -G video $USER (then logout/login)'
                    else:
                        error_details['troubleshooting'].append('✓ User is in "video" group')
                except:
                    pass
            else:
                error_details['troubleshooting'].append(f'✗ Camera device not found: {camera_device}')
                error_details['fix'] = 'Check if camera is connected: ls -l /dev/video*'
            
            return error_details
        
        # Start audio recording if enabled
        audio_started = False
        if enable_audio:
            audio_started = self.audio.start_recording()
        
        # Start monitoring thread
        self.is_monitoring = True
        self.stats['started_at'] = datetime.now().isoformat()
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        
        return {
            'success': True,
            'message': 'Camera monitoring started',
            'camera_info': self.camera.get_camera_info(),
            'audio_enabled': audio_started,
            'camera_index': self.camera.camera_index
        }
    
    def stop_monitoring(self) -> Dict:
        """
        Stop camera monitoring
        
        Returns:
            Status dictionary
        """
        if not self.is_monitoring:
            return {
                'success': False,
                'message': 'Monitoring not active'
            }
        
        self.is_monitoring = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5.0)
        
        self.camera.stop()
        self.audio.stop_recording()
        
        return {
            'success': True,
            'message': 'Camera monitoring stopped',
            'stats': self.get_statistics()
        }
    
    def _monitoring_loop(self):
        """Background monitoring loop"""
        while self.is_monitoring:
            try:
                # Capture frame
                frame = self.camera.capture_frame()
                if frame is None:
                    time.sleep(0.1)
                    continue
                
                self.stats['total_frames'] += 1
                
                # Detect movement
                movement_result = self.detector.detect_with_background_subtraction(frame)
                
                if movement_result.get('detected', False):
                    self.stats['movements_detected'] += 1
                    
                    # Store encrypted movement data
                    storage_key = f"movement_{datetime.now().timestamp()}"
                    self.secure_storage.store(storage_key, movement_result)
                    
                    # Trigger AI analysis if enough time has passed
                    current_time = time.time()
                    if current_time - self.last_analysis_time >= self.analysis_interval:
                        # Try to get audio transcription
                        audio_text = None
                        if current_time - self.last_transcription_time >= 5.0:
                            audio_text = self.audio.transcribe_recent_audio(duration_seconds=5.0)
                            if audio_text:
                                self.last_audio_transcription = audio_text
                                self.last_transcription_time = current_time
                                self.stats['audio_transcriptions'] += 1
                        
                        self._analyze_movement_with_ai(movement_result, audio_text)
                        self.last_analysis_time = current_time
                
                # Small sleep to prevent CPU overload
                time.sleep(0.05)
                
            except Exception as e:
                print(f"Error in monitoring loop: {e}")
                time.sleep(0.5)
    
    def _analyze_movement_with_ai(self, movement_data: Dict, audio_text: Optional[str] = None):
        """
        Analyze movement data with Ollama AI (with optional audio context)
        
        Args:
            movement_data: Movement detection results
            audio_text: Transcribed audio text for additional context
        """
        try:
            # Create analysis prompt
            prompt = self._create_analysis_prompt(movement_data, audio_text)
            
            # Get AI analysis
            response = self.ai_client.chat(
                message=prompt,
                temperature=0.3,
                max_tokens=500
            )
            
            if response and 'message' in response:
                analysis = {
                    'timestamp': datetime.now().isoformat(),
                    'movement_summary': {
                        'regions': movement_data.get('region_count', 0),
                        'intensity': movement_data.get('intensity', 0)
                    },
                    'audio_context': audio_text,
                    'ai_analysis': response['message'],
                    'encrypted': True
                }
                
                # Store encrypted analysis
                storage_key = f"analysis_{datetime.now().timestamp()}"
                self.secure_storage.store(storage_key, analysis)
                
                self.stats['ai_analyses'] += 1
                
        except Exception as e:
            print(f"Error in AI analysis: {e}")
    
    def _create_analysis_prompt(self, movement_data: Dict, audio_text: Optional[str] = None) -> str:
        """
        Create prompt for AI analysis
        
        Args:
            movement_data: Movement detection data
            audio_text: Transcribed audio for context
            
        Returns:
            Analysis prompt
        """
        history = self.detector.get_movement_summary()
        
        prompt = f"""Analyze the following movement detection data from a building security camera:

Current Movement:
- Detected regions: {movement_data.get('region_count', 0)}
- Movement intensity: {movement_data.get('intensity', 0)}%
- Total area: {movement_data.get('total_area', 0)} pixels

Movement History:
- Total detections: {history.get('total_detections', 0)}
- Average intensity: {history.get('average_intensity', 0)}%
- Max intensity: {history.get('max_intensity', 0)}%"""

        if audio_text:
            prompt += f"""

Audio Context (from microphone):
"{audio_text}"

Consider the audio context when analyzing the movement."""
        
        prompt += """

Provide a brief security analysis:
1. Is this normal activity or unusual?
2. What type of movement pattern does this suggest?
3. Any security recommendations?

Keep the response concise (2-3 sentences)."""
        
        return prompt
    
    def get_current_frame(self, encrypted: bool = True, annotated: bool = True) -> Optional[Dict]:
        """
        Get current camera frame with optional movement annotations
        
        Args:
            encrypted: Return encrypted image
            annotated: Draw movement detection on frame
            
        Returns:
            Dictionary with frame data
        """
        frame = self.camera.capture_frame()
        if frame is None:
            return None
        
        # Detect movement and annotate if requested
        if annotated:
            movement_result = self.detector.detect_with_background_subtraction(frame)
            if movement_result.get('detected', False):
                frame = self.detector.draw_movement(frame, movement_result)
        
        # Get frame as JPEG
        jpeg_bytes = self.camera.get_frame_as_jpeg(quality=85)
        if jpeg_bytes is None:
            return None
        
        # Encrypt if requested
        if encrypted:
            image_data = self.privacy.encrypt_image(jpeg_bytes)
        else:
            image_data = base64.b64encode(jpeg_bytes).decode('utf-8')
        
        return {
            'image': image_data,
            'encrypted': encrypted,
            'annotated': annotated,
            'timestamp': datetime.now().isoformat()
        }
    
    def get_movement_analysis(self, limit: int = 10, decrypt: bool = True) -> List[Dict]:
        """
        Get recent movement analyses
        
        Args:
            limit: Maximum number of analyses to return
            decrypt: Return decrypted data
            
        Returns:
            List of movement analyses
        """
        # Get analysis keys
        keys = [k for k in self.secure_storage.list_keys() if k.startswith('analysis_')]
        keys.sort(reverse=True)
        keys = keys[:limit]
        
        analyses = []
        for key in keys:
            if decrypt:
                data = self.secure_storage.retrieve(key, as_json=True)
                if data:
                    analyses.append(data)
            else:
                # Return encrypted
                encrypted_data = self.secure_storage.storage.get(key)
                if encrypted_data:
                    analyses.append({'key': key, 'data': encrypted_data})
        
        return analyses
    
    def get_movement_history(self, limit: int = 50) -> List[Dict]:
        """
        Get movement detection history
        
        Args:
            limit: Maximum number of history items
            
        Returns:
            List of movement detections
        """
        return self.detector.get_movement_history(limit)
    
    def get_statistics(self) -> Dict:
        """
        Get service statistics
        
        Returns:
            Statistics dictionary
        """
        stats = self.stats.copy()
        stats['is_monitoring'] = self.is_monitoring
        stats['camera_active'] = self.camera.is_active
        stats['audio_recording'] = self.audio.is_recording
        stats['audio_level'] = self.audio.get_audio_level()
        stats['movement_summary'] = self.detector.get_movement_summary()
        stats['last_audio_transcription'] = self.last_audio_transcription
        return stats
    
    def analyze_current_situation(self) -> Dict:
        """
        Get AI analysis of current situation
        
        Returns:
            AI analysis with movement and audio data
        """
        # Get current frame and detect movement
        frame = self.camera.capture_frame()
        if frame is None:
            return {
                'success': False,
                'error': 'No frame available'
            }
        
        movement_result = self.detector.detect_with_background_subtraction(frame)
        
        # Get audio transcription
        audio_text = self.audio.transcribe_recent_audio(duration_seconds=5.0)
        
        # Get AI analysis
        prompt = self._create_analysis_prompt(movement_result, audio_text)
        ai_response = self.ai_client.chat(
            message=prompt,
            temperature=0.3,
            max_tokens=500
        )
        
        return {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'movement_data': movement_result,
            'audio_transcription': audio_text,
            'ai_analysis': ai_response.get('message', 'No analysis available'),
            'encrypted': False
        }
    
    def get_encrypted_status(self) -> Dict:
        """
        Get encryption status and information
        
        Returns:
            Encryption status
        """
        return {
            'encryption_enabled': True,
            'encryption_algorithm': 'Fernet (AES-128-CBC)',
            'secure_storage_keys': len(self.secure_storage.list_keys()),
            'data_privacy': 'All camera and movement data is encrypted at rest',
            'local_processing': 'All AI processing happens locally via Ollama',
            'audio_privacy': 'Audio transcription uses Google API (requires internet)'
        }


# Global service instance
_vision_service = None
_service_lock = threading.Lock()


def get_vision_service(**kwargs) -> VisionAIService:
    """
    Get or create global vision AI service instance
    
    Args:
        **kwargs: Arguments for VisionAIService constructor
        
    Returns:
        VisionAIService instance
    """
    global _vision_service
    with _service_lock:
        if _vision_service is None:
            _vision_service = VisionAIService(**kwargs)
        return _vision_service
