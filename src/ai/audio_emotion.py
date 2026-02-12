"""
Audio Emotion Analysis - Detects emotions from audio input
Integrates speech recognition, tone analysis, and emotional classification
"""

import numpy as np
from typing import Dict, Optional, List, Tuple
from datetime import datetime
from collections import deque
import threading
import json
import tempfile
import os

# Try to import speech recognition
try:
    import speech_recognition as sr
    SPEECH_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEECH_RECOGNITION_AVAILABLE = False
    print("⚠️  SpeechRecognition not available. Install with: pip install SpeechRecognition")

# Try to import librosa for audio analysis
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("⚠️  Librosa not available. Install with: pip install librosa")

# Try to import pyaudio for audio capture
try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    print("⚠️  PyAudio not available. Install with: pip install pyaudio")

# Try to import wave for audio file handling
try:
    import wave
    WAVE_AVAILABLE = True
except ImportError:
    WAVE_AVAILABLE = False


class AudioEmotionDetector:
    """Detects emotions from audio characteristics (pitch, amplitude, speed)"""
    
    def __init__(self):
        """Initialize audio emotion detector"""
        self.librosa_available = LIBROSA_AVAILABLE
        self.analysis_history = deque(maxlen=100)
    
    def analyze_audio_file(self, audio_path: str) -> Dict:
        """
        Analyze emotion from audio file characteristics
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Audio emotion analysis result
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'success': False,
            'method': 'none',
            'emotion': 'neutral',
            'confidence': 0,
            'icon': '😐',
            'characteristics': {}
        }
        
        if not self.librosa_available or not os.path.exists(audio_path):
            return result
        
        try:
            # Load audio file
            y, sr_rate = librosa.load(audio_path, sr=None)
            
            # Extract features
            characteristics = {}
            
            # Pitch-based features (using zero crossing rate as proxy for pitch variation)
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            characteristics['pitch_variation'] = float(np.mean(zcr))
            characteristics['pitch_stability'] = float(np.std(zcr))
            
            # Energy/Amplitude (RMS)
            rms = librosa.feature.rms(y=y)[0]
            characteristics['energy_mean'] = float(np.mean(rms))
            characteristics['energy_std'] = float(np.std(rms))
            characteristics['energy_max'] = float(np.max(rms))
            
            # Spectral features (Mel-frequency cepstral coefficients)
            mfcc = librosa.feature.mfcc(y=y, sr=sr_rate, n_mfcc=13)
            characteristics['spectral_centroid'] = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr_rate)))
            
            # Tempo/Speed (energy peaks per second)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr_rate)
            characteristics['speech_rate'] = float(len(onset_env) / (len(y) / sr_rate))
            
            result['characteristics'] = characteristics
            
            # Classify emotion based on characteristics
            result['emotion'], result['confidence'] = self._classify_emotion_from_audio(characteristics)
            result['icon'] = self._get_emotion_icon(result['emotion'])
            result['success'] = True
            result['method'] = 'librosa_acoustic'
            
            self.analysis_history.append(result.copy())
            
        except Exception as e:
            print(f"⚠️  Audio analysis error: {e}")
        
        return result
    
    def _classify_emotion_from_audio(self, characteristics: Dict) -> Tuple[str, float]:
        """
        Classify emotion based on acoustic characteristics
        
        Args:
            characteristics: Audio features dictionary
            
        Returns:
            Tuple of (emotion, confidence)
        """
        emotions = {}
        
        energy = characteristics.get('energy_mean', 0)
        pitch_variation = characteristics.get('pitch_variation', 0)
        pitch_stability = characteristics.get('pitch_stability', 0)
        speech_rate = characteristics.get('speech_rate', 0)
        
        # High energy + high pitch variation = excited/happy
        happiness_score = (energy * 0.5 + pitch_variation * 0.5)
        emotions['happy'] = happiness_score
        
        # Low energy + low pitch = sad
        sadness_score = (1 - energy) * 0.5 + (1 - pitch_variation) * 0.5
        emotions['sad'] = sadness_score
        
        # High pitch stability + moderate energy = angry
        anger_score = pitch_stability * 0.5 + (energy * 0.5)
        emotions['angry'] = anger_score
        
        # Normal characteristics = neutral
        emotions['neutral'] = 1 - max(happiness_score, sadness_score, anger_score)
        
        # Normalize scores to 0-100
        max_emotion = max(emotions.values()) or 0.01
        emotions = {k: (v / max_emotion) * 100 for k, v in emotions.items()}
        
        # Get dominant emotion
        dominant = max(emotions, key=emotions.get)
        confidence = emotions[dominant]
        
        return dominant, min(confidence, 100)
    
    def _get_emotion_icon(self, emotion: str) -> str:
        """Get emoji icon for emotion"""
        icons = {
            'happy': '😊',
            'sad': '😢',
            'angry': '😠',
            'neutral': '😐',
            'fear': '😨',
            'surprise': '😮'
        }
        return icons.get(emotion, '😐')


class SpeechRecognizer:
    """Transcribes speech from audio files or real-time input"""
    
    def __init__(self):
        """Initialize speech recognizer"""
        self.recognizer = None
        self.available = SPEECH_RECOGNITION_AVAILABLE
        
        if self.available:
            try:
                self.recognizer = sr.Recognizer()
                print("✅ Speech recognizer initialized")
            except Exception as e:
                print(f"⚠️  Could not initialize speech recognizer: {e}")
                self.available = False
        
        self.transcription_history = deque(maxlen=100)
    
    def transcribe_file(self, audio_path: str, language: str = 'en-US') -> Dict:
        """
        Transcribe audio file to text
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'en-US', 'es-ES')
            
        Returns:
            Transcription result
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'success': False,
            'text': '',
            'confidence': 0,
            'error': None
        }
        
        if not self.available or not os.path.exists(audio_path):
            result['error'] = 'Speech recognition not available or file not found'
            return result
        
        try:
            with sr.AudioFile(audio_path) as source:
                audio = self.recognizer.record(source)
            
            # Try Google Speech Recognition API
            try:
                text = self.recognizer.recognize_google(audio, language=language)
                result['success'] = True
                result['text'] = text
                result['confidence'] = 0.95  # Google API doesn't return confidence
                
                self.transcription_history.append(result.copy())
            
            except sr.UnknownValueError:
                result['error'] = 'Could not understand audio'
            except sr.RequestError as e:
                result['error'] = f'Google API error: {e}'
        
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    def transcribe_microphone(self, duration: float = 5.0, language: str = 'en-US') -> Dict:
        """
        Transcribe audio from microphone
        
        Args:
            duration: Duration to record in seconds
            language: Language code
            
        Returns:
            Transcription result
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'success': False,
            'text': '',
            'confidence': 0,
            'error': None,
            'duration': duration
        }
        
        if not self.available or not PYAUDIO_AVAILABLE:
            result['error'] = 'Microphone input not available'
            return result
        
        try:
            with sr.Microphone() as source:
                audio = self.recognizer.listen(source, timeout=int(duration) + 1)
            
            try:
                text = self.recognizer.recognize_google(audio, language=language)
                result['success'] = True
                result['text'] = text
                result['confidence'] = 0.95
                
                self.transcription_history.append(result.copy())
            
            except sr.UnknownValueError:
                result['error'] = 'Could not understand audio'
            except sr.RequestError as e:
                result['error'] = f'Google API error: {e}'
        
        except sr.RequestError:
            result['error'] = 'Microphone not available'
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    def get_history(self, limit: int = 10) -> List[Dict]:
        """Get transcription history"""
        return list(self.transcription_history)[-limit:]
    
    def get_statistics(self) -> Dict:
        """Get transcription statistics"""
        return {
            'total_transcribed': len(self.transcription_history),
            'successful': sum(1 for t in self.transcription_history if t['success']),
            'available': self.available
        }


class AudioProcessor:
    """Combines audio capture, transcription, and emotion analysis"""
    
    def __init__(self):
        """Initialize audio processor"""
        self.recognizer = SpeechRecognizer()
        self.emotion_detector = AudioEmotionDetector()
        self.combined_history = deque(maxlen=100)
        
        # Audio capture settings
        self.is_recording = False
        self.recording_thread = None
        self.audio_frames = []
        self.sample_rate = 16000
    
    def process_audio_file(self, audio_path: str) -> Dict:
        """
        Process audio file: transcribe and analyze emotion
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Combined transcription and emotion analysis
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'transcription': self.recognizer.transcribe_file(audio_path),
            'emotion': self.emotion_detector.analyze_audio_file(audio_path),
            'overall_audio_emotion': None
        }
        
        # Determine overall audio emotion
        if result['emotion']['success'] or result['transcription']['success']:
            result['overall_audio_emotion'] = {
                'emotion': result['emotion'].get('emotion', 'neutral'),
                'confidence': result['emotion'].get('confidence', 0),
                'icon': result['emotion'].get('icon', '😐'),
                'based_on': ['acoustic' if result['emotion']['success'] else None,
                            'transcription' if result['transcription']['success'] else None]
            }
        
        self.combined_history.append(result.copy())
        return result
    
    def process_microphone_input(self, duration: float = 5.0) -> Dict:
        """
        Record from microphone and process
        
        Args:
            duration: Duration to record in seconds
            
        Returns:
            Combined transcription and emotion analysis
        """
        # Transcribe from microphone
        transcription = self.recognizer.transcribe_microphone(duration=duration)
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'transcription': transcription,
            'emotion': {'success': False, 'emotion': 'neutral'},
            'overall_audio_emotion': None
        }
        
        # If we have audio file from recording, analyze it
        if transcription['success']:
            result['overall_audio_emotion'] = {
                'emotion': 'happy' if 'good' in transcription['text'].lower() or 'great' in transcription['text'].lower() else 'neutral',
                'confidence': 50.0,
                'icon': '😊' if 'happy' in transcription['text'].lower() else '😐',
                'based_on': ['transcription']
            }
        
        self.combined_history.append(result.copy())
        return result
    
    def get_statistics(self) -> Dict:
        """Get audio processing statistics"""
        return {
            'transcriber': self.recognizer.get_statistics(),
            'emotion_detector': {
                'total_analyzed': len(self.emotion_detector.analysis_history)
            },
            'combined_history_size': len(self.combined_history)
        }


# Singleton instances
_audio_processor = None
_emotion_detector = None

def get_audio_processor() -> AudioProcessor:
    """Get or create audio processor singleton"""
    global _audio_processor
    if _audio_processor is None:
        _audio_processor = AudioProcessor()
    return _audio_processor


def get_audio_emotion_detector() -> AudioEmotionDetector:
    """Get or create audio emotion detector singleton"""
    global _emotion_detector
    if _emotion_detector is None:
        _emotion_detector = AudioEmotionDetector()
    return _emotion_detector
