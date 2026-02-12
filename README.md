# Building Management AI Dashboard

## Overview
A modern web-based AI dashboard for optimizing building management processes. The system includes AI models for predicting energy consumption, managing occupancy rates, and enhancing overall building efficiency with a beautiful, responsive user interface.

## Features
✨ **Modern Dashboard UI**
- Real-time building statistics and metrics
- Interactive charts and visualizations
- Responsive design for all devices
- Dark theme optimized for extended use

🤖 **AI-Powered Predictions**
- Energy consumption forecasting
- Building performance optimization
- Machine learning model monitoring
- Real-time prediction generation

📊 **Comprehensive Analytics**
- Energy usage tracking
- Occupancy rate monitoring
- Temperature management
- Alert system for anomalies

## Project Structure
```
building-management-ai
├── app.py                  # Main application entry point
├── src/
│   ├── static/            # Frontend files
│   │   ├── index.html     # Main dashboard UI
│   │   ├── styles.css     # Styling
│   │   └── app.js         # Frontend logic
│   ├── api/
│   │   └── routes.py      # API endpoints
│   ├── ai/
│   │   ├── models/
│   │   │   └── index.py   # AI models
│   │   └── utils/
│   │       └── index.py   # Utility functions
│   └── config/
│       └── settings.py    # Configuration
├── data/
│   └── sample_data.json   # Sample datasets
├── requirements.txt       # Python dependencies
├── Dockerfile            # Container configuration
└── README.md
```

## Quick Start

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd building-management-ai
   ```

2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python app.py
   ```

4. Access the dashboard:
   Open your browser and navigate to **http://localhost:5000**

### Using Docker/Podman

1. Build the image:
   ```bash
   podman build -t building-ai .
   # or: docker build -t building-ai .
   ```

2. Run the container:
   ```bash
   podman run -d -p 5000:5000 building-ai
   # or: docker run -d -p 5000:5000 building-ai
   ```

3. Access the dashboard at **http://localhost:5000**

## API Endpoints

### POST `/api/predict`
Generate AI predictions for building management.

**Request:**
```json
{
  "temperature": 22.5,
  "occupancy": 45,
  "time": "14:30",
  "day": "Monday"
}
```

**Response:**
```json
{
  "prediction": "Predicted energy consumption: 145 kWh",
  "confidence": 0.87,
  "timestamp": "2026-02-02T10:30:00"
}
```

### GET `/api/model-status`
Get the status of AI models.

**Response:**
```json
{
  "building_model": {
    "status": "active",
    "accuracy": 0.92,
    "last_updated": "2026-02-02T10:30:00"
  },
  "energy_model": {
    "status": "active",
    "accuracy": 0.88,
    "last_updated": "2026-02-02T10:30:00"
  }
}
```

## Dashboard Features

### 📊 Pages
1. **Overview** - Real-time building statistics and charts
2. **Energy** - Energy consumption monitoring
3. **Predictions** - Generate AI-powered predictions
4. **AI Models** - Monitor model status and performance
5. **Settings** - Configure dashboard preferences

### 🎨 UI Components
- Sidebar navigation with icons
- Real-time stats cards with trend indicators
- Interactive prediction form
- Model status monitoring
- Responsive design for all screen sizes

## Cloudflare Tunnel Setup (Ollama + Open WebUI)

### Current Status
✅ **Completed:**
- Ollama running locally on port 11434 with models (llama3.1:8b, nomic-embed-text, etc.)
- Open WebUI running locally on port 3001 with persistent Docker volume
- Cloudflare Tunnel created: `ai-buildingai-ollama` (ID: 73424660-3942-43d4-83d3-bc99a8b713e3)
- Tunnel running in Podman container with 4 active connections
- DNS CNAME records configured (ai.buildingai.cloud, api.buildingai.cloud, ui.buildingai.cloud)
- Ingress rules configured in tunnel config:
  - `ai.buildingai.cloud` → `http://localhost:3001` (Open WebUI)
  - `api.buildingai.cloud` → `http://localhost:11434` (Ollama API)
  - `ui.buildingai.cloud` → `http://localhost:3001` (UI alias)

⏳ **Pending - DNS/Cloudflare Routing:**
- Public URLs returning HTTP 530 (error code 1033) - tunnel not reachable from Cloudflare edge
- Need to configure public hostnames in Cloudflare Zero Trust for proper routing
- Issue: Zero Trust dashboard not showing the tunnel (CLI-created tunnel may not be visible in UI)

### Accessing Services
**Local (behind NAT):**
- Open WebUI: http://localhost:3001
- Ollama API: http://localhost:11434/api/tags

**Public (when routing is fixed):**
- Open WebUI: https://ai.buildingai.cloud
- Ollama API: https://api.buildingai.cloud/api/tags

### VS Code Tasks (Podman Management)
Available tasks in `.vscode/tasks.json`:
- `podman-start-ollama` - Start Ollama container
- `podman-stop-ollama` - Stop Ollama container
- `podman-start-cloudflared` - Start Cloudflare Tunnel container
- `podman-stop-cloudflared` - Stop Cloudflare Tunnel container
- `podman-start-all` - Start all services
- `podman-stop-all` - Stop all services

### Troubleshooting Tunnel Access
If public URLs aren't working:
1. Verify DNS is resolving to CNAME: `dig ai.buildingai.cloud +short`
   - Should return: `73424660-3942-43d4-83d3-bc99a8b713e3.cfargotunnel.com.`
2. Check tunnel is connected: `cloudflared tunnel info ai-buildingai-ollama`
   - Should show active connections to Cloudflare edge
3. Verify local services are running: `curl http://localhost:3001` and `curl http://localhost:11434/api/tags`
4. Check tunnel logs: `podman logs cloudflared`

## Usage
- Access the API endpoints to fetch predictions and model status.
- Use the provided sample data in `data/sample_data.json` for testing.

## Podman + VS Code Tasks
You can run Ollama and the Cloudflare Tunnel with Podman and VS Code tasks.

1. In VS Code, open the task picker and run **podman: start all**.
2. Verify Ollama is reachable at `http://localhost:11434`.
3. Verify the tunnel at `https://ai.buildingai.cloud/api/tags`.
4. Open WebUI is available at `https://ai.buildingai.cloud`.

To stop everything, run **podman: stop all**.

## Website Status
The main website remains under construction.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.