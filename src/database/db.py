"""
Database models and management for Building Management AI
"""

import sqlite3
import hashlib
import secrets
from datetime import datetime
from typing import Dict, List, Optional
from contextlib import contextmanager


class Database:
    """Database manager for the application"""
    
    def __init__(self, db_path: str = "data/building_ai.db"):
        """Initialize database connection"""
        self.db_path = db_path
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def init_database(self):
        """Initialize database tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    api_token TEXT UNIQUE,
                    role TEXT DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            """)
            
            # Predictions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    input_data TEXT NOT NULL,
                    prediction_result TEXT NOT NULL,
                    model_used TEXT,
                    confidence REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # Chat history table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    message TEXT NOT NULL,
                    ai_provider TEXT,
                    model_used TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # Building data table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS building_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    building_id TEXT NOT NULL,
                    temperature REAL,
                    occupancy INTEGER,
                    energy_consumption REAL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            """)
            
            # System logs table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    action TEXT NOT NULL,
                    details TEXT,
                    ip_address TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            """)
            
            # Create default admin user if not exists
            cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
            if cursor.fetchone()[0] == 0:
                admin_password = hashlib.sha256("admin123".encode()).hexdigest()
                cursor.execute("""
                    INSERT INTO users (username, email, password_hash, role, api_token)
                    VALUES (?, ?, ?, ?, ?)
                """, ("admin", "admin@buildingai.local", admin_password, "admin", secrets.token_urlsafe(32)))
    
    def create_user(self, username: str, email: str, password: str, role: str = "user") -> Dict:
        """Create a new user"""
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        api_token = secrets.token_urlsafe(32)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO users (username, email, password_hash, role, api_token)
                    VALUES (?, ?, ?, ?, ?)
                """, (username, email, password_hash, role, api_token))
                
                return {
                    "id": cursor.lastrowid,
                    "username": username,
                    "email": email,
                    "role": role,
                    "api_token": api_token
                }
            except sqlite3.IntegrityError:
                return {"error": "Username or email already exists"}
    
    def authenticate_user(self, identifier: str, password: str) -> Optional[Dict]:
        """Authenticate user by username OR email and return user data"""
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, role, api_token
                FROM users
                WHERE (username = ? OR email = ?) AND password_hash = ? AND is_active = 1
            """, (identifier, identifier, password_hash))

            user = cursor.fetchone()
            if user:
                # Update last login
                cursor.execute("""
                    UPDATE users SET last_login = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (user['id'],))

                return dict(user)
            return None
    
    def get_user_by_token(self, api_token: str) -> Optional[Dict]:
        """Get user by API token"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, role
                FROM users
                WHERE api_token = ? AND is_active = 1
            """, (api_token,))
            
            user = cursor.fetchone()
            return dict(user) if user else None
    
    def save_prediction(self, user_id: int, input_data: str, result: str, model: str, confidence: float) -> int:
        """Save prediction to database"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO predictions (user_id, input_data, prediction_result, model_used, confidence)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, input_data, result, model, confidence))
            return cursor.lastrowid
    
    def get_user_predictions(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get user's prediction history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM predictions
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (user_id, limit))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def save_chat_message(self, user_id: int, session_id: str, role: str, message: str, 
                         ai_provider: str = None, model: str = None) -> int:
        """Save chat message to history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO chat_history (user_id, session_id, role, message, ai_provider, model_used)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, session_id, role, message, ai_provider, model))
            return cursor.lastrowid
    
    def get_chat_history(self, user_id: int, session_id: str, limit: int = 50) -> List[Dict]:
        """Get chat history for a session"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM chat_history
                WHERE user_id = ? AND session_id = ?
                ORDER BY created_at ASC
                LIMIT ?
            """, (user_id, session_id, limit))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def save_building_data(self, building_id: str, temperature: float, occupancy: int, 
                          energy_consumption: float, metadata: str = None) -> int:
        """Save building sensor data"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO building_data (building_id, temperature, occupancy, energy_consumption, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (building_id, temperature, occupancy, energy_consumption, metadata))
            return cursor.lastrowid
    
    def get_building_data(self, building_id: str, hours: int = 24) -> List[Dict]:
        """Get building data for the last N hours"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM building_data
                WHERE building_id = ?
                AND timestamp >= datetime('now', '-' || ? || ' hours')
                ORDER BY timestamp DESC
            """, (building_id, hours))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def log_action(self, user_id: int, action: str, details: str = None, ip_address: str = None):
        """Log user action"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO system_logs (user_id, action, details, ip_address)
                VALUES (?, ?, ?, ?)
            """, (user_id, action, details, ip_address))
    
    def get_all_users(self) -> List[Dict]:
        """Get all users (admin only)"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, username, email, role, created_at, last_login, is_active
                FROM users
                ORDER BY created_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]
    
    def get_statistics(self) -> Dict:
        """Get system statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            stats = {}
            
            # Total users
            cursor.execute("SELECT COUNT(*) as count FROM users WHERE is_active = 1")
            stats['total_users'] = cursor.fetchone()['count']
            
            # Total predictions
            cursor.execute("SELECT COUNT(*) as count FROM predictions")
            stats['total_predictions'] = cursor.fetchone()['count']
            
            # Total chat messages
            cursor.execute("SELECT COUNT(*) as count FROM chat_history")
            stats['total_messages'] = cursor.fetchone()['count']
            
            # Building data points
            cursor.execute("SELECT COUNT(*) as count FROM building_data")
            stats['data_points'] = cursor.fetchone()['count']
            
            return stats


# Singleton instance
_db_instance = None

def get_database() -> Database:
    """Get or create database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance
