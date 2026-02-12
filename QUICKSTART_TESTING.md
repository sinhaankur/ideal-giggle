# Quick Start Guide - Testing the Mood Assistant with Private AI

## What Has Been Built

A complete mood-aware task assistant with:
- ✅ Mobile-first single-screen interface with 4 tabs
- ✅ Session management with timezone tracking
- ✅ Mood history restoration
- ✅ Private AI via local Ollama
- ✅ Cloud API fallback support
- ✅ Beautiful settings interface
- ✅ 15+ REST API endpoints

## Prerequisites

```bash
# 1. Python 3.8+ is installed
python3 --version

# 2. All dependencies installed (from requirements.txt)
pip install -r requirements.txt

# 3. Optional: Podman for running Ollama (or Docker)
podman --version
```

## Steps to Run

### Step 1: Start the Flask Backend

```bash
cd /home/ankursinha/building-management-ai

# Start the Flask app
python3 app.py
```

**Expected Output:**
```
    ╔═══════════════════════════════════════════════════════╗
    ║  Building Management AI Dashboard & AI Client         ║
    ║                                                       ║
    ║  🌐 Server running on:                                ║
    ║     http://localhost:5000                             ║
```

### Step 2: Open the Dashboard in Browser

Navigate to: **http://localhost:5000/static/mood_task_assistant.html**

**What You Should See:**
- Header: "🧠 Mood Assistant" with ⚙️ settings button
- 4 Navigation Tabs: Mood, Tasks, Chat, Actions
- Mood tab: 6 mood cards (Happy, Sad, Angry, Fear, Surprise, Neutral)
- Currently selected tab indicator

### Step 3: Test Session Creation

1. Open browser DevTools (F12)
2. Go to Application > LocalStorage > http://localhost:5000
3. Look for key: `sessionId`
4. Should see session ID automatically created

**Expected LocalStorage:**
```json
{
  "sessionId": "session_xxxxx"
}
```

### Step 4: Test Mood Selection

1. Click any mood card (e.g., "Happy" 😊)
2. Watch the console for API calls:
   - `POST /api/session/mood/record` should succeed
   - Chat should display: "I'm feeling happy today 😊"
3. Tab should auto-switch to "Tasks"
4. Task recommendations should appear

### Step 5: Test Chat Interface

1. Click "Chat" tab
2. Type a message: "What should I do now?"
3. Click send button (↑ or press Enter)
4. Wait for response (5-30 seconds depending on Ollama availability)
5. If Ollama not running, should get fallback emotion-based response

### Step 6: Test Settings Page

1. Click ⚙️ settings button in header
2. You should see:
   - Session ID display
   - Timezone auto-detection
   - AI provider selection (Local, Hybrid, Cloud)
   - Ollama configuration section
   - Privacy controls
3. Try selecting different providers
4. Click "Test Ollama Connection" (will show ❌ until Ollama is running)

### Step 7: Optional - Run Ollama (for Local AI)

If you have Podman/Docker installed:

```bash
# In a separate terminal
podman run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama \
  docker.io/ollama/ollama:latest
```

Or use the workspace task:
```bash
# From VS Code, run the "podman: start ollama" task
```

Then in settings page, click "Test Connection" - should show ✅

## API Testing with cURL

### Test Session Creation

```bash
curl -X POST http://localhost:5000/api/session/create \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York",
    "timezone_offset": -300
  }' | jq
```

**Expected Response:**
```json
{
  "success": true,
  "session_id": "session_xxxxx",
  "timezone": "America/New_York",
  "timezone_offset": -300
}
```

### Test Recording a Mood

```bash
SESSION_ID="session_xxxxx"  # Replace with actual session ID

curl -X POST http://localhost:5000/api/session/mood/record \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "'$SESSION_ID'",
    "mood": "happy",
    "confidence": 1.0,
    "context": "manual_selection"
  }' | jq
```

### Test Getting Mood History

```bash
curl http://localhost:5000/api/session/mood/history/$SESSION_ID | jq
```

### Test Getting AI Response

```bash
curl -X POST http://localhost:5000/api/ai/response/mood \
  -H "Content-Type: application/json" \
  -d '{
    "mood": "happy",
    "context": "What should I do next?",
    "confidence": 1.0
  }' | jq
```

## Checking Server Logs

Watch Flask logs for debugging:
```bash
# In the Flask terminal, you should see:
# - POST /api/session/create logs
# - POST /api/session/mood/record logs
# - POST /ai/response/mood logs
# etc.
```

## Testing Checklist

- [ ] Flask app starts without errors
- [ ] Dashboard loads at http://localhost:5000/static/mood_task_assistant.html
- [ ] Session ID created automatically (check LocalStorage)
- [ ] Can select mood cards
- [ ] Task recommendations appear after mood selection
- [ ] Chat interface sends and receives messages
- [ ] Settings page loads via ⚙️ button
- [ ] Settings page shows timezone detection
- [ ] Each endpoint returns valid JSON responses
- [ ] Fallback responses work (if Ollama unavailable)

## Browser Console Debugging

### Check for Errors
```javascript
// Press F12, then in Console tab:

// Check if session ID exists
localStorage.getItem('sessionId')

// Check API_BASE constant
console.log(API_BASE)

// Manually test session creation
fetch('/api/session/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timezone: 'UTC', timezone_offset: 0 })
}).then(r => r.json()).then(console.log)
```

## Troubleshooting Common Issues

### Issue: Flask app won't start
```bash
# Check if port 5000 is in use
lsof -i :5000

# If it is, kill the process
pkill -f "python.*app.py"

# Or use different port
PORT=8000 python3 app.py
```

### Issue: CORS errors in console
- Flask-CORS should handle this automatically
- Check that `Flask-CORS==4.0.0` is installed
- See `src/api/routes.py` for CORS configuration

### Issue: Setting buttons don't work
- Check browser console (F12) for JavaScript errors
- Verify Flask is serving static files
- Make sure session is initialized first

### Issue: Chat returns no response
- Check `/api/ai/response/mood` endpoint
- If Ollama not running: fallback response should appear (emotion AI)
- Check server logs for error details

### Issue: Ollama health check fails
- Make sure Ollama container is running: `podman ps`
- Default Ollama port is 11434
- In settings page, try updating Ollama host to `http://localhost:11434`
- Then click "Test Connection" again

## Performance Expectations

- **First Page Load**: 1-2 seconds
- **Session Creation**: 200-300ms
- **Mood Selection**: <100ms (instant UI feedback)
- **Chat Response** (if Ollama running): 2-10 seconds
- **Chat Response** (Cloud API): 0.5-2 seconds
- **Chat Response** (Fallback): <100ms

## Files You Should See

### Frontend Files
- ✅ `/static/mood_task_assistant.html` (main dashboard)
- ✅ `/static/ai_settings.html` (settings page)
- ✅ `/static/styles.css` (styles)
- ✅ `/static/chat.css` (chat styles)

### Backend Files
- ✅ `/src/api/routes.py` (15+ endpoints)
- ✅ `/src/ai/ollama_client.py` (Ollama integration)
- ✅ `/src/ai/unified_ai_handler.py` (AI orchestration)
- ✅ `/src/config/ai_config.py` (AI configuration)
- ✅ `/src/config/session_manager.py` (session management)

### Data Files (created when running)
- 🔄 `.ai_config.json` (AI provider configuration)
- 🔄 `.sessions/` directory (user session data)

## Next Steps to Enhance

1. **Add Model Selection**: Download other Ollama models
2. **Customize Prompts**: Edit mood-specific system prompts
3. **Add Analytics**: Track mood trends and AI response quality
4. **Expand Quick Actions**: Add more action types (meditate, exercise, etc.)
5. **Integrate Calendar**: Link tasks to calendar events
6. **Add Voice Input**: Use browser speech API
7. **Push Notifications**: Remind users to check mood

## Summary

You now have:
1. ✅ Full session management system
2. ✅ Mood tracking with history
3. ✅ Beautiful mobile-first UI
4. ✅ Private AI with Ollama support
5. ✅ Cloud API fallback
6. ✅ Real-time chat interface
7. ✅ Settings management page

Everything is integrated and ready to use. Start the Flask app and open the dashboard to begin testing!

**Questions or Issues?** Check the console logs and browser DevTools for detailed error messages.
