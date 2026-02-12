"""
Emotion-Based AI Response Generator
Generates intelligent conversational responses based on detected emotions
Handles multi-turn conversations with emotional awareness
"""

import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
import random


@dataclass
class ConversationContext:
    """Maintains conversation context across turns"""
    user_id: str
    emotion_history: List[Dict] = field(default_factory=list)
    interaction_count: int = 0
    previous_responses: List[str] = field(default_factory=list)
    user_preferences: Dict = field(default_factory=dict)
    last_emotion: Optional[str] = None
    emotion_trend: str = "stable"  # stable, improving, declining
    
    def add_emotion(self, emotion: str, confidence: float):
        """Add emotion to history and update trend"""
        self.emotion_history.append({
            "emotion": emotion,
            "confidence": confidence,
            "timestamp": datetime.now().isoformat()
        })
        self.interaction_count += 1
        
        # Update trend
        if len(self.emotion_history) >= 2:
            prev = self.emotion_history[-2]["emotion"]
            curr = self.emotion_history[-1]["emotion"]
            self._update_trend(prev, curr)
        
        self.last_emotion = emotion
    
    def _update_trend(self, prev: str, curr: str):
        """Update emotional trend"""
        positive = ["happy", "surprise"]
        negative = ["sad", "angry", "fear", "disgust"]
        
        prev_is_positive = prev in positive
        curr_is_positive = curr in positive
        
        if curr_is_positive and not prev_is_positive:
            self.emotion_trend = "improving"
        elif not curr_is_positive and prev_is_positive:
            self.emotion_trend = "declining"
        else:
            self.emotion_trend = "stable"


class EmotionResponseGenerator:
    """
    Generates contextual AI responses based on emotions
    Supports multi-turn conversations with emotional awareness
    """
    
    # Strategic response templates based on emotional context
    RESPONSE_STRATEGIES = {
        "happy": {
            "tone": "enthusiastic",
            "approach": "reinforce_positive",
            "templates": [
                "That's wonderful! {detail}",
                "I love your positive energy! {detail}",
                "Absolutely! {detail}",
                "Perfect timing - you're in a great mood! {detail}",
                "Excellent! {detail}"
            ],
            "followup": [
                "How can I help you maximize this momentum?",
                "What would you like to tackle next?",
                "Ready for something challenging?",
                "Any goals you'd like to pursue?"
            ]
        },
        
        "sad": {
            "tone": "empathetic",
            "approach": "supportive",
            "templates": [
                "I understand this might be difficult. {detail}",
                "I'm here for you. {detail}",
                "Let's work through this together. {detail}",
                "It's okay to feel this way. {detail}",
                "I appreciate your honesty. {detail}"
            ],
            "followup": [
                "Would you like to talk about what's on your mind?",
                "How can I support you right now?",
                "Would a break help?",
                "What do you need most right now?"
            ]
        },
        
        "angry": {
            "tone": "calm",
            "approach": "de_escalate",
            "templates": [
                "I hear your frustration. {detail}",
                "You're right to feel strongly about this. {detail}",
                "Let's address this calmly. {detail}",
                "Your concerns are valid. {detail}",
                "I take this seriously. {detail}"
            ],
            "followup": [
                "Let's take a step back and talk through this.",
                "What specifically is troubling you?",
                "How can I help make this right?",
                "What would improve this situation?"
            ]
        },
        
        "fear": {
            "tone": "reassuring",
            "approach": "build_confidence",
            "templates": [
                "Don't worry, I've got you. {detail}",
                "You're safe here. {detail}",
                "Let me guide you through this. {detail}",
                "I'm confident we can handle this. {detail}",
                "Trust me on this. {detail}"
            ],
            "followup": [
                "Let me explain exactly what's happening.",
                "I'll walk you through each step.",
                "Is there something specific that worries you?",
                "What would help you feel more confident?"
            ]
        },
        
        "surprise": {
            "tone": "informative",
            "approach": "clarify",
            "templates": [
                "That caught you off guard! {detail}",
                "Unexpected, right? {detail}",
                "Let me explain. {detail}",
                "This might seem surprising but {detail}",
                "Here's what just happened: {detail}"
            ],
            "followup": [
                "Does that make sense?",
                "Any questions about what happened?",
                "Ready to move forward?",
                "What do you think?"
            ]
        },
        
        "disgust": {
            "tone": "problem_solving",
            "approach": "fix_issue",
            "templates": [
                "I see why you're upset. {detail}",
                "This is not acceptable. {detail}",
                "You're right, this needs to change. {detail}",
                "I'm going to fix this. {detail}",
                "Your dissatisfaction is noted. {detail}"
            ],
            "followup": [
                "What specifically would improve this?",
                "How can I make this right?",
                "What alternative would you prefer?",
                "Let's solve this together."
            ]
        },
        
        "neutral": {
            "tone": "professional",
            "approach": "proceed_normally",
            "templates": [
                "Great! {detail}",
                "Understood. {detail}",
                "Let's continue. {detail}",
                "Perfect. {detail}",
                "Sounds good. {detail}"
            ],
            "followup": [
                "What's next on your agenda?",
                "Ready to continue?",
                "Shall we proceed?",
                "What would you like to do?"
            ]
        }
    }
    
    # Context-aware response modifiers
    CONTEXT_MODIFIERS = {
        "improving": "You seem to be feeling better. ",
        "declining": "I notice your mood shifting. ",
        "stable": "",
        "first_interaction": "I'm getting to know you better. ",
        "repeat_emotion": "It seems like {emotion} is a recurring theme. "
    }
    
    def __init__(self):
        """Initialize response generator"""
        self.conversation_contexts: Dict[str, ConversationContext] = {}
        self.response_history = []
    
    def generate_response(self, user_id: str, emotion: str, confidence: float,
                         detail: str = "", context: Optional[Dict] = None) -> Dict:
        """
        Generate contextual AI response based on emotion
        
        Args:
            user_id: Unique user identifier
            emotion: Detected emotion
            confidence: Confidence in emotion detection
            detail: Additional detail to include in response
            context: Additional context information
            
        Returns:
            Dictionary with response, recommendations, and follow-up
        """
        context = context or {}
        
        # Get or create conversation context
        if user_id not in self.conversation_contexts:
            self.conversation_contexts[user_id] = ConversationContext(user_id=user_id)
        
        conv_context = self.conversation_contexts[user_id]
        conv_context.add_emotion(emotion, confidence)
        
        # Get strategy for this emotion
        strategy = self.RESPONSE_STRATEGIES.get(emotion, self.RESPONSE_STRATEGIES["neutral"])
        
        # Generate response text
        response_text = self._generate_response_text(emotion, detail, strategy, conv_context)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(emotion, confidence, context)
        
        # Generate follow-up question
        followup = random.choice(strategy["followup"])
        
        # Generate actions to take
        actions = self._generate_actions(emotion, confidence, conv_context)
        
        response_data = {
            "response": response_text,
            "emotion": emotion,
            "confidence": confidence,
            "tone": strategy["tone"],
            "approach": strategy["approach"],
            "recommendations": recommendations,
            "followup": followup,
            "next_actions": actions,
            "user_trend": conv_context.emotion_trend,
            "interaction_count": conv_context.interaction_count,
            "timestamp": datetime.now().isoformat()
        }
        
        # Store in history
        self.response_history.append(response_data)
        conv_context.previous_responses.append(response_text)
        
        return response_data
    
    def _generate_response_text(self, emotion: str, detail: str, 
                               strategy: Dict, context: ConversationContext) -> str:
        """Generate response text with context modifiers"""
        
        # Select base template
        template = random.choice(strategy["templates"])
        
        # Add context modifier
        modifier = self._get_context_modifier(emotion, context)
        
        # Format response
        base_response = template.format(detail=detail) if detail else template.format(detail="").rstrip()
        return modifier + base_response.strip()
    
    def _get_context_modifier(self, emotion: str, context: ConversationContext) -> str:
        """Get context modifier based on conversation state"""
        
        if context.interaction_count == 1:
            return self.CONTEXT_MODIFIERS["first_interaction"]
        
        if context.emotion_trend in ["improving", "declining"]:
            return self.CONTEXT_MODIFIERS[context.emotion_trend]
        
        # Check for repeated emotion
        if len(context.emotion_history) >= 3:
            last_3 = [e["emotion"] for e in context.emotion_history[-3:]]
            if last_3[0] == last_3[1] == emotion:
                return self.CONTEXT_MODIFIERS["repeat_emotion"].format(emotion=emotion)
        
        return ""
    
    def _generate_recommendations(self, emotion: str, confidence: float, 
                                 context: Dict) -> List[str]:
        """Generate smart recommendations based on emotion"""
        
        recommendations = []
        
        # High confidence recommendations
        if confidence > 0.8:
            if emotion == "happy":
                recommendations = [
                    "Capture this moment - complete important tasks now",
                    "Great productivity window - tackle challenging items",
                    "Consider scheduling important decisions for now"
                ]
            elif emotion == "sad":
                recommendations = [
                    "Consider a brief break or change of scenery",
                    "Talking to someone might help",
                    "Simple, manageable tasks for now"
                ]
            elif emotion == "angry":
                recommendations = [
                    "Take a 5-10 minute break to cool down",
                    "Practice deep breathing or a quick walk",
                    "Discuss the issue calmly once you're ready"
                ]
            elif emotion == "fear":
                recommendations = [
                    "Take it one step at a time",
                    "Ask for help if needed",
                    "Remember past successes to build confidence"
                ]
            elif emotion == "surprise":
                recommendations = [
                    "Process the information",
                    "Ask clarifying questions",
                    "Make decisions carefully"
                ]
            elif emotion == "disgust":
                recommendations = [
                    "Address the issue immediately",
                    "Provide specific feedback",
                    "Work toward a solution"
                ]
        else:
            recommendations = [
                "Continue with current activities",
                "Monitor your feelings",
                "Let me know if anything changes"
            ]
        
        return recommendations[:3]  # Return top 3
    
    def _generate_actions(self, emotion: str, confidence: float, 
                         context: ConversationContext) -> List[Dict]:
        """Generate actions to take based on emotion"""
        
        actions = []
        
        # Critical actions for high confidence negative emotions
        if confidence > 0.75:
            if emotion == "angry":
                actions.extend([
                    {"action": "pause_operations", "priority": "critical"},
                    {"action": "offer_break", "priority": "high"},
                    {"action": "escalate_if_needed", "priority": "high"}
                ])
            elif emotion == "fear":
                actions.extend([
                    {"action": "provide_reassurance", "priority": "high"},
                    {"action": "explain_clearly", "priority": "high"},
                    {"action": "offer_guidance", "priority": "high"}
                ])
            elif emotion == "disgust":
                actions.extend([
                    {"action": "investigate_issue", "priority": "critical"},
                    {"action": "address_concern", "priority": "critical"},
                    {"action": "offer_solution", "priority": "high"}
                ])
        
        # Positive emotion actions
        if emotion == "happy" and confidence > 0.7:
            actions.extend([
                {"action": "encourage_engagement", "priority": "medium"},
                {"action": "present_opportunities", "priority": "medium"}
            ])
        
        # Always log the interaction
        actions.append({
            "action": "log_interaction",
            "priority": "low",
            "data": {
                "emotion": emotion,
                "confidence": confidence,
                "user_trend": context.emotion_trend
            }
        })
        
        return actions
    
    def get_conversation_context(self, user_id: str) -> Optional[ConversationContext]:
        """Get conversation context for a user"""
        return self.conversation_contexts.get(user_id)
    
    def get_user_emotion_summary(self, user_id: str) -> Dict:
        """Get emotion summary for a user"""
        
        if user_id not in self.conversation_contexts:
            return {}
        
        context = self.conversation_contexts[user_id]
        
        if not context.emotion_history:
            return {}
        
        # Count emotions
        emotion_counts = {}
        for entry in context.emotion_history:
            emotion = entry["emotion"]
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        # Get most common emotion
        most_common = max(emotion_counts, key=emotion_counts.get)
        
        return {
            "user_id": user_id,
            "interaction_count": context.interaction_count,
            "current_emotion": context.last_emotion,
            "emotion_trend": context.emotion_trend,
            "most_common_emotion": most_common,
            "emotion_distribution": emotion_counts,
            "emotion_history": context.emotion_history,
            "total_interactions": len(context.emotion_history)
        }
    
    def predict_user_state(self, user_id: str) -> Dict:
        """Predict user's likely next state based on patterns"""
        
        context = self.get_conversation_context(user_id)
        if not context or not context.emotion_history:
            return {"prediction": "unknown"}
        
        # Analyze emotional patterns
        recent_emotions = [e["emotion"] for e in context.emotion_history[-5:]]
        
        # Determine prediction
        if context.emotion_trend == "improving":
            prediction = "Conditions improving - user likely to be more receptive"
        elif context.emotion_trend == "declining":
            prediction = "Mood declining - recommend support intervention"
        else:
            # Check if stuck in negative state
            negative = ["sad", "angry", "fear", "disgust"]
            if all(e in negative for e in recent_emotions[-3:]):
                prediction = "Prolonged negative state - consider deeper intervention"
            else:
                prediction = "Status stable - continue current approach"
        
        return {
            "user_id": user_id,
            "prediction": prediction,
            "trend": context.emotion_trend,
            "confidence": 0.65,
            "recommended_action": self._get_recommended_intervention(context),
            "timestamp": datetime.now().isoformat()
        }
    
    def _get_recommended_intervention(self, context: ConversationContext) -> str:
        """Get recommended intervention based on context"""
        
        if context.emotion_trend == "declining":
            if context.last_emotion in ["sad", "fear"]:
                return "Offer emotional support and reassurance"
            elif context.last_emotion in ["angry", "disgust"]:
                return "De-escalate and address concerns"
        
        if context.interaction_count > 10 and context.emotion_trend == "stable":
            if all(e in ["happy", "neutral"] for e in 
                   [h["emotion"] for h in context.emotion_history[-3:]]):
                return "User is satisfied - maintain current approach"
        
        return "Continue monitoring"


# Singleton instance
_generator_instance = None

def get_emotion_response_generator() -> EmotionResponseGenerator:
    """Get or create singleton instance of emotion response generator"""
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = EmotionResponseGenerator()
    return _generator_instance
