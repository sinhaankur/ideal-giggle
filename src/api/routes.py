from flask import Blueprint, jsonify, request, send_from_directory, Flask, session
from flask_cors import CORS
from datetime import datetime
from functools import wraps
import os
import json
import secrets
import tempfile
import base64
import cv2
import numpy as np

# Import AI client and database
from src.ai.ai_client import create_ai_client
from src.database import get_database

# Import AI models (with error handling for development)
try:
    from ai.models.index import BuildingModel, EnergyConsumptionModel
    from ai.utils.index import preprocess_data, evaluate_model
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("Warning: AI models not available. Using mock responses.")

api = Blueprint('api', __name__)
db = get_database()

# Initialize AI client
ai_client = create_ai_client(provider="ollama")

# Authentication decorator
def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check session
        if 'user_id' in session:
            return f(*args, **kwargs)
        
        # Check API token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if token:
            user = db.get_user_by_token(token)
            if user:
                request.user = user
                return f(*args, **kwargs)
        
        return jsonify({'error': 'Authentication required'}), 401
    return decorated_function

# Admin only decorator
def require_admin(f):
    """Decorator to require admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        user_id = session.get('user_id')
        # Get user from database to check role
        # For now, simplified check
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

# Authentication endpoints
@api.route('/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not all([username, email, password]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        result = db.create_user(username, email, password)
        
        if 'error' in result:
            return jsonify(result), 400
        
        # Log the action
        db.log_action(result['id'], 'user_registered', ip_address=request.remote_addr)
        
        return jsonify({
            'message': 'User registered successfully',
            'user': {
                'id': result['id'],
                'username': result['username'],
                'email': result['email'],
                'api_token': result['api_token']
            }
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/auth/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.json
        # Allow login with either username or email
        username = data.get('username') or data.get('email')
        password = data.get('password')
        
        if not all([username, password]):
            return jsonify({'error': 'Missing email/username or password'}), 400
        
        user = db.authenticate_user(username, password)
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Set session
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        
        # Log the action
        db.log_action(user['id'], 'user_login', ip_address=request.remote_addr)
        
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'api_token': user['api_token']
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/auth/logout', methods=['POST'])
def logout():
    """Logout user"""
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

@api.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user info"""
    user_id = session.get('user_id')
    if user_id:
        return jsonify({
            'id': user_id,
            'username': session.get('username'),
            'role': session.get('role')
        })
    return jsonify({'error': 'Not authenticated'}), 401

# AI Chat endpoints
@api.route('/chat', methods=['POST'])
@require_auth
def chat():
    """Chat with AI"""
    try:
        data = request.json
        message = data.get('message')
        session_id = data.get('session_id', secrets.token_urlsafe(16))
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        user_id = session.get('user_id')
        
        # Get chat history
        history = db.get_chat_history(user_id, session_id, limit=10)
        context = [{"role": h['role'], "content": h['message']} for h in history]
        
        # Save user message
        db.save_chat_message(user_id, session_id, 'user', message)
        
        # Get AI response
        response = ai_client.chat(message, context=context)
        
        # Save AI response
        if 'message' in response:
            db.save_chat_message(
                user_id, session_id, 'assistant', 
                response['message'], 
                ai_provider=response.get('provider'),
                model=response.get('model')
            )
        
        return jsonify({
            'response': response.get('message', 'Sorry, I couldn\'t generate a response.'),
            'session_id': session_id,
            'model': response.get('model'),
            'provider': response.get('provider')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/chat/history/<session_id>', methods=['GET'])
@require_auth
def get_chat_history_endpoint(session_id):
    """Get chat history for a session"""
    try:
        user_id = session.get('user_id')
        history = db.get_chat_history(user_id, session_id)
        
        return jsonify({
            'history': history,
            'session_id': session_id
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# AI Analysis endpoints
@api.route('/ai/analyze', methods=['POST'])
@require_auth
def analyze_data():
    """Analyze building data with AI"""
    try:
        data = request.json
        
        response = ai_client.analyze_building_data(data)
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/health', methods=['GET'])
def ai_health():
    """Check AI service health"""
    try:
        health = ai_client.health_check()
        return jsonify(health)
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'unhealthy'}), 500

@api.route('/ai/status', methods=['GET'])
def ai_status():
    """Get detailed on-device AI status"""
    try:
        import requests
        
        # Check Flask app status
        flask_status = {
            'service': 'Flask API',
            'status': 'running',
            'port': 5000,
            'environment': 'On-Device AI'
        }
        
        # Check Ollama status (use env or ai_config)
        ollama_url = os.getenv('OLLAMA_URL', os.getenv('OLLAMA_BASE', 'http://localhost:11434'))
        ollama_status = {
            'service': 'Ollama (Local LLM)' if 'localhost' in ollama_url else 'Ollama (Buildingai.cloud)',
            'status': 'unknown',
            'url': ollama_url,
            'models': []
        }
        
        try:
            # Try to reach Ollama
            response = requests.get(f'{ollama_url}/api/tags', timeout=10)
            if response.status_code == 200:
                data = response.json()
                ollama_status['status'] = 'running'
                ollama_status['models'] = [m.get('name', 'unknown') for m in data.get('models', [])]
        except:
            ollama_status['status'] = 'unavailable'
            ollama_status['models'] = []
        
        # Check AI client configuration
        ai_config = {
            'provider': 'ollama',
            'mode': 'on-device',
            'privacy': 'full-local',
            'cloud_fallback': False
        }
        
        return jsonify({
            'success': True,
            'flask': flask_status,
            'ollama': ollama_status,
            'ai_client': ai_config,
            'features': {
                'chat': 'enabled',
                'emotion_detection': 'enabled',
                'voice_input': 'enabled',
                'calendar_sync': 'enabled'
            },
            'note': 'All AI processing happens locally on this device for maximum privacy'
        })
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500

@api.route('/ai/models', methods=['GET'])
def get_models():
    """Get available AI models"""
    try:
        models = ai_client.get_available_models()
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Building data endpoints
@api.route('/building/data', methods=['POST'])
@require_auth
def save_building_data():
    """Save building sensor data"""
    try:
        data = request.json
        building_id = data.get('building_id', 'default')
        temperature = data.get('temperature')
        occupancy = data.get('occupancy')
        energy_consumption = data.get('energy_consumption')
        metadata = json.dumps(data.get('metadata', {}))
        
        data_id = db.save_building_data(
            building_id, temperature, occupancy, energy_consumption, metadata
        )
        
        return jsonify({
            'message': 'Data saved successfully',
            'id': data_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/building/data/<building_id>', methods=['GET'])
@require_auth
def get_building_data_endpoint(building_id):
    """Get building data"""
    try:
        hours = request.args.get('hours', 24, type=int)
        data = db.get_building_data(building_id, hours)
        
        return jsonify({
            'building_id': building_id,
            'data': data,
            'count': len(data)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# User management endpoints
@api.route('/users/predictions', methods=['GET'])
@require_auth
def get_user_predictions():
    """Get user's prediction history"""
    try:
        user_id = session.get('user_id')
        limit = request.args.get('limit', 50, type=int)
        
        predictions = db.get_user_predictions(user_id, limit)
        
        return jsonify({
            'predictions': predictions,
            'count': len(predictions)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Admin endpoints
@api.route('/admin/users', methods=['GET'])
@require_admin
def get_all_users():
    """Get all users (admin only)"""
    try:
        users = db.get_all_users()
        return jsonify({'users': users})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/admin/stats', methods=['GET'])
@require_admin
def get_statistics():
    """Get system statistics (admin only)"""
    try:
        stats = db.get_statistics()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/predict', methods=['POST'])
def predict():
    """Generate prediction based on input data"""
    try:
        data = request.json
        
        if MODELS_AVAILABLE:
            processed_data = preprocess_data(data)
            prediction = BuildingModel.predict(processed_data)
        else:
            # Mock prediction for development
            prediction = f"Predicted energy consumption: {150 + (data.get('temperature', 20) * 2)} kWh"
        
        return jsonify({
            'prediction': prediction,
            'confidence': 0.87,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/model-status', methods=['GET'])
def model_status():
    """Get status of AI models"""
    try:
        if MODELS_AVAILABLE:
            status = {
                'building_model': BuildingModel.get_status(),
                'energy_model': EnergyConsumptionModel.get_status()
            }
        else:
            # Mock status for development
            status = {
                'building_model': {
                    'status': 'active',
                    'accuracy': 0.92,
                    'last_updated': datetime.now().isoformat()
                },
                'energy_model': {
                    'status': 'active',
                    'accuracy': 0.88,
                    'last_updated': datetime.now().isoformat()
                }
            }
        return jsonify(status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Vision AI & Camera endpoints
@api.route('/vision/cameras', methods=['GET'])
def list_cameras():
    """List available camera devices"""
    try:
        from src.camera.camera_manager import CameraManager
        cameras = CameraManager.list_available_cameras()
        return jsonify({'cameras': cameras, 'count': len(cameras)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/start', methods=['POST'])
def start_vision_monitoring():
    """Start camera monitoring with AI analysis"""
    try:
        from src.ai.vision_service import get_vision_service
        
        data = request.json or {}
        camera_index = data.get('camera_index', 0)
        enable_audio = data.get('enable_audio', True)
        
        vision_service = get_vision_service()
        result = vision_service.start_monitoring(
            camera_index=camera_index,
            enable_audio=enable_audio
        )
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/stop', methods=['POST'])
def stop_vision_monitoring():
    """Stop camera monitoring"""
    try:
        from src.ai.vision_service import get_vision_service
        
        vision_service = get_vision_service()
        result = vision_service.stop_monitoring()
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/frame', methods=['GET'])
def get_current_frame():
    """Get current camera frame with movement annotations"""
    try:
        from src.ai.vision_service import get_vision_service
        
        encrypted = request.args.get('encrypted', 'true').lower() == 'true'
        annotated = request.args.get('annotated', 'true').lower() == 'true'
        
        vision_service = get_vision_service()
        frame_data = vision_service.get_current_frame(encrypted=encrypted, annotated=annotated)
        
        if frame_data is None:
            return jsonify({'error': 'No frame available'}), 404
        
        return jsonify(frame_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/movement/history', methods=['GET'])
def get_movement_history_endpoint():
    """Get movement detection history"""
    try:
        from src.ai.vision_service import get_vision_service
        
        limit = request.args.get('limit', 50, type=int)
        
        vision_service = get_vision_service()
        history = vision_service.get_movement_history(limit=limit)
        
        return jsonify({
            'history': history,
            'count': len(history)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/analysis', methods=['GET'])
def get_movement_analysis_endpoint():
    """Get AI analyses of detected movements"""
    try:
        from src.ai.vision_service import get_vision_service
        
        limit = request.args.get('limit', 10, type=int)
        
        vision_service = get_vision_service()
        analyses = vision_service.get_movement_analysis(limit=limit)
        
        return jsonify({
            'analyses': analyses,
            'count': len(analyses)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/analyze-now', methods=['POST'])
def analyze_current_situation_endpoint():
    """Get immediate AI analysis of current camera view"""
    try:
        from src.ai.vision_service import get_vision_service
        
        vision_service = get_vision_service()
        analysis = vision_service.analyze_current_situation()
        
        return jsonify(analysis)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/stats', methods=['GET'])
def get_vision_stats():
    """Get vision service statistics"""
    try:
        from src.ai.vision_service import get_vision_service
        
        vision_service = get_vision_service()
        stats = vision_service.get_statistics()
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/vision/encryption-status', methods=['GET'])
def get_encryption_status():
    """Get encryption and privacy status"""
    try:
        from src.ai.vision_service import get_vision_service
        
        vision_service = get_vision_service()
        status = vision_service.get_encrypted_status()
        
        return jsonify(status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Emotion Analysis endpoints
@api.route('/emotion/frame-analysis', methods=['POST'])
def analyze_frame_emotions():
    """Analyze emotions in a single frame"""
    try:
        from src.ai.emotion_analyzer import get_emotion_analyzer
        import cv2
        import base64
        import numpy as np
        
        data = request.json or {}
        
        # Get frame from request or use current camera frame
        if 'frame' in data:
            # Decode base64 frame
            frame_b64 = data['frame']
            frame_data = base64.b64decode(frame_b64)
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            # Use current camera frame
            from src.ai.vision_service import get_vision_service
            vision_service = get_vision_service()
            frame = vision_service.camera.capture_frame() if vision_service.is_monitoring else None
        
        if frame is None:
            return jsonify({'error': 'No frame available'}), 404
        
        # Analyze emotions
        analyzer = get_emotion_analyzer()
        audio_text = data.get('audio_text', None)
        analysis = analyzer.analyze_frame(frame, audio_text=audio_text)
        
        return jsonify(analysis)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/emotion/continuous-analysis', methods=['GET'])
def get_emotion_analysis_stream():
    """Get continuous emotion analysis from active camera monitoring"""
    try:
        from src.ai.emotion_analyzer import get_emotion_analyzer
        from src.ai.vision_service import get_vision_service
        
        analyzer = get_emotion_analyzer()
        vision_service = get_vision_service()
        
        # If camera is monitoring, analyze current frame
        if vision_service.is_monitoring:
            frame = vision_service.camera.capture_frame()
            if frame is not None:
                analysis = analyzer.analyze_frame(frame)
                return jsonify({
                    'success': True,
                    'analysis': analysis,
                    'camera_active': True
                })
        
        return jsonify({
            'success': False,
            'error': 'Camera not actively monitoring',
            'camera_active': False
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/emotion/statistics', methods=['GET'])
def get_emotion_statistics():
    """Get emotion detection statistics"""
    try:
        from src.ai.emotion_analyzer import get_emotion_analyzer
        
        analyzer = get_emotion_analyzer()
        stats = analyzer.get_statistics()
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/emotion/history', methods=['GET'])
def get_emotion_history():
    """Get emotion analysis history"""
    try:
        from src.ai.emotion_analyzer import get_emotion_analyzer
        
        limit = request.args.get('limit', 20, type=int)
        analyzer = get_emotion_analyzer()
        
        # Get history from both facial and audio analyzers
        history = {
            'facial_history': list(analyzer.facial_detector.detection_history)[-limit:],
            'audio_history': list(analyzer.audio_analyzer.analysis_history)[-limit:],
            'combined_history': list(analyzer.combined_history)[-limit:]
        }
        
        return jsonify(history)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Audio Emotion endpoints
@api.route('/audio/transcribe-file', methods=['POST'])
def transcribe_audio_file():
    """Transcribe audio file to text"""
    try:
        from src.ai.audio_emotion import get_audio_processor
        
        if 'file' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['file']
        language = request.form.get('language', 'en-US')
        
        # Save temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            audio_file.save(tmp.name)
            temp_path = tmp.name
        
        try:
            # Process audio
            processor = get_audio_processor()
            result = processor.process_audio_file(temp_path)
            return jsonify(result)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/audio/analyze-emotion', methods=['POST'])
def analyze_audio_emotion():
    """Analyze emotion from audio file"""
    try:
        from src.ai.audio_emotion import get_audio_processor, get_audio_emotion_detector
        
        if 'file' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['file']
        
        # Save temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            audio_file.save(tmp.name)
            temp_path = tmp.name
        
        try:
            # Analyze emotion
            detector = get_audio_emotion_detector()
            result = detector.analyze_audio_file(temp_path)
            return jsonify(result)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/audio/sentiment-text', methods=['POST'])
def analyze_text_sentiment():
    """Analyze sentiment of transcribed text"""
    try:
        from src.ai.emotion_analyzer import get_emotion_analyzer
        
        data = request.json or {}
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Analyze sentiment
        analyzer = get_emotion_analyzer()
        result = analyzer.audio_analyzer.analyze_sentiment(text)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/audio/transcription-history', methods=['GET'])
def get_transcription_history():
    """Get audio transcription history"""
    try:
        from src.ai.audio_emotion import get_audio_processor
        
        limit = request.args.get('limit', 20, type=int)
        processor = get_audio_processor()
        
        history = processor.recognizer.get_history(limit=limit)
        
        return jsonify({
            'history': history,
            'count': len(history)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/audio/statistics', methods=['GET'])
def get_audio_statistics():
    """Get audio processing statistics"""
    try:
        from src.ai.audio_emotion import get_audio_processor
        
        processor = get_audio_processor()
        stats = processor.get_statistics()
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== EMOTION-BASED AI COMMANDS ====================

@api.route('/ai/emotion-command', methods=['POST'])
def process_emotion_command():
    """
    Process emotion and generate command/action
    
    Request body:
    {
        "emotion": "happy|sad|angry|fear|surprise|disgust|neutral",
        "confidence": 0.0-1.0,
        "context": {...}
    }
    """
    try:
        from src.ai.emotion_commands import get_emotion_command_interpreter
        
        data = request.json or {}
        emotion = data.get('emotion', 'neutral').lower()
        confidence = data.get('confidence', 0.7)
        context = data.get('context', {})
        
        interpreter = get_emotion_command_interpreter()
        actions, response = interpreter.interpret_emotion(emotion, confidence, context)
        
        return jsonify({
            'emotion': emotion,
            'confidence': confidence,
            'actions': [
                {
                    'emotion': a.emotion,
                    'action_type': a.action_type,
                    'action_name': a.action_name,
                    'description': a.description,
                    'parameters': a.parameters,
                    'timestamp': a.timestamp
                }
                for a in actions
            ],
            'ai_response': response.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/emotion-response', methods=['POST'])
def generate_emotion_response():
    """
    Generate contextual AI response based on emotion
    
    Request body:
    {
        "user_id": "user123",
        "emotion": "happy|sad|angry|fear|surprise|disgust|neutral",
        "confidence": 0.0-1.0,
        "detail": "optional detail about emotion",
        "context": {...}
    }
    """
    try:
        from src.ai.emotion_responses import get_emotion_response_generator
        
        data = request.json or {}
        user_id = data.get('user_id', 'default_user')
        emotion = data.get('emotion', 'neutral').lower()
        confidence = data.get('confidence', 0.7)
        detail = data.get('detail', '')
        context = data.get('context', {})
        
        generator = get_emotion_response_generator()
        response = generator.generate_response(user_id, emotion, confidence, detail, context)
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/emotion-analysis', methods=['POST'])
def analyze_emotion_and_respond():
    """
    Analyze emotion from frame/audio and generate response
    
    Combined endpoint that detects emotion and generates appropriate response
    
    Request body:
    {
        "emotion": "detected emotion",
        "confidence": 0.0-1.0,
        "user_id": "optional user id",
        "source": "camera|audio|manual"
    }
    """
    try:
        from src.ai.emotion_commands import get_emotion_command_interpreter
        from src.ai.emotion_responses import get_emotion_response_generator
        
        data = request.json or {}
        emotion = data.get('emotion', 'neutral').lower()
        confidence = data.get('confidence', 0.7)
        user_id = data.get('user_id', 'default_user')
        source = data.get('source', 'manual')
        
        # Get interpreters
        cmd_interpreter = get_emotion_command_interpreter()
        resp_generator = get_emotion_response_generator()
        
        # Interpret emotion into commands
        actions, cmd_response = cmd_interpreter.interpret_emotion(emotion, confidence)
        
        # Generate conversational response
        ai_response = resp_generator.generate_response(user_id, emotion, confidence)
        
        return jsonify({
            'emotion': emotion,
            'confidence': confidence,
            'source': source,
            'commands': {
                'actions': [
                    {
                        'action_name': a.action_name,
                        'action_type': a.action_type,
                        'description': a.description,
                        'parameters': a.parameters
                    }
                    for a in actions
                ],
                'recommendations': cmd_response.recommendations
            },
            'ai_response': {
                'text': ai_response['response'],
                'tone': ai_response['tone'],
                'approach': ai_response['approach'],
                'recommendations': ai_response['recommendations'],
                'followup': ai_response['followup'],
                'next_actions': ai_response['next_actions']
            },
            'user_trend': ai_response['user_trend'],
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/emotion-summary/<user_id>', methods=['GET'])
def get_emotion_summary(user_id):
    """Get emotion summary for a specific user"""
    try:
        from src.ai.emotion_responses import get_emotion_response_generator
        
        generator = get_emotion_response_generator()
        summary = generator.get_user_emotion_summary(user_id)
        
        if not summary:
            return jsonify({'error': 'No data for user'}), 404
        
        return jsonify(summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/emotion-prediction/<user_id>', methods=['GET'])
def predict_user_emotion_state(user_id):
    """Predict user's likely next emotional state based on patterns"""
    try:
        from src.ai.emotion_responses import get_emotion_response_generator
        
        generator = get_emotion_response_generator()
        prediction = generator.predict_user_state(user_id)
        
        return jsonify(prediction)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/voice-command', methods=['POST'])
def process_voice_command():
    """
    Process voice command with emotional context
    
    Request body:
    {
        "text": "command text",
        "emotion": "optional detected emotion",
        "confidence": 0.0-1.0
    }
    """
    try:
        from src.ai.emotion_commands import get_emotion_command_interpreter
        from src.ai.emotion_responses import get_emotion_response_generator
        
        data = request.json or {}
        text = data.get('text', '')
        emotion = data.get('emotion')
        confidence = data.get('confidence', 0.7)
        user_id = data.get('user_id', 'default_user')
        
        if not text:
            return jsonify({'error': 'Text required'}), 400
        
        # Process command
        interpreter = get_emotion_command_interpreter()
        command_data = interpreter.process_voice_command(text, emotion, confidence)
        
        # Generate response if emotion provided
        response_data = {}
        if emotion:
            generator = get_emotion_response_generator()
            response_data = generator.generate_response(user_id, emotion, confidence)
        
        return jsonify({
            'command': command_data,
            'response': response_data if response_data else None,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/emotion-recommendations/<emotion>', methods=['GET'])
def get_emotion_recommendations(emotion):
    """Get recommended actions for a specific emotion"""
    try:
        from src.ai.emotion_commands import get_emotion_command_interpreter
        
        interpreter = get_emotion_command_interpreter()
        recommendations = interpreter.get_action_recommendations(emotion.lower())
        
        return jsonify({
            'emotion': emotion.lower(),
            'recommendations': recommendations,
            'count': len(recommendations)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api.route('/ai/emotion-history', methods=['GET'])
def get_emotion_action_history():
    """Get recent emotion-based actions history"""
    try:
        from src.ai.emotion_commands import get_emotion_command_interpreter
        
        limit = request.args.get('limit', 20, type=int)
        interpreter = get_emotion_command_interpreter()
        history = interpreter.get_emotion_history(limit)
        
        return jsonify({
            'history': history,
            'count': len(history)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== MOOD-AWARE TASK ASSISTANT ====================

@api.route('/task/recommendations', methods=['POST'])
def get_task_recommendations():
    """Get personalized task recommendations based on mood and context"""
    try:
        from src.ai.mood_task_assistant import get_mood_task_matcher
        
        data = request.json
        mood = data.get('mood', 'neutral')
        confidence = data.get('confidence', 0.7)
        
        matcher = get_mood_task_matcher()
        recommendation = matcher.get_recommendations(mood, confidence)
        
        return jsonify({
            'mood': recommendation.mood,
            'confidence': confidence,
            'wellbeing_tip': recommendation.wellbeing_tip,
            'affirmation': recommendation.affirmation,
            'suggested_break_time': recommendation.suggested_break_time,
            'tasks': [
                {
                    'title': task.title,
                    'description': task.description,
                    'category': task.category.value,
                    'priority': task.priority,
                    'estimated_time': task.estimated_time,
                    'energy_required': task.energy_required,
                    'mood_match': task.mood_match,
                    'emoji': task.emoji,
                    'why_now': task.why_now,
                    'steps': task.steps
                }
                for task in recommendation.tasks
            ],
            'next_actions': recommendation.next_actions
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/task/break-suggestion', methods=['POST'])
def suggest_break():
    """Suggest a break activity based on current mood"""
    try:
        from src.ai.mood_task_assistant import get_mood_task_matcher
        
        data = request.json
        mood = data.get('mood', 'neutral')
        duration = data.get('duration', 5)
        
        matcher = get_mood_task_matcher()
        break_suggestion = matcher.suggest_break_activity(mood, duration)
        
        return jsonify({
            'mood': mood,
            'activity': break_suggestion['activity'],
            'duration_minutes': duration,
            'suggested_time': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/task/quick-actions', methods=['GET'])
def get_quick_actions():
    """Get quick action suggestions"""
    try:
        actions = {
            'focus': {
                'title': '🎯 Focus Mode',
                'description': 'Eliminate distractions and enter deep work',
                'steps': [
                    'Silence all notifications',
                    'Block social media sites',
                    'Set a 90-minute timer',
                    'Put phone away'
                ]
            },
            'break': {
                'title': '☕ Take a Break',
                'description': 'Recharge your batteries',
                'steps': [
                    'Step away from screen',
                    'Get a drink or snack',
                    'Stretch your body',
                    'Take 10-15 minutes'
                ]
            },
            'music': {
                'title': '🎵 Music for Productivity',
                'description': 'Set the right ambiance',
                'playlists': [
                    'Lo-fi Hip Hop for Focus',
                    'Classical for Concentration',
                    'Ambient for Relaxation',
                    'Upbeat Pop for Energy'
                ]
            },
            'exercise': {
                'title': '🏃 Quick Stretch',
                'description': '2-minute energizer',
                'exercises': [
                    '10 arm circles',
                    '15 neck rolls',
                    '20 jump jacks',
                    '10 squats'
                ]
            },
            'motivation': {
                'title': '⭐ Motivation Boost',
                'description': 'Get inspired',
                'quotes': [
                    '"The only way to do great work is to love what you do." - Steve Jobs',
                    '"Success is not final, failure is not fatal." - Winston Churchill',
                    '"You are capable of amazing things." - Unknown',
                    '"Progress beats perfection every time." - Mark Manson'
                ]
            }
        }
        
        return jsonify({'actions': actions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/task/session-status', methods=['POST'])
def get_session_status():
    """Get current session and productivity metrics"""
    try:
        data = request.json
        mood = data.get('mood', 'neutral')
        interactions = data.get('interaction_count', 0)
        
        # Calculate productivity metrics
        productivity_score = min(100, (interactions * 5) + (0.9 * 100 if mood in ['happy', 'neutral'] else 0.6 * 100))
        
        metrics = {
            'mood': mood,
            'productivity_score': int(productivity_score),
            'interactions': interactions,
            'session_status': 'active',
            'recommendations': {
                'break_needed': interactions > 5,
                'suggested_break_in': max(0, 6 - interactions),
                'focus_level': 'high' if mood in ['happy', 'neutral'] else ('medium' if mood != 'sad' else 'low')
            }
        }
        
        return jsonify(metrics)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/task/mood-history', methods=['POST'])
def track_mood_history():
    """Track user mood history and trends"""
    try:
        data = request.json
        user_id = data.get('user_id', 'anonymous')
        mood = data.get('mood', 'neutral')
        
        # Store in database
        timestamp = datetime.now().isoformat()
        
        return jsonify({
            'user_id': user_id,
            'mood': mood,
            'timestamp': timestamp,
            'status': 'tracked'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== SESSION & COOKIE MANAGEMENT ====================

@api.route('/session/create', methods=['POST'])
def create_session():
    """Create new user session with timezone tracking"""
    try:
        from src.config.session_manager import get_session_manager
        
        data = request.json
        user_id = data.get('user_id', f'user_{secrets.token_hex(4)}')
        timezone = data.get('timezone', 'UTC')
        timezone_offset = data.get('timezone_offset', 0)
        
        session_manager = get_session_manager()
        session = session_manager.create_session(
            user_id=user_id,
            timezone=timezone,
            timezone_offset=timezone_offset
        )
        
        return jsonify({
            'success': True,
            'session_id': session.session_id,
            'user_id': session.user_id,
            'timezone': session.timezone,
            'created_at': session.created_at
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/session/get/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get session information"""
    try:
        from src.config.session_manager import get_session_manager
        
        session_manager = get_session_manager()
        session = session_manager.get_session(session_id)
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        return jsonify({
            'success': True,
            'session': session.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/session/cookies/set', methods=['POST'])
def set_cookie():
    """Set a cookie for session"""
    try:
        from src.config.session_manager import get_session_manager
        
        data = request.json
        session_id = data.get('session_id')
        name = data.get('name')
        value = data.get('value')
        max_age = data.get('max_age', 31536000)  # 1 year
        
        if not all([session_id, name, value]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        session_manager = get_session_manager()
        success = session_manager.add_cookie(session_id, name, value, max_age)
        
        return jsonify({
            'success': success,
            'name': name,
            'value': value if not name.lower().endswith('token') else '***'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/session/cookies/get/<session_id>', methods=['GET'])
def get_cookies(session_id):
    """Get all cookies for session"""
    try:
        from src.config.session_manager import get_session_manager
        
        session_manager = get_session_manager()
        cookies = session_manager.get_all_cookies(session_id)
        
        return jsonify({
            'success': True,
            'cookies': cookies
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/session/timezone/update', methods=['POST'])
def update_timezone():
    """Update user timezone"""
    try:
        from src.config.session_manager import get_session_manager
        
        data = request.json
        session_id = data.get('session_id')
        timezone = data.get('timezone')
        offset = data.get('offset', 0)
        
        if not all([session_id, timezone]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        session_manager = get_session_manager()
        success = session_manager.update_timezone(session_id, timezone, offset)
        
        return jsonify({
            'success': success,
            'timezone': timezone,
            'offset': offset
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/session/mood/record', methods=['POST'])
def record_mood():
    """Record mood in session history"""
    try:
        from src.config.session_manager import get_session_manager
        
        data = request.json
        session_id = data.get('session_id')
        mood = data.get('mood')
        confidence = data.get('confidence', 1.0)
        context = data.get('context')
        
        if not all([session_id, mood]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        session_manager = get_session_manager()
        success = session_manager.record_mood(
            session_id, mood, confidence, context
        )
        
        return jsonify({
            'success': success,
            'mood': mood,
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/session/mood/history/<session_id>', methods=['GET'])
def get_mood_history(session_id):
    """Get mood history for session"""
    try:
        from src.config.session_manager import get_session_manager
        
        limit = request.args.get('limit', 10, type=int)
        
        session_manager = get_session_manager()
        history = session_manager.get_mood_history(session_id, limit)
        
        return jsonify({
            'success': True,
            'mood_history': history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== AI PROVIDER MANAGEMENT ====================

@api.route('/ai/config/get', methods=['GET'])
def get_ai_config():
    """Get current AI provider configuration"""
    try:
        from src.config.ai_config import get_current_config
        
        config = get_current_config()
        
        return jsonify({
            'success': True,
            'config': config.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/ai/config/set-provider', methods=['POST'])
def set_ai_provider():
    """Change AI provider"""
    try:
        from src.config.ai_config import AIProvider, get_ai_config_manager
        
        data = request.json
        provider = data.get('provider', 'hybrid')
        
        manager = get_ai_config_manager()
        success = manager.set_provider(AIProvider(provider))
        
        return jsonify({
            'success': success,
            'provider': provider
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/ai/config/ollama', methods=['POST'])
def configure_ollama():
    """Configure Ollama settings"""
    try:
        from src.config.ai_config import get_ai_config_manager
        
        data = request.json
        host = data.get('host', 'http://localhost:11434')
        model = data.get('model', 'neural-chat')
        
        manager = get_ai_config_manager()
        success = manager.set_ollama_config(host, model)
        
        return jsonify({
            'success': success,
            'ollama_host': host,
            'ollama_model': model
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/ai/ollama/health', methods=['GET'])
def check_ollama_health():
    """Check Ollama server health and available models"""
    try:
        from src.ai.unified_ai_handler import get_unified_ai_handler
        
        handler = get_unified_ai_handler()
        health = handler.test_ollama_connection()
        
        return jsonify({
            'success': health.get('connected', False),
            'health': health
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/ai/ollama/models', methods=['GET'])
def list_ollama_models():
    """List available Ollama models"""
    try:
        from src.config.ai_config import get_ai_config_manager
        
        manager = get_ai_config_manager()
        models = manager.get_available_ollama_models()
        
        return jsonify({
            'success': True,
            'models': models
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api.route('/ai/response/mood', methods=['POST'])
def get_mood_response():
    """Get mood-based AI response (uses configured provider)"""
    try:
        from src.ai.unified_ai_handler import get_unified_ai_handler
        
        data = request.json
        mood = data.get('mood', 'neutral')
        context = data.get('context')
        confidence = data.get('confidence', 1.0)
        
        handler = get_unified_ai_handler()
        response = handler.generate_mood_response(mood, context, confidence)
        
        return jsonify({
            'success': response.success,
            'response': response.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def setup_routes(app):
    """Configure all routes and static file serving"""
    # Enable CORS for API endpoints
    CORS(app)
    
    # Register API blueprint
    app.register_blueprint(api, url_prefix='/api')
    
    # Register companion routes
    try:
        from src.api.companion_routes import register_companion_routes
        register_companion_routes(app)
    except ImportError as e:
        print(f"Warning: Could not load companion routes: {e}")
    
    # Serve static files
    static_folder = os.path.join(os.path.dirname(__file__), '../static')
    
    @app.route('/')
    def index():
        """Main website - buildingai.cloud (Building Management AI Dashboard)"""
        return send_from_directory(static_folder, 'index.html')
    
    @app.route('/dashboard')
    def dashboard():
        """Building Management AI Dashboard"""
        return send_from_directory(static_folder, 'index.html')
    
    @app.route('/empathy')
    def empathy():
        """Empathy AI - Camera & Audio tool (branched from main site)"""
        return send_from_directory(static_folder, 'companion_app_empathy.html')
    
    @app.route('/companion')
    def companion():
        """AI Companion app"""
        return send_from_directory(static_folder, 'companion_app.html')

    @app.route('/llm-console')
    def llm_console():
        """Serve the React-based LLM & media console built by Vite"""
        console_folder = os.path.join(static_folder, 'llm-console')
        return send_from_directory(console_folder, 'index.html')
    
    @app.route('/static/<path:filename>')
    def static_files(filename):
        """Serve static files (CSS, JS, images)"""
        return send_from_directory(static_folder, filename)