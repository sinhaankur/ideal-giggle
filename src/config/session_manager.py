"""
User Session & Cookie Management
Tracks user preferences, timezone, cookies, and mood history
"""

from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import json
import hashlib
from pathlib import Path
import os


@dataclass
class UserCookie:
    """User preference cookie"""
    name: str
    value: str
    expires: str           # ISO format datetime
    domain: str = "localhost"
    path: str = "/"
    secure: bool = False
    http_only: bool = True
    same_site: str = "Lax"
    
    def is_expired(self) -> bool:
        """Check if cookie is expired"""
        try:
            expires = datetime.fromisoformat(self.expires)
            return datetime.utcnow() > expires
        except:
            return False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class UserSession:
    """User session information"""
    session_id: str
    user_id: str
    timezone: str              # e.g., "Asia/Kolkata"
    timezone_offset: int       # Minutes from UTC
    created_at: str
    last_activity: str
    cookies: List[UserCookie] = field(default_factory=list)
    mood_history: List[Dict[str, Any]] = field(default_factory=list)
    ai_preferences: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'timezone': self.timezone,
            'timezone_offset': self.timezone_offset,
            'created_at': self.created_at,
            'last_activity': self.last_activity,
            'cookies': [c.to_dict() for c in self.cookies],
            'mood_history': self.mood_history,
            'ai_preferences': self.ai_preferences,
            'metadata': self.metadata
        }
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserSession':
        """Create from dictionary"""
        cookies = [UserCookie(**c) for c in data.get('cookies', [])]
        return cls(
            session_id=data['session_id'],
            user_id=data['user_id'],
            timezone=data['timezone'],
            timezone_offset=data['timezone_offset'],
            created_at=data['created_at'],
            last_activity=data['last_activity'],
            cookies=cookies,
            mood_history=data.get('mood_history', []),
            ai_preferences=data.get('ai_preferences', {}),
            metadata=data.get('metadata', {})
        )


class SessionManager:
    """Manage user sessions and cookies"""
    
    def __init__(self, sessions_dir: Optional[str] = None):
        """Initialize session manager"""
        if sessions_dir is None:
            sessions_dir = os.path.join(
                os.path.dirname(__file__),
                '../../.sessions'
            )
        self.sessions_dir = sessions_dir
        Path(self.sessions_dir).mkdir(parents=True, exist_ok=True)
        self.active_sessions: Dict[str, UserSession] = {}
    
    def create_session(self, user_id: str, timezone: str = "UTC",
                      timezone_offset: int = 0) -> UserSession:
        """Create new user session"""
        session_id = self._generate_session_id(user_id)
        now = datetime.utcnow().isoformat()
        
        session = UserSession(
            session_id=session_id,
            user_id=user_id,
            timezone=timezone,
            timezone_offset=timezone_offset,
            created_at=now,
            last_activity=now,
            ai_preferences={
                'provider': 'hybrid',           # Local-first with cloud fallback
                'use_local_first': True,
                'fallback_to_cloud': True,
                'ollama_model': 'neural-chat'
            }
        )
        
        self.active_sessions[session_id] = session
        self._save_session(session)
        return session
    
    def get_session(self, session_id: str) -> Optional[UserSession]:
        """Get session by ID"""
        # Try memory first
        if session_id in self.active_sessions:
            return self.active_sessions[session_id]
        
        # Load from disk
        session_file = os.path.join(self.sessions_dir, f"{session_id}.json")
        if os.path.exists(session_file):
            try:
                with open(session_file, 'r') as f:
                    data = json.load(f)
                    session = UserSession.from_dict(data)
                    self.active_sessions[session_id] = session
                    return session
            except Exception as e:
                print(f"Error loading session: {e}")
        
        return None
    
    def add_cookie(self, session_id: str, name: str, value: str,
                  max_age: int = 31536000) -> bool:
        """Add cookie to session (max_age in seconds)"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        expires = datetime.utcnow() + timedelta(seconds=max_age)
        cookie = UserCookie(
            name=name,
            value=value,
            expires=expires.isoformat()
        )
        
        # Remove old cookie with same name
        session.cookies = [c for c in session.cookies if c.name != name]
        session.cookies.append(cookie)
        
        self._update_activity(session)
        self._save_session(session)
        return True
    
    def get_cookie(self, session_id: str, name: str) -> Optional[str]:
        """Get cookie value"""
        session = self.get_session(session_id)
        if not session:
            return None
        
        for cookie in session.cookies:
            if cookie.name == name and not cookie.is_expired():
                return cookie.value
        
        return None
    
    def get_all_cookies(self, session_id: str) -> Dict[str, str]:
        """Get all valid cookies"""
        session = self.get_session(session_id)
        if not session:
            return {}
        
        cookies = {}
        for cookie in session.cookies:
            if not cookie.is_expired():
                cookies[cookie.name] = cookie.value
        
        return cookies
    
    def record_mood(self, session_id: str, mood: str, 
                   confidence: float = 1.0,
                   context: Optional[Dict[str, Any]] = None) -> bool:
        """Record mood in mood history"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        mood_record = {
            'timestamp': datetime.utcnow().isoformat(),
            'mood': mood,
            'confidence': confidence,
            'context': context or {}
        }
        
        session.mood_history.append(mood_record)
        
        # Keep only last 1000 moods
        if len(session.mood_history) > 1000:
            session.mood_history = session.mood_history[-1000:]
        
        self._update_activity(session)
        self._save_session(session)
        return True
    
    def get_mood_history(self, session_id: str, 
                        limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent mood history"""
        session = self.get_session(session_id)
        if not session:
            return []
        
        return session.mood_history[-limit:]
    
    def set_ai_preference(self, session_id: str, key: str, 
                         value: Any) -> bool:
        """Set AI preference"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        session.ai_preferences[key] = value
        self._update_activity(session)
        self._save_session(session)
        return True
    
    def get_ai_preferences(self, session_id: str) -> Dict[str, Any]:
        """Get all AI preferences"""
        session = self.get_session(session_id)
        if not session:
            return {}
        
        return session.ai_preferences
    
    def update_timezone(self, session_id: str, timezone: str,
                       offset: int) -> bool:
        """Update user timezone"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        session.timezone = timezone
        session.timezone_offset = offset
        self._update_activity(session)
        self._save_session(session)
        return True
    
    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions (older than 30 days)"""
        cutoff = datetime.utcnow() - timedelta(days=30)
        removed = 0
        
        for session_id in list(self.active_sessions.keys()):
            session = self.active_sessions[session_id]
            try:
                created = datetime.fromisoformat(session.created_at)
                if created < cutoff:
                    del self.active_sessions[session_id]
                    removed += 1
            except:
                pass
        
        return removed
    
    def _generate_session_id(self, user_id: str) -> str:
        """Generate unique session ID"""
        data = f"{user_id}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]
    
    def _update_activity(self, session: UserSession):
        """Update session's last activity timestamp"""
        session.last_activity = datetime.utcnow().isoformat()
    
    def _save_session(self, session: UserSession):
        """Save session to disk"""
        try:
            session_file = os.path.join(
                self.sessions_dir,
                f"{session.session_id}.json"
            )
            with open(session_file, 'w') as f:
                json.dump(session.to_dict(), f, indent=2)
        except Exception as e:
            print(f"Error saving session: {e}")


# Global session manager instance
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    """Get or create global session manager"""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
