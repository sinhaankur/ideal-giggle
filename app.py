"""
Building Management AI Application
Main entry point for the Flask application
"""

from flask import Flask
from src.api.routes import setup_routes
import os

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__, 
                static_folder='src/static',
                static_url_path='/static')
    
    # Configuration
    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production-' + os.urandom(24).hex())
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    
    # Setup routes
    setup_routes(app)
    
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', 5000))
    
    print(f"""
    ╔═══════════════════════════════════════════════════════╗
    ║  AI Companion - On-Device AI (Edge AI)                ║
    ║                                                       ║
    ║  🌐 Server running on:                                ║
    ║     http://localhost:{port}                              ║
    ║                                                       ║
    ║  🤖 On-Device AI Features:                            ║
    ║     - Local Ollama Integration (Port 11434)          ║
    ║     - Privacy-First - All data stays local           ║
    ║     - No cloud API calls needed                      ║
    ║     - Real-time chat & emotion detection            ║
    ║                                                       ║
    ║  📊 API Endpoints:                                    ║
    ║     - POST /api/companion/chat     - Chat with AI    ║
    ║     - POST /api/companion/create   - Create companion║
    ║     - GET  /api/ai/health          - AI health check ║
    ║     - GET  /api/ai/models          - Available models║
    ║                                                       ║
    ║  🎙️  Features:                                        ║
    ║     ✓ Continuous voice input                         ║
    ║     ✓ Emotion detection (ML5.js)                     ║
    ║     ✓ Calendar sync support                          ║
    ║     ✓ Multi-companion support                        ║
    ║                                                       ║
    ║  💡 Make sure Ollama is running on port 11434        ║
    ╚═══════════════════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])
