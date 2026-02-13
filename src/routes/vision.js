/**
 * Vision & Camera Routes
 * Camera enumeration, monitoring, and frame capture
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Camera state
let cameraState = {
  monitoring: false,
  currentIndex: 0,
  frameBuffer: null,
  startTime: null
};

/**
 * GET /api/vision/cameras
 * List available cameras
 */
router.get('/cameras', async (req, res) => {
  try {
    // Try to list video devices on Linux
    let cameras = [];

    if (process.platform === 'linux') {
      try {
        const { stdout } = await execAsync('ls -la /dev/video* 2>/dev/null || echo ""');
        const videoDevices = stdout.trim().split('\n').filter(line => line.includes('video'));

        for (let i = 0; i < videoDevices.length; i++) {
          cameras.push({
            index: i,
            name: `Camera ${i}`,
            path: `/dev/video${i}`,
            available: true
          });
        }
      } catch (error) {
        console.log('No video devices found on Linux');
      }
    } else if (process.platform === 'darwin') {
      // macOS - ffmpeg can enumerate cameras
      try {
        await execAsync('ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep "\\[AVFoundation"', {
          shell: '/bin/bash'
        });
        cameras.push({
          index: 0,
          name: 'Default Camera',
          available: true
        });
      } catch (error) {
        console.log('No cameras found on macOS');
      }
    } else if (process.platform === 'win32') {
      // Windows - enumerate using other methods
      cameras.push({
        index: 0,
        name: 'Default Camera',
        available: true
      });
    }

    res.json({
      success: true,
      cameras,
      count: cameras.length,
      monitoring: cameraState.monitoring
    });
  } catch (error) {
    console.error('Camera enumeration error:', error);

    res.json({
      success: true,
      cameras: [],
      count: 0,
      monitoring: cameraState.monitoring,
      message: 'Could not enumerate cameras, but browser preview will still work'
    });
  }
});

/**
 * POST /api/vision/start
 * Start camera monitoring
 */
router.post('/start', async (req, res) => {
  try {
    const { camera_index = 0, enable_audio = false } = req.body;

    if (cameraState.monitoring) {
      return res.json({
        success: true,
        message: 'Camera already monitoring'
      });
    }

    cameraState.monitoring = true;
    cameraState.currentIndex = camera_index;
    cameraState.startTime = Date.now();

    res.json({
      success: true,
      message: 'Camera monitoring started',
      camera_index,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Camera start error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to start camera monitoring'
    });
  }
});

/**
 * POST /api/vision/stop
 * Stop camera monitoring
 */
router.post('/stop', async (req, res) => {
  try {
    cameraState.monitoring = false;
    cameraState.frameBuffer = null;

    res.json({
      success: true,
      message: 'Camera monitoring stopped'
    });
  } catch (error) {
    console.error('Camera stop error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to stop camera monitoring'
    });
  }
});

/**
 * GET /api/vision/frame
 * Get current camera frame
 */
router.get('/frame', (req, res) => {
  try {
    if (!cameraState.monitoring) {
      return res.json({
        success: false,
        message: 'Camera not monitoring'
      });
    }

    // Return mock frame data
    // In production, integrate with actual camera capture library
    if (cameraState.frameBuffer) {
      res.json({
        success: true,
        image: cameraState.frameBuffer,
        timestamp: new Date().toISOString(),
        camera_index: cameraState.currentIndex
      });
    } else {
      res.json({
        success: true,
        message: 'Frame not available yet'
      });
    }
  } catch (error) {
    console.error('Frame retrieval error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve frame'
    });
  }
});

/**
 * POST /api/vision/capture
 * Capture a single frame
 */
router.post('/capture', async (req, res) => {
  try {
    const { camera_index = 0 } = req.body;

    // Mock capture - in production, use ffmpeg or OpenCV to capture
    res.json({
      success: true,
      message: 'Frame captured',
      camera_index,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Capture error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to capture frame'
    });
  }
});

module.exports = router;
