"""
Companion Memory & Relationship Management
Stores companion personalities, memories, and relationship evolution
"""

from typing import Optional, Dict, Any, List
from pathlib import Path
import json
import logging
from datetime import datetime

from ..ai.companion import CompanionProfile, CompanionPersonality, GenderIdentity, PersonalityArchetype

logger = logging.getLogger(__name__)

COMPANIONS_DIR = Path('.companions')


class CompanionMemoryManager:
    """Manages persistent storage of companion data"""
    
    def __init__(self, base_dir: Path = COMPANIONS_DIR):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
        self.companions: Dict[str, CompanionProfile] = {}
        self._load_all_companions()
    
    def _get_companion_file(self, companion_id: str) -> Path:
        """Get file path for a companion"""
        return self.base_dir / f"{companion_id}.json"
    
    def _load_all_companions(self):
        """Load all companions from disk"""
        if not self.base_dir.exists():
            return
        
        for file in self.base_dir.glob("*.json"):
            try:
                with open(file, 'r') as f:
                    data = json.load(f)
                    profile = CompanionProfile.from_dict(data)
                    self.companions[profile.companion_id] = profile
                    logger.info(f"Loaded companion: {profile.name}")
            except Exception as e:
                logger.error(f"Error loading companion from {file}: {e}")
    
    def save_companion(self, profile: CompanionProfile):
        """Save companion to disk"""
        file_path = self._get_companion_file(profile.companion_id)
        
        try:
            with open(file_path, 'w') as f:
                json.dump(profile.to_dict(), f, indent=2)
            self.companions[profile.companion_id] = profile
            logger.info(f"Saved companion: {profile.name}")
        except Exception as e:
            logger.error(f"Error saving companion: {e}")
    
    def get_companion(self, companion_id: str) -> Optional[CompanionProfile]:
        """Get companion profile"""
        return self.companions.get(companion_id)
    
    def get_all_companions(self) -> List[CompanionProfile]:
        """Get all companions"""
        return list(self.companions.values())
    
    def delete_companion(self, companion_id: str):
        """Delete a companion"""
        file_path = self._get_companion_file(companion_id)
        if file_path.exists():
            file_path.unlink()
        if companion_id in self.companions:
            del self.companions[companion_id]
        logger.info(f"Deleted companion: {companion_id}")
    
    def create_new_companion(
        self,
        name: str,
        gender_identity: str = "custom",
        primary_archetype: str = "warm",
        voice_type: str = "warm_alto",
        traits: Dict[str, float] = None
    ) -> CompanionProfile:
        """Create and save a new companion"""
        import uuid
        
        companion_id = str(uuid.uuid4())
        
        profile = CompanionProfile(
            companion_id=companion_id,
            name=name,
            gender_identity=GenderIdentity(gender_identity),
            voice_type=voice_type,
            primary_archetype=PersonalityArchetype(primary_archetype),
            warmth=traits.get('warmth', 0.8) if traits else 0.8,
            humor=traits.get('humor', 0.5) if traits else 0.5,
            intelligence=traits.get('intelligence', 0.9) if traits else 0.9,
            mystery=traits.get('mystery', 0.4) if traits else 0.4,
            ambition=traits.get('ambition', 0.6) if traits else 0.6,
        )
        
        self.save_companion(profile)
        return profile


class UserCompanionRelationship:
    """Manages user's relationship with a specific companion"""
    
    def __init__(self, user_id: str, companion_profile: CompanionProfile):
        self.user_id = user_id
        self.companion = CompanionPersonality(companion_profile)
        self.relationship_file = COMPANIONS_DIR / f"relationship_{user_id}_{companion_profile.companion_id}.json"
        self.load_relationship_history()
    
    def load_relationship_history(self):
        """Load existing relationship history"""
        if self.relationship_file.exists():
            try:
                with open(self.relationship_file, 'r') as f:
                    data = json.load(f)
                    # Restore companion state from saved data
                    self.companion.profile.conversational_history = data.get('conversation_history', [])
                    self.companion.profile.user_name = data.get('user_name')
                    self.companion.profile.user_interests = data.get('user_interests', [])
                    self.companion.profile.user_dreams = data.get('user_dreams', [])
                    self.companion.profile.user_fears = data.get('user_fears', [])
                    self.companion.profile.intimacy_level = data.get('intimacy_level', 0.0)
                    self.companion.profile.affection_level = data.get('affection_level', 0.0)
                    self.companion.profile.familiarity_level = data.get('familiarity_level', 0.0)
                    self.companion.profile.emotional_openness = data.get('emotional_openness', 0.2)
                    self.companion.profile.interactions_count = data.get('interactions_count', 0)
                    logger.info(f"Loaded relationship history for {self.user_id}")
            except Exception as e:
                logger.error(f"Error loading relationship history: {e}")
    
    def save_relationship_history(self):
        """Save relationship state"""
        try:
            data = {
                'user_id': self.user_id,
                'companion_id': self.companion.profile.companion_id,
                'user_name': self.companion.profile.user_name,
                'user_interests': self.companion.profile.user_interests,
                'user_dreams': self.companion.profile.user_dreams,
                'user_fears': self.companion.profile.user_fears,
                'intimacy_level': self.companion.profile.intimacy_level,
                'affection_level': self.companion.profile.affection_level,
                'familiarity_level': self.companion.profile.familiarity_level,
                'emotional_openness': self.companion.profile.emotional_openness,
                'interactions_count': self.companion.profile.interactions_count,
                'conversation_history': self.companion.profile.conversational_history[-500:],  # Keep last 500
                'last_interaction': self.companion.profile.last_interaction,
                'created_at': self.companion.profile.created_at,
            }
            
            COMPANIONS_DIR.mkdir(exist_ok=True)
            with open(self.relationship_file, 'w') as f:
                json.dump(data, f, indent=2)
                logger.debug(f"Saved relationship: {self.user_id} <-> {self.companion.profile.name}")
        except Exception as e:
            logger.error(f"Error saving relationship: {e}")
    
    def get_relationship_summary(self) -> Dict[str, Any]:
        """Get summary of relationship status"""
        return {
            'companion_name': self.companion.profile.name,
            'relationship_status': self.companion.get_relationship_status(),
            'intimacy_level': self.companion.profile.intimacy_level,
            'affection_level': self.companion.profile.affection_level,
            'familiarity_level': self.companion.profile.familiarity_level,
            'interactions_count': self.companion.profile.interactions_count,
            'user_name': self.companion.profile.user_name,
            'last_interaction': self.companion.profile.last_interaction,
        }
    
    def chat(self, user_message: str, quality_score: float = 0.5) -> str:
        """Send a message to companion and get response"""
        # Record the interaction
        # This would integrate with the unified AI handler
        response = f"[Response from {self.companion.profile.name}]"
        
        # Record interaction
        self.companion.record_interaction(user_message, response, quality_score)
        
        # Save relationship
        self.save_relationship_history()
        
        return response
    
    def teach_companion(self, instruction: str):
        """Teach the companion something about preferences"""
        # Could be used for personality refinement
        logger.info(f"Companion {self.companion.profile.name} learning: {instruction}")
    
    def express_feeling(self, feeling: str):
        """Share a feeling with companion for emotional growth"""
        self.companion.share_memory("user_emotion", feeling)
        self.save_relationship_history()


# Global manager
_memory_manager: Optional[CompanionMemoryManager] = None


def get_companion_memory_manager() -> CompanionMemoryManager:
    """Get or create global companion memory manager"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = CompanionMemoryManager()
    return _memory_manager
