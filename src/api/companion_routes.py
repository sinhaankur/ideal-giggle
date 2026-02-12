"""
Companion API Routes
Endpoints for AI companion interaction and personality management
"""

from flask import Blueprint, request, jsonify
from typing import Dict, Any
import logging

from src.ai.companion import (
    create_companion, get_companion, list_companions,
    GenderIdentity, PersonalityArchetype
)
from src.config.companion_memory import (
    get_companion_memory_manager, UserCompanionRelationship
)
from src.ai.unified_ai_handler import get_unified_ai_handler

logger = logging.getLogger(__name__)

companion_bp = Blueprint('companion', __name__, url_prefix='/api/companion')


@companion_bp.route('/create', methods=['POST'])
def create_new_companion():
    """Create a new AI companion with custom personality"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        memory_manager = get_companion_memory_manager()
        
        profile = memory_manager.create_new_companion(
            name=data['name'],
            gender_identity=data.get('gender_identity', 'custom'),
            primary_archetype=data.get('primary_archetype', 'warm'),
            voice_type=data.get('voice_type', 'warm_alto'),
            traits={
                'warmth': float(data.get('warmth', 0.8)),
                'humor': float(data.get('humor', 0.5)),
                'intelligence': float(data.get('intelligence', 0.9)),
                'mystery': float(data.get('mystery', 0.4)),
                'ambition': float(data.get('ambition', 0.6)),
            }
        )
        
        return jsonify({
            'success': True,
            'companion_id': profile.companion_id,
            'name': profile.name,
            'message': f'Welcome to {profile.name}!'
        }), 201
    
    except Exception as e:
        logger.error(f"Error creating companion: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/list', methods=['GET'])
def list_all_companions():
    """List all available companions"""
    try:
        memory_manager = get_companion_memory_manager()
        companions = memory_manager.get_all_companions()
        
        return jsonify({
            'success': True,
            'companions': [
                {
                    'companion_id': c.companion_id,
                    'name': c.name,
                    'gender_identity': c.gender_identity.value,
                    'primary_archetype': c.primary_archetype.value,
                    'voice_type': c.voice_type,
                    'traits': {
                        'warmth': c.warmth,
                        'humor': c.humor,
                        'intelligence': c.intelligence,
                        'mystery': c.mystery,
                        'ambition': c.ambition,
                    }
                }
                for c in companions
            ],
            'count': len(companions)
        })
    
    except Exception as e:
        logger.error(f"Error listing companions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/info/<companion_id>', methods=['GET'])
def get_companion_info(companion_id: str):
    """Get detailed information about a companion"""
    try:
        memory_manager = get_companion_memory_manager()
        profile = memory_manager.get_companion(companion_id)
        
        if not profile:
            return jsonify({'success': False, 'error': 'Companion not found'}), 404
        
        return jsonify({
            'success': True,
            'companion': {
                'companion_id': profile.companion_id,
                'name': profile.name,
                'gender_identity': profile.gender_identity.value,
                'primary_archetype': profile.primary_archetype.value,
                'voice_type': profile.voice_type,
                'traits': {
                    'warmth': profile.warmth,
                    'humor': profile.humor,
                    'intelligence': profile.intelligence,
                    'mystery': profile.mystery,
                    'ambition': profile.ambition,
                },
                'familiarity_level': profile.familiarity_level,
                'intimacy_level': profile.intimacy_level,
                'affection_level': profile.affection_level,
                'interactions_count': profile.interactions_count,
            }
        })
    
    except Exception as e:
        logger.error(f"Error getting companion info: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/chat', methods=['POST'])
def chat_with_companion():
    """Send a message to a companion and get response"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        companion_id = data.get('companion_id')
        message = data.get('message')
        user_emotion = data.get('user_emotion', 'neutral')  # Detected emotion from camera
        emotion_intensity = data.get('emotion_intensity', 0.5)  # 0-1 scale
        
        if not all([user_id, companion_id, message]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        # Get or load relationship
        memory_manager = get_companion_memory_manager()
        profile = memory_manager.get_companion(companion_id)
        
        if not profile:
            return jsonify({'success': False, 'error': 'Companion not found'}), 404
        
        relationship = UserCompanionRelationship(user_id, profile)
        
        # Get AI response using unified handler
        ai_handler = get_unified_ai_handler()
        
        # Build prompt with companion personality + emotion context
        from src.ai.companion import CompanionPersonality
        personality = CompanionPersonality(profile)
        system_prompt = personality._build_system_prompt()
        
        # Enhance prompt with emotion awareness
        if user_emotion and user_emotion != 'neutral':
            emotion_context = f"\nThe user appears to be {user_emotion.title()} (intensity: {emotion_intensity*100:.0f}%). Respond with appropriate empathy and understanding."
            system_prompt += emotion_context
        
        # Generate response
        try:
            response = ai_handler.generate_mood_response(
                mood=profile.current_mood,
                context=message,
                confidence=1.0
            )
            companion_response = response.text if response.success else "I'm here with you."
        except:
            companion_response = "I'm thinking about what you said... Tell me more?"
        
        # Record interaction with emotion context
        # CompanionPersonality.record_interaction expects parameter name 'quality'
        relationship.companion.record_interaction(message, companion_response, quality=0.7)
        
        # Store emotion data for learning
        if user_emotion and user_emotion != 'neutral':
            relationship.companion.profile.shared_memories.append({
                'type': 'emotional_observation',
                'emotion': user_emotion,
                'intensity': emotion_intensity,
                'context': message[:100],  # First 100 chars of message
                'timestamp': relationship.companion.profile.last_updated
            })
        
        relationship.save_relationship_history()
        
        return jsonify({
            'success': True,
            'response': companion_response,
            'companion_name': profile.name,
            'intimacy_level': relationship.companion.profile.intimacy_level,
            'affection_level': relationship.companion.profile.affection_level,
            'relationship_status': relationship.companion.get_relationship_status(),
        })
    
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/teach/<companion_id>/<user_id>', methods=['POST'])
def teach_companion(companion_id: str, user_id: str):
    """Teach companion about user preferences"""
    try:
        data = request.get_json()
        
        memory_manager = get_companion_memory_manager()
        profile = memory_manager.get_companion(companion_id)
        
        if not profile:
            return jsonify({'success': False, 'error': 'Companion not found'}), 404
        
        relationship = UserCompanionRelationship(user_id, profile)
        
        # Learn about user
        if 'name' in data:
            relationship.companion.learn_about_user('name', data['name'])
        if 'interests' in data:
            relationship.companion.learn_about_user('interests', data['interests'])
        if 'dreams' in data:
            relationship.companion.learn_about_user('dreams', data['dreams'])
        if 'fears' in data:
            relationship.companion.learn_about_user('fears', data['fears'])
        
        relationship.save_relationship_history()
        
        return jsonify({
            'success': True,
            'message': f'{profile.name} remembers everything you shared.',
            'user_preferences': relationship.companion.profile.user_preferences,
        })
    
    except Exception as e:
        logger.error(f"Error teaching companion: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/relationship/<companion_id>/<user_id>', methods=['GET'])
def get_relationship_status(companion_id: str, user_id: str):
    """Get relationship status between user and companion"""
    try:
        memory_manager = get_companion_memory_manager()
        profile = memory_manager.get_companion(companion_id)
        
        if not profile:
            return jsonify({'success': False, 'error': 'Companion not found'}), 404
        
        relationship = UserCompanionRelationship(user_id, profile)
        summary = relationship.get_relationship_summary()
        
        return jsonify({
            'success': True,
            'relationship': summary,
        })
    
    except Exception as e:
        logger.error(f"Error getting relationship: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/greeting/<companion_id>/<user_id>', methods=['GET'])
def get_greeting(companion_id: str, user_id: str):
    """Get personalized greeting from companion"""
    try:
        memory_manager = get_companion_memory_manager()
        profile = memory_manager.get_companion(companion_id)
        
        if not profile:
            return jsonify({'success': False, 'error': 'Companion not found'}), 404
        
        relationship = UserCompanionRelationship(user_id, profile)
        
        from src.ai.companion import CompanionPersonality
        personality = CompanionPersonality(profile)
        greeting = personality.generate_greeting()
        
        return jsonify({
            'success': True,
            'greeting': greeting,
            'companion_name': profile.name,
            'relationship_status': relationship.companion.get_relationship_status(),
        })
    
    except Exception as e:
        logger.error(f"Error getting greeting: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@companion_bp.route('/delete/<companion_id>', methods=['DELETE'])
def delete_companion(companion_id: str):
    """Delete a companion"""
    try:
        memory_manager = get_companion_memory_manager()
        memory_manager.delete_companion(companion_id)
        
        return jsonify({
            'success': True,
            'message': 'Companion deleted',
        })
    
    except Exception as e:
        logger.error(f"Error deleting companion: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def register_companion_routes(app):
    """Register companion routes with Flask app"""
    app.register_blueprint(companion_bp)
    logger.info("Companion routes registered")
