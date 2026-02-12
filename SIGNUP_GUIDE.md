# Building AI - User Signup & API System

## ✅ System Status

Your user signup system with API key generation is now **LIVE**!

### 🌐 Public URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **User Signup** | https://signup.buildingai.cloud | Create new accounts |
| **Open WebUI** | https://ai.buildingai.cloud | Login and chat interface |
| **API Endpoint** | https://api.buildingai.cloud | Ollama LLM API |

### 🔧 Local URLs

- Signup Server: http://localhost:5555
- API Status: http://localhost:5555/api/status
- Open WebUI: http://localhost:3001

## 📝 How It Works

### For New Users

1. Visit **https://signup.buildingai.cloud**
2. Enter full name and email
3. Receive email with:
   - Default password
   - Personal API key (format: `bai_xxxxx`)
4. Login at **https://ai.buildingai.cloud**
5. Change password on first login

### API Key Features

- Each user gets a unique API key on signup
- API keys enable remote programmatic access
- Keys are sent via email for security
- Keys can be used with HTTP headers or query parameters

## 🔑 Using API Keys

### Method 1: Header Authentication (Recommended)
```bash
curl -X GET "https://api.buildingai.cloud/api/users" \
  -H "X-API-Key: bai_your_api_key_here"
```

### Method 2: Query Parameter
```bash
curl -X GET "https://api.buildingai.cloud/api/users?api_key=bai_your_api_key_here"
```

## 📡 Available API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Create new user account |
| GET | `/api/status` | Check service health |

### Protected Endpoints (Require API Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all registered users |
| GET | `/api/me` | Get current authenticated user info |

## 🔒 Email Configuration

To enable automatic email sending, configure these environment variables:

```bash
# Edit ~/.bashrc or create .env file
export SMTP_SERVER="smtp.gmail.com"
export SMTP_PORT="587"
export SENDER_EMAIL="your-email@gmail.com"
export SENDER_PASSWORD="your-app-password"  # Use App Password, not regular password
```

### Gmail App Password Setup

1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Generate App Password for "Mail"
4. Use generated password in SENDER_PASSWORD

## 🚀 Server Management

### Start Signup Server
```bash
cd /home/ankursinha/building-management-ai
python3 signup_server.py
```

### Stop Signup Server
```bash
kill $(cat /tmp/signup_server.pid)
```

### Check Status
```bash
curl http://localhost:5555/api/status
```

### View Logs
```bash
tail -f /tmp/signup_server.log
```

## 🧪 Testing the System

### Test Signup (without email)
```bash
curl -X POST http://localhost:5555/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'
```

### Test API Key Authentication
```bash
# Replace with your actual API key
curl -H "X-API-Key: bai_xxxxx" http://localhost:5555/api/users
```

## 🗄️ Database Location

Open WebUI Database:
```
/home/ankursinha/.local/share/containers/storage/volumes/open-webui/_data/webui.db
```

### Query Users Directly
```bash
sqlite3 ~/.local/share/containers/storage/volumes/open-webui/_data/webui.db \
  "SELECT id, name, email, role FROM user;"
```

### Query API Keys
```bash
sqlite3 ~/.local/share/containers/storage/volumes/open-webui/_data/webui.db \
  "SELECT user_id, key, created_at FROM api_key;"
```

## 🔍 Troubleshooting

### Signup server not accessible
```bash
# Check if running
ps aux | grep signup_server

# Restart
python3 /home/ankursinha/building-management-ai/signup_server.py &
```

### Email not sending
- Verify SMTP credentials are set
- Check Gmail App Password is correct
- View server logs for email errors

### API key not working
- Verify key format: `bai_xxxxx`
- Check user exists in database
- Ensure key header is correct: `X-API-Key`

### Tunnel not routing
```bash
# Restart Cloudflare tunnel
docker restart cloudflared

# Check tunnel status
docker logs cloudflared
```

## 📊 Current Database Stats

Run this to see current users:
```bash
python3 << 'PYEOF'
import sqlite3
conn = sqlite3.connect('/home/ankursinha/.local/share/containers/storage/volumes/open-webui/_data/webui.db')
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM user")
print(f"Total users: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM api_key")
print(f"Total API keys: {cursor.fetchone()[0]}")
conn.close()
PYEOF
```

## 🎯 Next Steps

1. **Configure Email** - Set up Gmail App Password for automatic email delivery
2. **Test Signup** - Create a test account at https://signup.buildingai.cloud
3. **Share Link** - Send signup URL to users who need access
4. **Monitor** - Check `/api/status` endpoint regularly
5. **Backup** - Regularly backup the webui.db database

## 📧 Support

For issues or questions, contact: **admin@buildingai.cloud**

---

**Created:** February 11, 2026  
**Server Version:** 1.0  
**Status:** ✅ Running
