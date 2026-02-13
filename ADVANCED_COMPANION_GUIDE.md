# Advanced Companion App - Feature Guide

## Overview
The advanced companion app (`/advanced`) provides a sophisticated emotional AI interface with real-time visualization, story tracking, and emotional paradigm monitoring.

## Three-Panel Layout

### LEFT PANEL: Emotional Paradigm
**Purpose:** Visual comparison of human emotions vs AI-detected emotions

**Features:**
- **5 Key Emotions Tracked:**
  - 😊 HAPPY (0-100%)
  - 😢 SAD (0-100%)
  - 😠 ANGRY (0-100%)
  - 😨 FEAR (0-100%)
  - 😐 NEUTRAL (0-100%)

- **Dual Bars for Each Emotion:**
  - **Orange Bar (Left):** Your detected emotion
  - **Green Bar (Right):** AI detected emotion
  - Heights show confidence percentage
  - Side-by-side comparison shows emotional alignment

- **Story Timeline:**
  - Last 20 conversation turns recorded
  - Shows timestamp (HH:MM format)
  - Shows date
  - Shows preview of user message
  - Shows dominant emotion for that turn
  - Click any story node to view full conversation context

**Interaction:**
- Hover over paradigm section for emphasis
- Emotional bars update in real-time as you chat
- Story nodes are clickable for detailed replay

---

### CENTER PANEL: Chat & Visualization

#### XYZ Axis Visualization (Top)
**Purpose:** Real-time 3D representation of conversation state

**Axes:**
- **X-Axis (Red):** Conversation evolution (messages sent)
- **Y-Axis (Green):** Context depth (conversation history length)
- **Z-Axis (Blue):** Emotional intensity (current emotion strength 0-100)

**Coordinates Displayed:**
- Live point shows: `[Message Count, History Length, Emotion Intensity]`
- Point traces path through emotional 3D space as conversation progresses

**Visual Meaning:**
- Point moving right = More messages being sent
- Point moving up = Deeper conversation context
- Point moving forward/back = Emotional intensity changes

#### Chat Area (Middle & Bottom)
**Standard chat interface:**
- User messages appear on right (dark green background)
- AI responses appear on left (gray background)
- Timestamps show HH:MM for each message
- Scrollable history

**Input Field:**
- Text input at bottom with green border
- Type message and press Enter or click SEND
- Auto-detects emotion from keywords

**Emotion Auto-Detection:**
- System scans your messages for emotion keywords
- Recognizes: happy, sad, angry, scared, excited, etc.
- Feeds detected emotion to AI for context-aware responses

---

### RIGHT PANEL: Camera Feed & Status

#### Camera Feed Box (Top)
- **400x300px live camera preview**
- Shows browser-based camera stream
- Click CAMERA button to enable full monitoring
- Automatically requests camera permissions on load
- Falls back to "📹 Camera unavailable" if denied

#### Status Sections

**AI MODEL:**
- Dropdown selector with all available Ollama models
- Change in real-time without restarting
- Selection persists in companion profile
- Current: llama3.1:8b, llama3.2:latest, qwen2.5-coder:1.5b-base, nomic-embed-text

**DETECTED EMOTION:**
- Shows AI's detected emotion from last message
- Updates after each response (happy/sad/angry/fear/neutral/surprised/disgust)

**AI STATE:**
- Currently shows model being used
- Can be extended to show other state info

**LOCATION:**
- GPS coordinates when available
- Shows "📍 Requesting..." initially
- Shows "📍 Denied" if permission refused
- Clickable to request/refresh geolocation

**CONVERSATION:**
- Message count (user messages sent)
- Token count (approximate usage estimate)
- Updates in real-time

---

## Story Nodes System

### What Are Story Nodes?
Story nodes are timestamped snapshots of your conversation, capturing:
- **Time:** HH:MM format
- **Date:** MM/DD/YYYY
- **Your Message:** First 30 characters + preview
- **User Emotion:** Detected emotion at that moment
- **Full Context:** Click to see complete exchange

### Node Lifecycle
1. **Created:** When you send any message
2. **Recorded:** Automatically added to timeline on left panel
3. **Stored:** In-memory store (up to 20 most recent)
4. **Displayed:** Reverse chronological in STORY TIMELINE section
5. **Retrievable:** Click any node to view full message pair

### Accessing Story Nodes
```
[Click any story node in left panel]
→ Modal shows:
  - Exact timestamp
  - Your message (full text)
  - AI response (full text)
  - Emotion at that moment
```

---

## Emotional Paradigm System

### How It Works

**User Emotion Detection:**
- Scans your typed message for keywords
- Assigns confidence percentages to each emotion
- Example: "I'm so happy!" → Happy: 70%, Neutral: 20%, Other: 10%

**AI Emotion Detection:**
- AI analyzes its own response
- Returns detected emotion + temperature used
- Example: Response to happy message → Happy emotion detected, high temperature (0.8)

**Visualization:**
- Orange bar shows your emotion
- Green bar shows AI detected emotion
- Height = confidence percentage (0-100%)
- Bars update in real-time with each message

**Benefits:**
- See emotional alignment (matching bars = good rapport)
- Understand AI's perspective on conversation
- Track emotional journey over time

---

## XYZ Visualization Deep Dive

### Coordinate System

```
        Y (up)
        |
        |  (deeper context)
        |
Z ------+------ X (more messages)
(back)  |  (forward)
        |
```

**X-Axis (0-100+):** Total messages in conversation
- Right = more messages sent
- More context built up

**Y-Axis (0-100+):** Conversation history length
- Up = longer conversation
- More context available to AI

**Z-Axis (0-100):** Emotional intensity
- Forward (towards viewer) = high emotion
- Back (away) = low/neutral emotion

### Reading the Visualization

**Clustered in center:** Early conversation, building context
**Spreading outward:** More messages, broader conversation
**Wavering vertically:** Emotional fluctuations
**Traces a path:** Journey through emotional space

---

## Camera Monitor Modal

### Access
Click **CAMERA** button in header to open advanced camera monitoring

### Features
1. **Live Stream:** Video preview of your camera
2. **Emotion Detection:** Shows detected facial emotion + confidence
3. **Controls:**
   - START: Begin camera capture and emotion detection
   - STOP: Stop camera and pause detection
   - CLOSE: Exit modal

### Emotion Detection from Camera
- Analyzes facial expressions
- Shows detected emotion (happy/sad/angry/fear/neutral/disgust)
- Shows confidence percentage
- Updates continuously while running

### Integration
- Camera emotions feed into paradigm panel
- Influences AI's response temperature
- Can be used to override text-based emotion detection

---

## API Endpoints Used

### Companion Management
```
POST /api/companion/create
  → Creates new companion, returns ID

GET /api/companion/list
  → Lists all companions with metadata

GET /api/companion/info/:id
  → Gets full companion profile + conversation history

PUT /api/companion/set-model/:id
  → Changes AI model for companion
```

### Chat
```
POST /api/companion/chat
  Body: {
    companion_id: "...",
    message: "User input",
    user_emotion: "happy|sad|angry|fear|neutral|surprised|disgust",
    ai_model: "model_name"
  }
  Response: {
    response: "AI message",
    emotion_detected: "detected emotion",
    model_used: "model name"
  }
```

### AI Services
```
GET /api/ai/status
  → Ollama server status + available models

GET /api/ai/models
  → Detailed model list with sizes
```

### Vision
```
GET /api/vision/cameras
  → Available camera devices

POST /api/vision/start
  → Start camera monitoring

POST /api/vision/stop
  → Stop camera monitoring
```

---

## Quick Start Guide

### 1. Load the App
```
Open: http://localhost:5000/advanced
```

### 2. Create Companion (First Time Only)
- Modal appears automatically
- Enter companion name
- Click CREATE

### 3. Grant Permissions
- Camera: Click "Allow" in browser prompt
- Geolocation: Click "Allow" in browser prompt

### 4. Observe Paradigm
- Left panel shows emotion comparison initially (all bars at 0%)

### 5. Send First Message
- Type in input field: "I'm feeling great today"
- Press Enter or click SEND
- Watch paradigm panel update with emotions
- Watch XYZ visualization plot your first point

### 6. Monitor Effects
- Change model in right panel dropdown
- Send messages with different emotions
- Click story nodes to replay exchanges
- Check camera feed in top-right

### 7. Explore Story Timeline
- Click any story node on left
- Modal shows full exchange with timestamp
- See how emotions evolved over time

---

## Technical Implementation

### State Management
```javascript
Global state variables:
- companionId: Current companion
- currentEmotion: AI's detected emotion
- userDetectedEmotion: User's detected emotion
- aiDetectedEmotion: AI's detected emotion
- storyNodes: Array of up to 20 story snapshots
- conversationHistory: All messages in session
- messageCount: Total messages sent
- tokensUsed: Approximate token usage
```

### Real-Time Updates
- Emotion paradigm updates on every message
- XYZ visualization redraws at 60fps (requestAnimationFrame)
- Story nodes prepend to timeline (FIFO, max 20)
- Camera feed updates continuously when active

### Browser APIs Used
- `MediaDevices.getUserMedia()` - Camera access
- `Geolocation.getCurrentPosition()` - GPS coordinates
- Canvas 2D Context - XYZ visualization
- WebSocket ready for future enhancements

---

## Customization Options

### Emotion Keywords
Edit the `detectUserEmotion()` function to add custom keywords:
```javascript
const keywords = {
    happy: ['great', 'awesome', 'love', /* add more */],
    sad: ['sad', 'depressed', /* add more */],
    // etc.
};
```

### Color Scheme
All colors defined at top of CSS:
- Green accent: `#00ff66`
- Alt green: `#00ff00`
- Orange (human emotion): `#ff6600`
- Modify for different color scheme

### Emotion Intensity Calculation
In `emotionIntensity()` function:
```javascript
const emotionValues = {
    happy: 0.8,    // Change these multipliers
    sad: 0.6,      // to adjust intensity per emotion
    // etc.
};
```

### Story Node Limit
In `createStoryNode()`:
```javascript
if (storyNodes.length > 20) storyNodes.pop(); // Change 20 to desired limit
```

---

## Performance Notes

- XYZ visualization runs at 60fps smoothly
- Paradigm updates are instant
- Camera stream depends on device hardware
- Story nodes are lightweight (stored in memory)
- For production, consider database persistence

---

## Future Enhancements

1. **Database Persistence:** Store story nodes permanently
2. **Real Emotion Detection:** Integrate FER (Facial Expression Recognition) ML model
3. **Graph Visualization:** Plot emotional journey over time
4. **Export:** Download story as JSON or PDF
5. **Playback:** Replay entire conversation with animated visualization
6. **Multi-Session Tracking:** Compare emotions across multiple sessions
7. **Sentiment Analysis:** Enhanced emotion detection using NLP
8. **Voice Integration:** Audio emotion detection from tone/pitch

---

## Troubleshooting

### Camera Not Working
- Grant browser camera permissions
- Check camera is connected
- Try CAMERA button modal if preview fails

### Story Nodes Not Appearing
- Send at least one message
- Check left panel scrollbar
- Nodes appear in reverse chronological order

### XYZ Visualization Not Updating
- Should update automatically on each message
- Check browser console for errors
- Refresh page if stuck

### Emotions All at 0%
- System initializes at 0% until conversation starts
- Send emotionally-colored message
- Paradigm bars should update immediately

### Models Not Loading
- Check Ollama is running: `ollama serve`
- Verify models are available: `ollama list`
- Refresh page to reload model list

---

## Code Structure

```
companion_app_advanced.html
├── Styles (CSS Grid for 3-panel layout)
├── Left Panel
│   ├── Paradigm section (emotion bars)
│   └── Story nodes timeline
├── Center Panel
│   ├── Header with controls
│   ├── XYZ Canvas visualization
│   └── Chat area with input
├── Right Panel
│   ├── Camera feed video element
│   ├── Model selector
│   ├── Status sections
│   └── Geolocation display
└── JavaScript
    ├── Initialization (init, loadModels, loadCompanion)
    ├── Visualization (initXYZVisualization, drawXYZAxes)
    ├── Story system (createStoryNode, updateStoryNodesUI)
    ├── Emotion detection (detectUserEmotion, updateEmotionParadigm)
    ├── Chat (sendMessage, addMessageToUI)
    ├── Camera (startCameraPreview, camera modal handlers)
    ├── Location (requestGeolocation)
    └── Event listeners (setupEventListeners)
```

---

## Summary

The advanced companion app combines:
- **Emotional AI** that understands and responds to your feelings
- **Real-time Visualization** of emotional state in 3D space
- **Story Timeline** recording every exchange with emotion context
- **Paradigm Monitoring** showing human vs AI emotional alignment
- **Live Camera Feed** for facial analysis and context
- **Flexible AI Models** allowing you to switch models mid-conversation

Use it to explore the intersection of human emotion and artificial intelligence.

**Access at:** `http://localhost:5000/advanced`
