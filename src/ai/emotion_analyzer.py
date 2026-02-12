"""
Emotion Analysis Module - Detects facial emotions and audio sentiment
Provides comprehensive emotion analysis from video and audio inputs
"""

import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import threading
from collections import deque
import json

# Try to import deepface for facial emotion recognition
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("⚠️  DeepFace not available. Install with: pip install deepface")

# Try to import mediapipe for face detection
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("⚠️  MediaPipe not available. Install with: pip install mediapipe")

# Try to import transformers for sentiment analysis
try:
    from transformers import pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("⚠️  Transformers not available. Install with: pip install transformers torch")


class FacialEmotionDetector:
    """Detects emotions from facial expressions in video frames"""
    
    # Emotion categories
    EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']
    EMOTION_ICONS = {
        'angry': '😠',
        'disgust': '🤮',
        'fear': '😨',
        'happy': '😊',
        'neutral': '😐',
        'sad': '😢',
        'surprise': '😮'
    }
    
    def __init__(self, model: str = 'vgg'):
        """
        Initialize facial emotion detector
        
        Args:
            model: Model to use ('vgg', 'resnet', 'mobilenet')
        """
        self.model = model
        self.detection_available = DEEPFACE_AVAILABLE
        self.use_mediapipe = MEDIAPIPE_AVAILABLE
        
        # Initialize MediaPipe face detection if available
        if self.use_mediapipe:
            self.mp_face_detection = mp.solutions.face_detection
            self.face_detector = self.mp_face_detection.FaceDetection(
                model_selection=1,
                min_detection_confidence=0.5
            )
        
        # Cache for frame analysis
        self.frame_cache = {}
        self.last_analysis_time = 0
        self.analysis_interval = 0.5  # Analyze every 0.5 seconds
        
        # Statistics
        self.total_frames_analyzed = 0
        self.faces_detected = 0
        self.detection_history = deque(maxlen=100)
    
    def detect_emotions(self, frame: np.ndarray) -> Dict:
        """
        Detect emotions in a frame
        
        Args:
            frame: Video frame (BGR format)
            
        Returns:
            Dictionary with detected emotions and metadata
        """
        current_time = datetime.now().timestamp()
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'faces_detected': 0,
            'emotions': [],
            'dominant_emotion': None,
            'success': False,
            'method': 'none'
        }
        
        # OPTIMIZATION: Quick check for faces with OpenCV first
        # This avoids expensive DeepFace analysis if no faces present
        try:
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            quick_faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(quick_faces) == 0:
                # No faces detected - skip expensive analysis
                self.total_frames_analyzed += 1
                return result
        except:
            pass  # If quick check fails, continue with normal analysis
        
        # Try DeepFace if available
        if self.detection_available:
            try:
                return self._analyze_with_deepface(frame, result)
            except Exception as e:
                print(f"⚠️  DeepFace analysis error: {e}")
        
        # Try MediaPipe face detection
        if self.use_mediapipe:
            try:
                return self._analyze_with_mediapipe(frame, result)
            except Exception as e:
                print(f"⚠️  MediaPipe analysis error: {e}")
        
        # Fallback: basic face detection with OpenCV
        try:
            return self._analyze_with_opencv(frame, result)
        except Exception as e:
            print(f"⚠️  OpenCV analysis error: {e}")
            return result
    
    def _analyze_with_deepface(self, frame: np.ndarray, result: Dict) -> Dict:
        """Analyze emotions using DeepFace"""
        try:
            # Analyze emotions
            analysis = DeepFace.analyze(
                frame,
                actions=['emotion'],
                enforce_detection=False,
                silent=True
            )
            
            if isinstance(analysis, list):
                result['faces_detected'] = len(analysis)
                result['success'] = True
                result['method'] = 'deepface'
                
                # Extract emotion data from each face
                for face_analysis in analysis:
                    emotions = face_analysis.get('emotion', {})
                    
                    # Normalize and sort emotions
                    total_confidence = sum(emotions.values()) or 1
                    normalized_emotions = {
                        emotion: round((conf / total_confidence) * 100, 2)
                        for emotion, conf in emotions.items()
                    }
                    
                    # Find dominant emotion
                    dominant = max(normalized_emotions, key=normalized_emotions.get)
                    
                    result['emotions'].append({
                        'emotion': dominant,
                        'confidence': normalized_emotions[dominant],
                        'all_emotions': normalized_emotions,
                        'icon': self.EMOTION_ICONS.get(dominant, '😐')
                    })
                
                if result['emotions']:
                    # Overall dominant emotion
                    all_dominants = [e['emotion'] for e in result['emotions']]
                    result['dominant_emotion'] = max(
                        set(all_dominants),
                        key=all_dominants.count
                    )
                
                self.faces_detected += len(analysis)
                self.detection_history.append(result.copy())
            
            return result
        
        except Exception as e:
            print(f"DeepFace error: {e}")
            return result
    
    def _analyze_with_mediapipe(self, frame: np.ndarray, result: Dict) -> Dict:
        """Analyze faces using MediaPipe (detection only, emotion needs deepface)"""
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            detection_result = self.face_detector.process(rgb_frame)
            
            if detection_result.detections:
                result['faces_detected'] = len(detection_result.detections)
                result['success'] = True
                result['method'] = 'mediapipe'
                
                # For each detected face, return basic info
                h, w, _ = frame.shape
                for detection in detection_result.detections:
                    bbox = detection.location_data.bounding_box
                    x = int(bbox.xmin * w)
                    y = int(bbox.ymin * h)
                    width = int(bbox.width * w)
                    height = int(bbox.height * h)
                    
                    result['emotions'].append({
                        'emotion': 'neutral',  # MediaPipe doesn't classify emotion
                        'confidence': detection.score[0] if detection.score else 0.5,
                        'bbox': {'x': x, 'y': y, 'width': width, 'height': height},
                        'icon': '😐'
                    })
                
                self.faces_detected += len(detection_result.detections)
                self.detection_history.append(result.copy())
            
            return result
        
        except Exception as e:
            print(f"MediaPipe error: {e}")
            return result
    
    def _analyze_with_opencv(self, frame: np.ndarray, result: Dict) -> Dict:
        """Basic face detection using OpenCV Haar Cascades"""
        try:
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            if len(faces) > 0:
                result['faces_detected'] = len(faces)
                result['success'] = True
                result['method'] = 'opencv_cascade'
                
                for (x, y, w, h) in faces:
                    result['emotions'].append({
                        'emotion': 'neutral',  # OpenCV can't classify emotion
                        'confidence': 0.5,
                        'icon': '😐'
                    })
                
                self.faces_detected += len(faces)
                self.detection_history.append(result.copy())
            
            return result
        
        except Exception as e:
            print(f"OpenCV error: {e}")
            return result
    
    def get_statistics(self) -> Dict:
        """Get emotion detection statistics"""
        emotion_counts = {}
        
        for entry in self.detection_history:
            if entry['emotions']:
                for emotion_data in entry['emotions']:
                    emotion = emotion_data['emotion']
                    emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        return {
            'total_frames_analyzed': self.total_frames_analyzed,
            'total_faces_detected': self.faces_detected,
            'emotion_distribution': emotion_counts,
            'detection_history_size': len(self.detection_history),
            'detection_available': self.detection_available,
            'use_mediapipe': self.use_mediapipe
        }


class AudioSentimentAnalyzer:
    """Analyzes sentiment and emotion from transcribed audio text"""
    
    SENTIMENT_SCORES = {
        'POSITIVE': {'label': 'happy', 'icon': '😊', 'score': 1.0},
        'NEGATIVE': {'label': 'sad', 'icon': '😢', 'score': -1.0},
        'NEUTRAL': {'label': 'neutral', 'icon': '😐', 'score': 0.0}
    }
    
    def __init__(self):
        """Initialize audio sentiment analyzer"""
        self.sentiment_pipeline = None
        self.available = TRANSFORMERS_AVAILABLE
        
        if self.available:
            try:
                self.sentiment_pipeline = pipeline(
                    "sentiment-analysis",
                    model="distilbert-base-uncased-finetuned-sst-2-english"
                )
                print("✅ Sentiment analysis pipeline initialized")
            except Exception as e:
                print(f"⚠️  Could not initialize sentiment pipeline: {e}")
                self.available = False
        
        self.analysis_history = deque(maxlen=100)
    
    def analyze_sentiment(self, text: str) -> Dict:
        """
        Analyze sentiment of text
        
        Args:
            text: Transcribed audio text
            
        Returns:
            Sentiment analysis result
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'text': text,
            'sentiment': 'neutral',
            'confidence': 0.0,
            'emotion': 'neutral',
            'icon': '😐',
            'success': False
        }
        
        if not text or not text.strip():
            return result
        
        # Use transformers if available
        if self.available and self.sentiment_pipeline:
            try:
                analysis = self.sentiment_pipeline(text[:512])  # Max 512 chars
                
                if analysis:
                    sentiment = analysis[0]
                    label = sentiment['label']  # POSITIVE, NEGATIVE, NEUTRAL
                    score = sentiment['score']
                    
                    result['sentiment'] = label
                    result['confidence'] = round(score * 100, 2)
                    
                    # Map sentiment to emotion
                    if label in self.SENTIMENT_SCORES:
                        emotion_info = self.SENTIMENT_SCORES[label]
                        result['emotion'] = emotion_info['label']
                        result['icon'] = emotion_info['icon']
                    
                    result['success'] = True
                    self.analysis_history.append(result.copy())
                
                return result
            
            except Exception as e:
                print(f"⚠️  Sentiment analysis error: {e}")
                return result
        
        # Fallback: simple keyword-based sentiment
        return self._analyze_sentiment_keywords(text, result)
    
    def _analyze_sentiment_keywords(self, text: str, result: Dict) -> Dict:
        """Simple keyword-based sentiment analysis"""
        text_lower = text.lower()
        
        positive_words = ['happy', 'good', 'great', 'excellent', 'love', 'like', 'amazing', 'wonderful', 'fantastic']
        negative_words = ['sad', 'bad', 'terrible', 'hate', 'angry', 'upset', 'disappointed', 'awful']
        
        positive_count = sum(word in text_lower for word in positive_words)
        negative_count = sum(word in text_lower for word in negative_words)
        
        if positive_count > negative_count:
            result['sentiment'] = 'POSITIVE'
            result['emotion'] = 'happy'
            result['icon'] = '😊'
            result['confidence'] = min(positive_count * 10, 100)
        elif negative_count > positive_count:
            result['sentiment'] = 'NEGATIVE'
            result['emotion'] = 'sad'
            result['icon'] = '😢'
            result['confidence'] = min(negative_count * 10, 100)
        else:
            result['sentiment'] = 'NEUTRAL'
            result['emotion'] = 'neutral'
            result['icon'] = '😐'
            result['confidence'] = 50.0
        
        result['success'] = True
        self.analysis_history.append(result.copy())
        return result
    
    def get_statistics(self) -> Dict:
        """Get sentiment analysis statistics"""
        sentiment_counts = {}
        emotion_counts = {}
        
        for entry in self.analysis_history:
            sentiment = entry['sentiment']
            emotion = entry['emotion']
            
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        return {
            'total_analyzed': len(self.analysis_history),
            'sentiment_distribution': sentiment_counts,
            'emotion_distribution': emotion_counts,
            'available': self.available
        }


class EmotionAnalyzer:
    """Combined emotion analyzer for facial expressions and audio sentiment"""
    
    def __init__(self):
        """Initialize emotion analyzer"""
        self.facial_detector = FacialEmotionDetector()
        self.audio_analyzer = AudioSentimentAnalyzer()
        self.combined_history = deque(maxlen=100)
    
    def analyze_frame(self, frame: np.ndarray, audio_text: Optional[str] = None) -> Dict:
        """
        Analyze both facial emotions and audio sentiment
        
        Args:
            frame: Video frame
            audio_text: Optional transcribed audio text
            
        Returns:
            Combined emotion analysis
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'facial': self.facial_detector.detect_emotions(frame),
            'audio': None,
            'overall_emotion': None,
            'overall_confidence': 0
        }
        
        # Analyze audio if provided
        if audio_text:
            result['audio'] = self.audio_analyzer.analyze_sentiment(audio_text)
        
        # Determine overall emotion
        result['overall_emotion'] = self._determine_overall_emotion(result)
        
        self.combined_history.append(result.copy())
        return result
    
    def _determine_overall_emotion(self, analysis: Dict) -> Dict:
        """Determine overall emotion from facial and audio analysis"""
        emotions = []
        confidences = []
        
        # Add facial emotion
        if analysis['facial']['emotions']:
            for emotion_data in analysis['facial']['emotions']:
                emotions.append(emotion_data['emotion'])
                confidences.append(emotion_data['confidence'])
        
        # Add audio emotion
        if analysis['audio'] and analysis['audio']['success']:
            emotions.append(analysis['audio']['emotion'])
            confidences.append(analysis['audio']['confidence'])
        
        if emotions:
            # Get most common emotion
            from collections import Counter
            emotion_counter = Counter(emotions)
            most_common_emotion = emotion_counter.most_common(1)[0][0]
            avg_confidence = sum(confidences) / len(confidences)
            
            return {
                'emotion': most_common_emotion,
                'confidence': round(avg_confidence, 2),
                'icon': FacialEmotionDetector.EMOTION_ICONS.get(most_common_emotion, '😐')
            }
        
        return None
    
    def get_statistics(self) -> Dict:
        """Get comprehensive emotion analysis statistics"""
        return {
            'facial': self.facial_detector.get_statistics(),
            'audio': self.audio_analyzer.get_statistics(),
            'combined_history_size': len(self.combined_history)
        }


# Singleton instance
_emotion_analyzer = None

def get_emotion_analyzer() -> EmotionAnalyzer:
    """Get or create emotion analyzer singleton"""
    global _emotion_analyzer
    if _emotion_analyzer is None:
        _emotion_analyzer = EmotionAnalyzer()
    return _emotion_analyzer
