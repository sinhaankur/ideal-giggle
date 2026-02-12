"""
Audio Manager for Building Management AI
Handles microphone capture and audio processing
"""

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    print("Warning: PyAudio not available. Audio features will be disabled.")

try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False
    print("Warning: SpeechRecognition not available. Transcription disabled.")

import wave
import threading
import time
import io
from typing import Optional, Callable
from datetime import datetime


class AudioManager:
    """Manages microphone capture and audio processing"""
    
    def __init__(
        self,
        sample_rate: int = 16000,
        channels: int = 1,
        chunk_size: int = 1024
    ):
        """
        Initialize audio manager
        
        Args:
            sample_rate: Audio sample rate (Hz)
            channels: Number of audio channels (1=mono, 2=stereo)
            chunk_size: Audio buffer chunk size
        """
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self.format = pyaudio.paInt16 if PYAUDIO_AVAILABLE else None
        
        self.pyaudio = pyaudio.PyAudio() if PYAUDIO_AVAILABLE else None
        self.stream = None
        self.is_recording = False
        self.recognizer = sr.Recognizer() if SR_AVAILABLE else None
        
        # Recording state
        self.audio_buffer = []
        self.recording_thread = None
        self.lock = threading.Lock()
        
    def start_recording(self) -> bool:
        """
        Start recording audio from microphone
        
        Returns:
            True if recording started successfully
        """
        if not PYAUDIO_AVAILABLE:
            print("PyAudio not available - audio recording disabled")
            return False
            
        if self.is_recording:
            return False
        
        try:
            self.stream = self.pyaudio.open(
                format=self.format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size
            )
            
            self.is_recording = True
            self.audio_buffer = []
            
            # Start recording thread
            self.recording_thread = threading.Thread(
                target=self._recording_loop,
                daemon=True
            )
            self.recording_thread.start()
            
            return True
        except Exception as e:
            print(f"Error starting audio recording: {e}")
            return False
    
    def stop_recording(self) -> bool:
        """
        Stop recording audio
        
        Returns:
            True if stopped successfully
        """
        if not self.is_recording:
            return False
        
        self.is_recording = False
        
        if self.recording_thread:
            self.recording_thread.join(timeout=2.0)
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        
        return True
    
    def _recording_loop(self):
        """Background recording loop"""
        while self.is_recording:
            try:
                data = self.stream.read(self.chunk_size, exception_on_overflow=False)
                with self.lock:
                    self.audio_buffer.append(data)
                    # Keep only last 30 seconds of audio
                    max_chunks = int(30 * self.sample_rate / self.chunk_size)
                    if len(self.audio_buffer) > max_chunks:
                        self.audio_buffer = self.audio_buffer[-max_chunks:]
            except Exception as e:
                print(f"Error in recording loop: {e}")
                time.sleep(0.1)
    
    def get_audio_level(self) -> float:
        """
        Get current audio level (0-100)
        
        Returns:
            Audio level percentage
        """
        if not self.audio_buffer:
            return 0.0
        
        try:
            with self.lock:
                if self.audio_buffer:
                    recent_data = self.audio_buffer[-5:]  # Last 5 chunks
                else:
                    return 0.0
            
            # Calculate RMS level
            import numpy as np
            audio_data = np.frombuffer(b''.join(recent_data), dtype=np.int16)
            rms = np.sqrt(np.mean(audio_data**2))
            
            # Normalize to 0-100 (assuming max is 32767 for int16)
            level = min(100, (rms / 32767.0) * 100 * 10)  # Scale up for visibility
            return level
        except Exception as e:
            print(f"Error calculating audio level: {e}")
            return 0.0
    
    def transcribe_recent_audio(self, duration_seconds: float = 5.0) -> Optional[str]:
        """
        Transcribe recent audio using speech recognition
        
        Args:
            duration_seconds: Duration of audio to transcribe
            SR_AVAILABLE:
            return None
            
        if not 
        Returns:
            Transcribed text or None
        """
        if not self.audio_buffer:
            return None
        
        try:
            # Get recent audio chunks
            chunks_needed = int(duration_seconds * self.sample_rate / self.chunk_size)
            
            with self.lock:
                if len(self.audio_buffer) < chunks_needed:
                    recent_chunks = self.audio_buffer.copy()
                else:
                    recent_chunks = self.audio_buffer[-chunks_needed:]
            
            if not recent_chunks:
                return None
            
            # Combine chunks into audio data
            audio_data = b''.join(recent_chunks)
            
            # Create AudioData object for speech recognition
            audio = sr.AudioData(audio_data, self.sample_rate, 2)
            
            # Attempt transcription
            try:
                text = self.recognizer.recognize_google(audio, language='en-US')
                return text
            except sr.UnknownValueError:
                return None  # Speech not understood
            except sr.RequestError as e:
                print(f"Speech recognition error: {e}")
                return None
                
        except Exception as e:
            print(f"Error transcribing audio: {e}")
            return None
    
    def get_audio_summary(self) -> dict:
        """
        Get summary of current audio state
        
        Returns:
            Dictionary with audio information
        """
        return {
            'is_recording': self.is_recording,
            'sample_rate': self.sample_rate,
            'channels': self.channels,
            'buffer_duration': len(self.audio_buffer) * self.chunk_size / self.sample_rate,
            'audio_level': self.get_audio_level(),
            'timestamp': datetime.now().isoformat()
        }
    
    def save_audio_to_file(self, filename: str, duration_seconds: float = 5.0) -> bool:
        """
        Save recent audio to WAV file
        
        Args:
            filename: Output filename
            duration_seconds: Duration to save
            
        Returns:
            True if saved successfully
        """
        if not self.audio_buffer:
            return False
        
        try:
            chunks_needed = int(duration_seconds * self.sample_rate / self.chunk_size)
            
            with self.lock:
                if len(self.audio_buffer) < chunks_needed:
                    recent_chunks = self.audio_buffer.copy()
                else:
                    recent_chunks = self.audio_buffer[-chunks_needed:]
            
            audio_data = b''.join(recent_chunks)
            
            # Write to WAV file
            with wave.open(filename, 'wb') as wf:
                wf.setnchannels(self.channels)
                if self.pyaudio:
                    wf.setsampwidth(self.pyaudio.get_sample_size(self.format))
                else:
                    wf.setsampwidth(2)  # 16-bit
                wf.setframerate(self.sample_rate)
                wf.writeframes(audio_data)
            
            return True
        except Exception as e:
            print(f"Error saving audio: {e}")
            return False
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop_recording()
        if self.pyaudio:
            self.pyaudio.terminate()


# Global audio instance
_audio_instance = None
_audio_lock = threading.Lock()


def get_audio_manager(**kwargs) -> AudioManager:
    """
    Get or create audio manager instance (singleton)
    
    Returns:
        AudioManager instance
    """
    global _audio_instance
    with _audio_lock:
        if _audio_instance is None:
            _audio_instance = AudioManager(**kwargs)
        return _audio_instance
