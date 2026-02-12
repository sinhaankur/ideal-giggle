"""
Emotion-Based Command Interpreter and Action System
Maps detected emotions to intelligent actions, recommendations, and AI responses
"""

import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import re
from datetime import datetime


class EmotionState(str, Enum):
    """Enumeration of detected emotional states"""
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    FEAR = "fear"
    SURPRISE = "surprise"
    DISGUST = "disgust"
    NEUTRAL = "neutral"


@dataclass
class EmotionAction:
    """Represents an action triggered by an emotion"""
    emotion: str
    action_type: str  # "alarm", "alert", "recommendation", "control", "query"
    action_name: str
    description: str
    parameters: Dict = None
    confidence: float = 0.8
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()
        if self.parameters is None:
            self.parameters = {}


@dataclass
class AIResponse:
    """AI response to detected emotional state"""
    emotion: str
    response_text: str
    emotion_label: str
    confidence: float
    recommendations: List[str]
    urgency: str  # "low", "medium", "high", "critical"
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()
    
    def to_dict(self):
        return asdict(self)


class EmotionCommandInterpreter:
    """
    Interprets emotions and triggers appropriate commands/actions
    Generates intelligent recommendations based on emotional context
    """
    
    # Emotion profiles defining what each emotion means and what actions to take
    EMOTION_PROFILES = {
        EmotionState.HAPPY: {
            "keywords": ["smile", "friendly", "cooperative", "engaged"],
            "action_types": ["positive_reinforcement", "proceed_normally"],
            "recommendations": [
                "User appears happy - great time to present important information",
                "Positive engagement detected - proceed with planned activities",
                "User is in receptive mood - good for decision-making",
                "Happy state - encourage more interaction"
            ],
            "commands": [
                {"name": "log_positive_interaction", "priority": "low"},
                {"name": "increase_engagement_level", "priority": "low"},
                {"name": "suggest_next_steps", "priority": "medium"}
            ],
            "alerts": [],
            "urgency": "low"
        },
        
        EmotionState.SAD: {
            "keywords": ["downcast", "withdrawn", "melancholy", "low_energy"],
            "action_types": ["emotional_support", "concern", "monitoring"],
            "recommendations": [
                "User appears sad - provide emotional support",
                "Sad state detected - consider offering assistance",
                "Low mood observed - check for wellbeing status",
                "Recommend taking a break or engaging with supportive content"
            ],
            "commands": [
                {"name": "offer_support", "priority": "high"},
                {"name": "check_wellbeing", "priority": "high"},
                {"name": "suggest_break", "priority": "medium"},
                {"name": "log_emotional_state", "priority": "low"}
            ],
            "alerts": [{
                "type": "emotional_concern",
                "message": "Prolonged sadness detected - consider support intervention",
                "trigger_duration": 300  # 5 minutes
            }],
            "urgency": "medium"
        },
        
        EmotionState.ANGRY: {
            "keywords": ["frustrated", "tense", "aggressive", "confrontational"],
            "action_types": ["de_escalation", "pause", "safety_first"],
            "recommendations": [
                "User appears angry - pause operations and de-escalate",
                "High tension detected - give user personal space",
                "Anger observed - recommend calm breathing or break",
                "Consider addressing underlying frustration"
            ],
            "commands": [
                {"name": "pause_operations", "priority": "critical"},
                {"name": "de_escalate", "priority": "critical"},
                {"name": "offer_break", "priority": "high"},
                {"name": "log_incident", "priority": "high"},
                {"name": "alert_supervisor", "priority": "high"}
            ],
            "alerts": [{
                "type": "anger_escalation",
                "message": "Anger detected - recommend immediate de-escalation",
                "trigger_confidence": 0.7
            }],
            "urgency": "high"
        },
        
        EmotionState.FEAR: {
            "keywords": ["anxious", "worried", "uncertain", "hesitant"],
            "action_types": ["reassurance", "guidance", "safety"],
            "recommendations": [
                "User appears fearful - provide reassurance and clarity",
                "Anxiety detected - explain process clearly and calmly",
                "Uncertainty observed - offer step-by-step guidance",
                "Fear detected - emphasize safety and support"
            ],
            "commands": [
                {"name": "provide_reassurance", "priority": "high"},
                {"name": "explain_clearly", "priority": "high"},
                {"name": "offer_guidance", "priority": "medium"},
                {"name": "confirm_safety", "priority": "high"}
            ],
            "alerts": [{
                "type": "anxiety_threshold",
                "message": "High anxiety detected - offer support",
                "trigger_confidence": 0.75
            }],
            "urgency": "high"
        },
        
        EmotionState.SURPRISE: {
            "keywords": ["shocked", "startled", "unexpected", "amazed"],
            "action_types": ["explanation", "clarification", "check_status"],
            "recommendations": [
                "User is surprised - provide quick explanation",
                "Unexpected reaction detected - clarify situation",
                "Surprise observed - confirm everything is acceptable",
                "Startled state - explain what happened calmly"
            ],
            "commands": [
                {"name": "clarify_situation", "priority": "high"},
                {"name": "provide_context", "priority": "medium"},
                {"name": "confirm_status", "priority": "medium"}
            ],
            "alerts": [],
            "urgency": "medium"
        },
        
        EmotionState.DISGUST: {
            "keywords": ["repulsed", "disapproving", "rejection", "distaste"],
            "action_types": ["stop_action", "investigate", "correction"],
            "recommendations": [
                "User shows disapproval - stop current action",
                "Rejection detected - investigate issue",
                "Disgust observed - offer alternative approach",
                "User dissatisfied - address complaint immediately"
            ],
            "commands": [
                {"name": "stop_action", "priority": "critical"},
                {"name": "investigate_issue", "priority": "high"},
                {"name": "offer_alternative", "priority": "high"},
                {"name": "log_complaint", "priority": "medium"}
            ],
            "alerts": [{
                "type": "severe_disapproval",
                "message": "Strong disapproval detected - immediate investigation needed",
                "trigger_confidence": 0.8
            }],
            "urgency": "high"
        },
        
        EmotionState.NEUTRAL: {
            "keywords": ["calm", "focused", "passive", "composed"],
            "action_types": ["proceed_normally", "monitor"],
            "recommendations": [
                "User is neutral/calm - proceed with normal operations",
                "Composed state - good for routine tasks",
                "Neutral mood - continue planned activities",
                "User is focused - maintain current pace"
            ],
            "commands": [
                {"name": "log_status", "priority": "low"},
                {"name": "continue_operations", "priority": "low"}
            ],
            "alerts": [],
            "urgency": "low"
        }
    }
    
    def __init__(self):
        """Initialize the emotion command interpreter"""
        self.action_history = []
        self.response_cache = {}
    
    def interpret_emotion(self, emotion: str, confidence: float, 
                         context: Optional[Dict] = None) -> Tuple[List[EmotionAction], AIResponse]:
        """
        Interpret detected emotion and generate actions + AI response
        
        Args:
            emotion: Detected emotion (happy, sad, angry, fear, surprise, disgust, neutral)
            confidence: Confidence score (0-1)
            context: Additional context about the situation
            
        Returns:
            Tuple of (list of actions, AI response)
        """
        context = context or {}
        
        # Get emotion profile
        emotion_lower = emotion.lower()
        profile = self.EMOTION_PROFILES.get(emotion_lower, self.EMOTION_PROFILES[EmotionState.NEUTRAL])
        
        # Determine urgency based on confidence and emotion type
        urgency = self._calculate_urgency(emotion_lower, confidence)
        
        # Generate actions
        actions = self._generate_actions(emotion_lower, profile, confidence, context)
        
        # Generate AI response
        response = self._generate_response(emotion_lower, profile, confidence, actions, urgency)
        
        # Store in history
        self.action_history.append({
            "emotion": emotion_lower,
            "confidence": confidence,
            "actions": [asdict(a) for a in actions],
            "timestamp": datetime.now().isoformat()
        })
        
        return actions, response
    
    def _calculate_urgency(self, emotion: str, confidence: float) -> str:
        """Calculate urgency level based on emotion and confidence"""
        profile = self.EMOTION_PROFILES.get(emotion, {})
        base_urgency = profile.get("urgency", "low")
        
        # Increase urgency if confidence is very high
        if confidence > 0.85:
            urgency_levels = {"low": "medium", "medium": "high", "high": "critical"}
            return urgency_levels.get(base_urgency, base_urgency)
        
        return base_urgency
    
    def _generate_actions(self, emotion: str, profile: Dict, 
                         confidence: float, context: Dict) -> List[EmotionAction]:
        """Generate specific actions for the detected emotion"""
        actions = []
        
        for cmd in profile.get("commands", []):
            action = EmotionAction(
                emotion=emotion,
                action_type="control",
                action_name=cmd["name"],
                description=f"Execute {cmd['name']} due to {emotion} emotion",
                parameters={
                    "confidence": confidence,
                    "priority": cmd["priority"],
                    **context
                },
                confidence=confidence
            )
            actions.append(action)
        
        # Add alerts as special high-priority actions
        for alert in profile.get("alerts", []):
            if confidence >= alert.get("trigger_confidence", 0.5):
                action = EmotionAction(
                    emotion=emotion,
                    action_type="alert",
                    action_name=alert["type"],
                    description=alert["message"],
                    parameters={"trigger": alert},
                    confidence=confidence
                )
                actions.append(action)
        
        return actions
    
    def _generate_response(self, emotion: str, profile: Dict, 
                          confidence: float, actions: List[EmotionAction], 
                          urgency: str) -> AIResponse:
        """Generate AI response text based on emotion"""
        
        recommendations = profile.get("recommendations", [])
        
        # Select appropriate recommendations based on confidence
        if confidence > 0.8:
            num_recommendations = min(3, len(recommendations))
        else:
            num_recommendations = min(2, len(recommendations))
        
        selected_recommendations = recommendations[:num_recommendations]
        
        # Generate response text
        emotion_label = emotion.replace("_", " ").title()
        
        response_text = self._generate_response_text(emotion, emotion_label, 
                                                     confidence, urgency, actions)
        
        return AIResponse(
            emotion=emotion,
            response_text=response_text,
            emotion_label=emotion_label,
            confidence=confidence,
            recommendations=selected_recommendations,
            urgency=urgency
        )
    
    def _generate_response_text(self, emotion: str, label: str, 
                               confidence: float, urgency: str, 
                               actions: List[EmotionAction]) -> str:
        """Generate natural language response based on emotion"""
        
        responses = {
            EmotionState.HAPPY: [
                f"Great! I see you're in a positive mood ({confidence:.0%} confidence). How can I help you make the most of this moment?",
                f"Excellent energy detected! You seem happy and engaged. What would you like to accomplish?",
                f"I'm picking up positive vibes. You seem ready for new challenges. What's next?"
            ],
            
            EmotionState.SAD: [
                f"I notice you seem a bit down ({confidence:.0%} confidence). Would you like some support or a moment to yourself?",
                f"I'm sensing some sadness. Remember, it's okay to take a break. How can I help?",
                f"I'm here if you need to talk or need assistance with anything."
            ],
            
            EmotionState.ANGRY: [
                f"I sense frustration ({confidence:.0%} confidence). Let's pause and take a breath. What's bothering you?",
                f"Tension detected. Let's step back and address this calmly. I'm here to help.",
                f"I can see something is upsetting you. Would you like to discuss it or take a break?"
            ],
            
            EmotionState.FEAR: [
                f"You seem concerned or anxious ({confidence:.0%} confidence). I'm here to help. What's worrying you?",
                f"I sense some uncertainty. Don't worry, I'll walk you through this step by step.",
                f"You appear hesitant. That's okay. Let me clarify and reassure you."
            ],
            
            EmotionState.SURPRISE: [
                f"That was unexpected, wasn't it? ({confidence:.0%} confidence). Let me explain what just happened.",
                f"I see I caught you by surprise. Let me provide some context.",
                f"Unexpected moment! Let me clarify what's going on."
            ],
            
            EmotionState.DISGUST: [
                f"I sense strong disapproval ({confidence:.0%} confidence). Let's address this issue immediately.",
                f"Something doesn't sit right with you. Tell me what's wrong and I'll fix it.",
                f"I'm picking up on dissatisfaction. What needs to change?"
            ],
            
            EmotionState.NEUTRAL: [
                f"You seem calm and focused ({confidence:.0%} confidence). Ready to proceed with the task?",
                f"You're in a composed state. Let's continue with what you're working on.",
                f"Everything looks good. Shall we continue?"
            ]
        }
        
        emotion_responses = responses.get(emotion, responses[EmotionState.NEUTRAL])
        return emotion_responses[0]
    
    def process_voice_command(self, text: str, emotion: Optional[str] = None, 
                            confidence: float = 0.7) -> Dict:
        """
        Process voice commands with emotional context
        
        Args:
            text: Voice command text
            emotion: Current detected emotion
            confidence: Confidence in emotion detection
            
        Returns:
            Dictionary with parsed command and emotional context
        """
        
        # Normalize text
        text_lower = text.lower().strip()
        
        # Parse command
        command_data = self._parse_command(text_lower)
        
        # Add emotional context if available
        if emotion:
            actions, response = self.interpret_emotion(emotion, confidence, 
                                                       {"voice_command": text})
            command_data["emotional_context"] = {
                "emotion": emotion,
                "confidence": confidence,
                "suggested_actions": [asdict(a) for a in actions],
                "ai_response": response.to_dict()
            }
        
        return command_data
    
    def _parse_command(self, text: str) -> Dict:
        """Parse natural language command"""
        
        # Define command patterns
        patterns = {
            "control": {
                "regex": r"(turn|switch|set|control|adjust|change)\s+(\w+)\s+(on|off|to|at)?",
                "action_type": "control"
            },
            "alert": {
                "regex": r"(show|alert|notify|tell|remind|inform).{1,30}(about|regarding|on|time)",
                "action_type": "alert"
            },
            "query": {
                "regex": r"(what|how|tell|show|display|retrieve).{1,30}(is|are|about|of)",
                "action_type": "query"
            },
            "status": {
                "regex": r"(status|check|report|how|what|where|state|condition)",
                "action_type": "status"
            }
        }
        
        # Try to match patterns
        detected_type = "unknown"
        for cmd_type, pattern_info in patterns.items():
            if re.search(pattern_info["regex"], text):
                detected_type = cmd_type
                break
        
        return {
            "original_text": text,
            "command_type": detected_type,
            "confidence": 0.7,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_action_recommendations(self, emotion: str, context: Optional[Dict] = None) -> List[str]:
        """Get recommended actions for an emotion"""
        profile = self.EMOTION_PROFILES.get(emotion, {})
        return profile.get("recommendations", [])
    
    def get_emotion_history(self, limit: int = 10) -> List[Dict]:
        """Get recent emotion action history"""
        return self.action_history[-limit:]
    
    def create_emotion_alert(self, emotion: str, confidence: float, 
                            severity: str = "medium") -> Dict:
        """Create an alert for significant emotional events"""
        
        profile = self.EMOTION_PROFILES.get(emotion, {})
        alerts = profile.get("alerts", [])
        
        if not alerts:
            return {}
        
        return {
            "type": "emotion_event",
            "emotion": emotion,
            "confidence": confidence,
            "severity": severity,
            "message": f"{emotion.title()} emotion detected at {confidence:.0%} confidence",
            "recommendations": profile.get("recommendations", []),
            "timestamp": datetime.now().isoformat(),
            "requires_action": severity in ["high", "critical"]
        }


# Singleton instance
_interpreter_instance = None

def get_emotion_command_interpreter() -> EmotionCommandInterpreter:
    """Get or create singleton instance of emotion command interpreter"""
    global _interpreter_instance
    if _interpreter_instance is None:
        _interpreter_instance = EmotionCommandInterpreter()
    return _interpreter_instance
