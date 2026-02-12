"""
Privacy and Encryption Module
Ensures all camera and movement data remains encrypted and private
"""

import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from typing import Union, Dict, Optional
import secrets


class PrivacyManager:
    """Manages encryption and privacy for sensitive data"""
    
    def __init__(self, key: Optional[bytes] = None, password: Optional[str] = None):
        """
        Initialize privacy manager with encryption key
        
        Args:
            key: Encryption key (32 bytes). If not provided, one will be generated
            password: Password to derive key from. If provided, key is ignored
        """
        if password:
            self.key = self._derive_key_from_password(password)
        elif key:
            self.key = key
        else:
            self.key = Fernet.generate_key()
        
        self.cipher = Fernet(self.key)
    
    @staticmethod
    def _derive_key_from_password(password: str, salt: Optional[bytes] = None) -> bytes:
        """
        Derive encryption key from password
        
        Args:
            password: User password
            salt: Salt for key derivation. If None, a fixed salt is used
            
        Returns:
            Derived encryption key
        """
        if salt is None:
            # Use a fixed salt (in production, store this securely)
            salt = b'building_management_ai_2026'
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))
    
    def encrypt_data(self, data: Union[str, bytes, Dict]) -> str:
        """
        Encrypt data
        
        Args:
            data: Data to encrypt (string, bytes, or dict)
            
        Returns:
            Base64-encoded encrypted data
        """
        # Convert data to bytes
        if isinstance(data, dict):
            data_bytes = json.dumps(data).encode()
        elif isinstance(data, str):
            data_bytes = data.encode()
        else:
            data_bytes = data
        
        # Encrypt
        encrypted = self.cipher.encrypt(data_bytes)
        
        # Return as base64 string
        return base64.b64encode(encrypted).decode()
    
    def decrypt_data(self, encrypted_data: str, as_json: bool = False) -> Union[str, bytes, Dict]:
        """
        Decrypt data
        
        Args:
            encrypted_data: Base64-encoded encrypted data
            as_json: If True, try to parse result as JSON
            
        Returns:
            Decrypted data
        """
        # Decode from base64
        encrypted_bytes = base64.b64decode(encrypted_data)
        
        # Decrypt
        decrypted = self.cipher.decrypt(encrypted_bytes)
        
        # Parse as JSON if requested
        if as_json:
            try:
                return json.loads(decrypted.decode())
            except json.JSONDecodeError:
                pass
        
        # Try to decode as string
        try:
            return decrypted.decode()
        except UnicodeDecodeError:
            return decrypted
    
    def encrypt_image(self, image_bytes: bytes) -> str:
        """
        Encrypt image data
        
        Args:
            image_bytes: Image as bytes (JPEG, PNG, etc.)
            
        Returns:
            Base64-encoded encrypted image
        """
        return self.encrypt_data(image_bytes)
    
    def decrypt_image(self, encrypted_image: str) -> bytes:
        """
        Decrypt image data
        
        Args:
            encrypted_image: Base64-encoded encrypted image
            
        Returns:
            Decrypted image bytes
        """
        result = self.decrypt_data(encrypted_image)
        if isinstance(result, bytes):
            return result
        return result.encode()
    
    def encrypt_movement_data(self, movement_data: Dict) -> str:
        """
        Encrypt movement detection data
        
        Args:
            movement_data: Movement detection results
            
        Returns:
            Encrypted movement data
        """
        return self.encrypt_data(movement_data)
    
    def decrypt_movement_data(self, encrypted_data: str) -> Dict:
        """
        Decrypt movement detection data
        
        Args:
            encrypted_data: Encrypted movement data
            
        Returns:
            Decrypted movement detection results
        """
        return self.decrypt_data(encrypted_data, as_json=True)
    
    def get_key(self) -> str:
        """
        Get encryption key as base64 string
        
        Returns:
            Base64-encoded encryption key
        """
        return base64.b64encode(self.key).decode()
    
    @classmethod
    def from_key_string(cls, key_string: str) -> 'PrivacyManager':
        """
        Create PrivacyManager from base64-encoded key string
        
        Args:
            key_string: Base64-encoded key
            
        Returns:
            PrivacyManager instance
        """
        key = base64.b64decode(key_string)
        return cls(key=key)
    
    def save_key_to_file(self, filepath: str):
        """
        Save encryption key to file (use with caution!)
        
        Args:
            filepath: Path to save key
        """
        with open(filepath, 'wb') as f:
            f.write(self.key)
    
    @classmethod
    def load_key_from_file(cls, filepath: str) -> 'PrivacyManager':
        """
        Load encryption key from file
        
        Args:
            filepath: Path to key file
            
        Returns:
            PrivacyManager instance
        """
        with open(filepath, 'rb') as f:
            key = f.read()
        return cls(key=key)
    
    @staticmethod
    def generate_session_token() -> str:
        """
        Generate a secure random session token
        
        Returns:
            Random session token
        """
        return secrets.token_urlsafe(32)


class SecureStorage:
    """Secure storage for encrypted data"""
    
    def __init__(self, privacy_manager: PrivacyManager):
        """
        Initialize secure storage
        
        Args:
            privacy_manager: PrivacyManager instance for encryption
        """
        self.pm = privacy_manager
        self.storage = {}
    
    def store(self, key: str, data: Union[str, bytes, Dict]) -> bool:
        """
        Store data securely
        
        Args:
            key: Storage key
            data: Data to store
            
        Returns:
            True if successful
        """
        try:
            encrypted = self.pm.encrypt_data(data)
            self.storage[key] = encrypted
            return True
        except Exception as e:
            print(f"Error storing data: {e}")
            return False
    
    def retrieve(self, key: str, as_json: bool = False) -> Optional[Union[str, bytes, Dict]]:
        """
        Retrieve and decrypt data
        
        Args:
            key: Storage key
            as_json: Parse as JSON
            
        Returns:
            Decrypted data or None if not found
        """
        encrypted = self.storage.get(key)
        if encrypted is None:
            return None
        
        try:
            return self.pm.decrypt_data(encrypted, as_json=as_json)
        except Exception as e:
            print(f"Error retrieving data: {e}")
            return None
    
    def delete(self, key: str) -> bool:
        """
        Delete stored data
        
        Args:
            key: Storage key
            
        Returns:
            True if deleted, False if not found
        """
        if key in self.storage:
            del self.storage[key]
            return True
        return False
    
    def clear(self):
        """Clear all stored data"""
        self.storage.clear()
    
    def list_keys(self) -> list:
        """Get list of storage keys"""
        return list(self.storage.keys())


# Global privacy manager instance
_privacy_manager = None


def get_privacy_manager(password: str = "default_secure_password_change_me") -> PrivacyManager:
    """
    Get or create global privacy manager instance
    
    Args:
        password: Password for key derivation
        
    Returns:
        PrivacyManager instance
    """
    global _privacy_manager
    if _privacy_manager is None:
        _privacy_manager = PrivacyManager(password=password)
    return _privacy_manager
