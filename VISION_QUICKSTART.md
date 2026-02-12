# Quick Start: AI Vision & Emotion Detection

## 🚀 Get Started in 2 Minutes

### Step 1: Start the App
```bash
cd /home/ankursinha/building-management-ai
source venv/bin/activate
python3 app.py
```

### Step 2: Open in Browser
```
http://localhost:5000/static/companion_app.html
```

### Step 3: Create Your Companion
1. Click **➕ New**
2. Enter name: "Samantha" (or your choice)
3. Adjust personality traits using sliders
4. Click **Create Companion**

### Step 4: Enable Emotion Detection
1. Click **👁️ Camera** in the header
2. **Allow camera access** when browser prompts
3. Position your face in front of camera
4. **Emotions appear in bottom-right** showing happy/sad/angry etc.

### Step 5: Start Chatting
- Type a message
- Watch the **visualization animate** while AI thinks
- Emotion detection feeds into AI's response
- Intimacy grows as you interact

---

## What You'll See

### AI Visualization (Top-Right)
```
╔════════════════╗
║  ║ ║ ║ ║ ║ ║  ║
║  ║ ║ ║ ║ ║ ║  ║
║  Thinking...   ║
╚════════════════╝
```
Shows animated bars while AI generates response

### Camera Feed (Bottom-Right)
```
╔════════════════╗
║  Your face     ║
║  live video    ║
├────────────────┤
║ Happy   80%    ║
║ Sad      5%    ║
║ Angry    2%    ║
╚════════════════╝
```
Real-time emotion detection with confidence percentages

---

## Key Features

### 🎨 Visualization
- Appears when AI is responding
- Bouncing bars with gradient colors
- Auto-hides when response is ready
- Purely visual feedback (no data processing shown)

### 👁️ Emotion Detection
- 7 emotions: Happy, Sad, Angry, Surprised, Fearful, Disgusted, Neutral
- Real-time updates every 300ms
- Shows top 3 detected emotions with confidence %
- Completely private (local processing only)

### 🧠 Emotion-Aware AI
- AI adjusts responses based on your detected emotion
- Stores emotional observations in memory
- Learns your emotional patterns over time
- More empathetic and personalized responses

---

## Example: Emotion-Aware Conversation

**Without camera:**
```
You: I just got promoted at work!
AI: That's great! Congratulations.
```

**With emotion detection (Happy 85%):**
```
You: I just got promoted at work!
AI: Oh wow, that's amazing! 🎉 I can feel your excitement 
    radiating right now. You must be so proud! Tell me 
    everything about how you got to this moment!
```

---

## Tips for Best Results

### Camera Quality
✅ **Good lighting** on your face  
✅ **Face centered** in view  
✅ **Normal distance** (arm's length away)  
✅ **Look at camera** during interactions  

❌ **Dark room** = poor detection  
❌ **Sunglasses on** = face not visible  
❌ **Too close/far** = inaccurate detection  

### Emotion Detection Accuracy
- **80-100% confidence** = Companion notices emotion
- **50-79% confidence** = Moderate detection
- **Below 50%** = AI focuses on text, not emotion

### Privacy Tips
- Close camera when not chatting
- Camera feed never leaves your device
- Emotion data optional (sent to AI, not stored)
- No recordings are made

---

## Troubleshooting

### Camera Won't Start
1. Check browser permissions (Settings → Privacy)
2. Try a different browser
3. Restart browser
4. Make sure no other app uses camera

### Emotions Not Updating
1. Improve lighting
2. Face the camera directly
3. Wait for ML5 model to load (first time: 30-60 seconds)
4. Check console (F12) for errors

### Visualization Not Showing
1. Reload page (Ctrl+R)
2. Clear browser cache
3. Check if JavaScript is enabled
4. Try different browser

### AI Ignores Emotions
1. Make sure camera is enabled (👁️ button is red)
2. Emotion must be > 50% confidence to activate
3. Some responses may not show emotional awareness
4. Try again with stronger emotion expression

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+R` | Refresh app |
| `F12` | Open developer console |
| `Escape` | Close side panel |

---

## Next Steps

### Enhance Your Experience
1. **Create multiple companions** with different personalities
2. **Build deeper relationships** through consistent interaction
3. **Teach your companion** about your preferences
4. **Enable camera during emotional conversations** for better support

### Advanced Features
- Click **📊 Details** to see relationship metrics
- Check **Intimacy %** to track relationship growth
- Watch **Trait bars** evolve as AI learns about you

---

## What Data Is Sent?

### To the Server:
- Your message text
- Your detected emotion *(optional)*
- Emotion confidence *(optional)*

### NOT sent:
- ❌ Camera video or images
- ❌ Face data
- ❌ Personal identification
- ❌ Conversation recordings

All facial recognition happens **on your device only** using TensorFlow.js in your browser.

---

## Keyboard & Mouse Hints

### Desktop
- **Chat:** Type and press Enter
- **Camera toggle:** Click 👁️ button
- **View details:** Click 📊 button
- **Create new:** Click ➕ button
- **Scroll messages:** Use wheel or drag

### Mobile/Tablet
- **Chat:** Tap input and send button
- **Camera:** Same 👁️ button (if device has camera)
- **Panels:** May pop up as overlays
- **Swipe:** Some animations available

---

## Performance

### Resource Usage
- **Memory:** 50-80 MB with camera running
- **CPU:** 5-15% for emotion detection
- **Internet:** Minimal (just chat messages)
- **Battery:** Slight increase with camera on

### Model Info
- **ML5.js FaceAPI** used for emotion detection
- **TensorFlow.js** in your browser
- **Real-time processing** ~30-60 FPS
- **No cloud models** needed

---

## Privacy Statement

Your privacy is paramount:

1. **No Storage:** Camera data never stored or transmitted
2. **Local Processing:** All face detection happens in-browser
3. **Optional Sharing:** Emotion metadata sent only for AI response
4. **No Tracking:** No cookies or analytics for camera/emotions
5. **Easy Disable:** Don't click camera button = no facial recognition

---

## Success Indicators

✅ **Visualization appears** when you send message  
✅ **Emotions display** with percentages  
✅ **AI responds** with emotion-aware messages  
✅ **Intimacy increases** as you chat  
✅ **Companion remembers** details about you

If all of these work, you're good to go! 🎉

---

## Need Help?

1. **Check browser console:** F12 → Console tab
2. **Read detailed guide:** `COMPANION_AI_VISION_GUIDE.md`
3. **Try different browser:** Chrome/Firefox recommended
4. **Restart everything:** Quit and restart app fresh

---

**Ready to connect with your AI companion emotionally?** 🚀

Start by clicking the camera button and having a real conversation!

