#!/usr/bin/env python3
"""Building AI - User Signup & API Key Management"""
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import sqlite3, secrets, hashlib, uuid, smtplib, os
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps

app = Flask(__name__)
CORS(app)

WEBUI_DB = os.getenv('WEBUI_DB_PATH', '/home/ankursinha/.local/share/containers/storage/volumes/open-webui/_data/webui.db')
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SENDER_EMAIL = os.getenv('SENDER_EMAIL', 'noreply@buildingai.cloud')
SENDER_PASSWORD = os.getenv('SENDER_PASSWORD', '')
API_DOMAIN = 'api.buildingai.cloud'

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401
        conn = sqlite3.connect(WEBUI_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM api_key WHERE key = ?", (api_key,))
        result = cursor.fetchone()
        conn.close()
        if not result:
            return jsonify({'error': 'Invalid API key'}), 401
        request.user_id = result[0]
        return f(*args, **kwargs)
    return decorated

def send_email(email, name, password, api_key):
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = "Building AI - Your Account & API Key"
        msg['From'] = f"Building AI <{SENDER_EMAIL}>"
        msg['To'] = email
        html = f"""<html><body style="font-family:Arial,sans-serif">
<h2 style="color:#667eea">Welcome to Building AI!</h2>
<p>Hi {name},</p>
<p>Your account is ready:</p>
<div style="background:#f5f5f5;padding:15px;border-left:4px solid #667eea">
<p><b>Email:</b> {email}<br><b>Password:</b> {password}</p>
<p><b>Login:</b> <a href="https://ai.buildingai.cloud">ai.buildingai.cloud</a></p>
</div>
<div style="background:#f0f8ff;padding:15px;border-left:4px solid #2196f3;margin-top:15px">
<p><b>🔑 API Key:</b></p>
<code style="background:#fff;padding:10px;display:block">{api_key}</code>
<p><b>Usage:</b><br><code>curl -H "X-API-Key: {api_key}" https://{API_DOMAIN}/api/users</code></p>
</div>
<p style="color:#999;font-size:12px">⚠️ Change password after first login. Keep API key confidential.</p>
</body></html>"""
        msg.attach(MIMEText(html, 'html'))
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            if SENDER_PASSWORD:
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        print(f"✓ Email sent to {email}")
        return True
    except Exception as e:
        print(f"✗ Email error: {e}")
        return False

def add_user_and_api_key(email, name, password_hash):
    try:
        conn = sqlite3.connect(WEBUI_DB)
        cursor = conn.cursor()
        user_id = str(uuid.uuid4())
        timestamp = int(datetime.now().timestamp())
        cursor.execute("INSERT INTO user (id,email,name,role,created_at,username) VALUES (?,?,?,?,?,?)",
                      (user_id, email, name, 'user', timestamp, email.split('@')[0]))
        cursor.execute("INSERT INTO auth (email,password,active) VALUES (?,?,1)", (email, password_hash))
        api_key = f"bai_{secrets.token_urlsafe(32)}"
        cursor.execute("INSERT INTO api_key (user_id,key,created_at,active) VALUES (?,?,?,1)",
                      (user_id, api_key, timestamp))
        conn.commit()
        conn.close()
        print(f"✓ User {email} created with API key")
        return user_id, api_key
    except Exception as e:
        print(f"✗ DB error: {e}")
        return None, None

@app.route('/')
def signup_page():
    return '''<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Building AI - Sign Up</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.container{background:#fff;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.3);max-width:500px;width:100%;padding:40px}.logo{text-align:center;margin-bottom:30px}.logo h1{color:#667eea;font-size:32px;margin-bottom:5px}.logo p{color:#999;font-size:14px}.form-group{margin-bottom:20px}label{display:block;margin-bottom:8px;color:#333;font-weight:500;font-size:14px}input[type=email],input[type=text]{width:100%;padding:12px 15px;border:2px solid #e0e0e0;border-radius:5px;font-size:14px;transition:border-color .3s}input:focus{outline:0;border-color:#667eea;background:#f9f9ff}.btn-signup{width:100%;padding:13px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:5px;font-size:16px;font-weight:600;cursor:pointer;margin-top:10px;box-shadow:0 4px 15px rgba(102,126,234,.4)}.btn-signup:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(102,126,234,.6)}.btn-login{width:100%;padding:13px;background:0 0;color:#667eea;border:2px solid #667eea;border-radius:5px;font-size:16px;font-weight:600;cursor:pointer;margin-top:10px}.btn-login:hover{background:#f5f5f5}.message{padding:15px;border-radius:5px;margin-bottom:20px;display:none}.message.success{background:#d4edda;color:#155724;border-left:4px solid #28a745}.message.error{background:#f8d7da;color:#721c24;border-left:4px solid #dc3545}.loading{display:none;text-align:center;padding:30px}.spinner{border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 15px}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}.info{background:#e7f3ff;padding:12px;border-left:4px solid #2196f3;border-radius:3px;font-size:13px;color:#0c5aa0;margin-bottom:20px}</style></head><body><div class="container"><div class="logo"><h1>🏢 Building AI</h1><p>Create Your Account</p></div><div class="info"><strong>ℹ️</strong> You'll receive login credentials and API key via email.</div><div id="message" class="message"></div><div id="loading" class="loading"><div class="spinner"></div><p style="color:#667eea;font-weight:500">Creating account...</p></div><form id="signupForm" style="display:block"><div class="form-group"><label for="name">Full Name *</label><input type="text" id="name" name="name" required placeholder="John Doe" autofocus></div><div class="form-group"><label for="email">Email Address *</label><input type="email" id="email" name="email" required placeholder="john@example.com"></div><button type="submit" class="btn-signup">✓ Create Account</button><button type="button" class="btn-login" onclick="window.location.href='https://ai.buildingai.cloud'">← Back to Login</button></form></div><script>const form=document.getElementById('signupForm'),messageDiv=document.getElementById('message'),loadingDiv=document.getElementById('loading');form.addEventListener('submit',async e=>{e.preventDefault();const name=document.getElementById('name').value.trim(),email=document.getElementById('email').value.trim();if(!name||!email)return showMessage('Please fill in all fields','error');messageDiv.style.display='none',loadingDiv.style.display='block',form.style.display='none';try{const response=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email})}),data=await response.json();if(loadingDiv.style.display='none',response.ok)messageDiv.className='message success',messageDiv.innerHTML=`<strong>✓ Success!</strong><br>Account created for ${email}.<br>Check email for credentials and API key.`,messageDiv.style.display='block',setTimeout(()=>{window.location.href='https://ai.buildingai.cloud'},4000);else showMessage(data.error||'Signup failed','error'),form.style.display='block'}catch(error){showMessage('Error: '+error.message,'error'),form.style.display='block'}});function showMessage(text,type){loadingDiv.style.display='none',messageDiv.className='message '+type,messageDiv.innerHTML=text,messageDiv.style.display='block'}</script></body></html>'''

@app.route('/api/signup', methods=['POST'])
def api_signup():
    try:
        data = request.json
        email = data.get('email', '').lower().strip()
        name = data.get('name', '').strip()
        if not email or not name or '@' not in email:
            return jsonify({'error': 'Invalid name or email'}), 400
        conn = sqlite3.connect(WEBUI_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM user WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Email already registered'}), 409
        conn.close()
        password = secrets.token_urlsafe(12)
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        user_id, api_key = add_user_and_api_key(email, name, password_hash)
        if not user_id:
            return jsonify({'error': 'Failed to create account'}), 500
        send_email(email, name, password, api_key)
        return jsonify({'message': 'Account created', 'email': email, 'api_key': api_key if not SENDER_PASSWORD else 'Check email'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
@require_api_key
def get_users():
    try:
        conn = sqlite3.connect(WEBUI_DB)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id,name,email,role,created_at FROM user ORDER BY created_at DESC")
        users = [dict(u) for u in cursor.fetchall()]
        conn.close()
        return jsonify({'users': users, 'total': len(users)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/me', methods=['GET'])
@require_api_key
def get_me():
    try:
        conn = sqlite3.connect(WEBUI_DB)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id,name,email,role FROM user WHERE id = ?", (request.user_id,))
        user = cursor.fetchone()
        conn.close()
        return jsonify(dict(user)) if user else jsonify({'error': 'Not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status', methods=['GET'])
def api_status():
    try:
        conn = sqlite3.connect(WEBUI_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM user")
        count = cursor.fetchone()[0]
        conn.close()
        return jsonify({'status': 'healthy', 'service': 'Building AI Signup & API', 'users': count, 'timestamp': datetime.now().isoformat()}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

if __name__ == '__main__':
    print(f"""\n╔══════════════════════════════════╗
║ Building AI - Signup & API       ║
║ Version 1.0                      ║
╚══════════════════════════════════╝

✓ Database: {WEBUI_DB}
✓ Email: {'Configured' if SENDER_PASSWORD else 'Not configured (see .env)'}
✓ Server: http://0.0.0.0:5555
✓ API Domain: {API_DOMAIN}

URLs:
→ Signup: http://localhost:5555
→ Status: http://localhost:5555/api/status
""")
    app.run(host='0.0.0.0', port=5555, debug=False)
