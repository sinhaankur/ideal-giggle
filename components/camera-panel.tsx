"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Camera, CameraOff, Video, MonitorSmartphone, MapPin } from "lucide-react"
import * as faceapi from "face-api.js"
import type { Emotion, FacialExpression, LocationData } from "@/lib/companion-types"

interface CameraPanelProps {
  onEmotionDetected: (emotion: Emotion) => void
  selectedDeviceId: string
  onDeviceChange: (deviceId: string) => void
}

export function CameraPanel({ onEmotionDetected, selectedDeviceId, onDeviceChange }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral")
  const [error, setError] = useState<string | null>(null)
  const [facialExpression, setFacialExpression] = useState<FacialExpression>({
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0,
    surprised: 0,
    detection: false,
  })
  const [location, setLocation] = useState<LocationData>({
    latitude: null,
    longitude: null,
    accuracy: null,
    city: null,
    country: null,
    error: null,
  })
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        setModelsLoaded(true)
      } catch (err) {
        console.error("Failed to load face-api models:", err)
        setModelsLoaded(true) // Continue anyway
      }
    }

    loadModels()
  }, [])

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({ ...prev, error: "Geolocation not supported" }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocation((prev) => ({
          ...prev,
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
        }))

        // Reverse geocode to get city and country
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          )
          const data = await response.json()
          setLocation((prev) => ({
            ...prev,
            city: data.address?.city || data.address?.town || "Unknown",
            country: data.address?.country || "Unknown",
          }))
        } catch (err) {
          console.error("Geocoding failed:", err)
        }
      },
      (err) => {
        const errorMessage = 
          err instanceof GeolocationPositionError 
            ? err.message 
            : typeof err === 'object' && err !== null && 'message' in err
            ? (err as any).message
            : "Failed to get geolocation"
        setLocation((prev) => ({ ...prev, error: errorMessage }))
        console.error("Geolocation error:", err)
      }
    )
  }, [])

  // Load available camera devices (without requesting permissions)
  useEffect(() => {
    async function loadDevices() {
      try {
        setError(null)
        // Enumerate devices without requesting permissions first
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput")
        
        // If no devices found, make a test request to trigger permission prompt for first time
        if (videoDevices.length === 0) {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            })
            tempStream.getTracks().forEach((t) => t.stop())
            // Try enumeration again after getting permission
            const allDevices2 = await navigator.mediaDevices.enumerateDevices()
            const videoDevices2 = allDevices2.filter((d) => d.kind === "videoinput")
            setDevices(videoDevices2)
            if (videoDevices2.length > 0 && !selectedDeviceId) {
              onDeviceChange(videoDevices2[0].deviceId)
            }
          } catch {
            // User denied or has no camera
            setDevices([])
          }
        } else {
          setDevices(videoDevices)
          if (videoDevices.length > 0 && !selectedDeviceId) {
            onDeviceChange(videoDevices[0].deviceId)
          }
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to enumerate camera devices"
        console.error("Device enumeration error:", err)
        // Don't show error here, only show when user tries to start camera
      }
    }
    loadDevices()
  }, [selectedDeviceId, onDeviceChange])

  const detectFacialExpression = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded) return

    try {
      const video = videoRef.current
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()

      if (detections.length > 0) {
        const detection = detections[0]
        const expressions = detection.expressions

        // Get the dominant expression
        const expressionScores = {
          neutral: expressions.neutral,
          happy: expressions.happy,
          sad: expressions.sad,
          angry: expressions.angry,
          fearful: expressions.fearful,
          disgusted: expressions.disgusted,
          surprised: expressions.surprised,
        }

        setFacialExpression({
          ...expressionScores,
          detection: true,
        })

        // Map to emotion type
        const emotionEntries = Object.entries(expressionScores)
        const dominantEmotion = emotionEntries.reduce((prev, curr) =>
          curr[1] > prev[1] ? curr : prev
        )[0]

        const emotionMap: Record<string, Emotion> = {
          neutral: "neutral",
          happy: "happy",
          sad: "sad",
          angry: "angry",
          fearful: "fear",
          disgusted: "sad",
          surprised: "surprise",
        }

        const detectedEmotion = emotionMap[dominantEmotion] || "neutral"
        setCurrentEmotion(detectedEmotion)
        onEmotionDetected(detectedEmotion)
      } else {
        setFacialExpression((prev) => ({ ...prev, detection: false }))
      }
    } catch (err) {
      console.error("Facial detection error:", err)
    }
  }, [modelsLoaded, onEmotionDetected])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      
      if (!videoRef.current) {
        setError("Video element not found")
        return
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
        },
        audio: true,
      }

      // Use specific device if selected
      if (selectedDeviceId) {
        (constraints.video as any).deviceId = { exact: selectedDeviceId }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Ensure the video element is ready
      videoRef.current.srcObject = stream
      
      // Wait for the video to be loadable
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Video load timeout")), 5000)
        const onLoadedMetadata = () => {
          clearTimeout(timeout)
          videoRef.current?.removeEventListener("loadedmetadata", onLoadedMetadata)
          resolve()
        }
        videoRef.current?.addEventListener("loadedmetadata", onLoadedMetadata)
      })

      streamRef.current = stream
      setIsActive(true)

      // Real-time facial expression detection
      if (modelsLoaded) {
        detectionIntervalRef.current = setInterval(detectFacialExpression, 500)
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to start camera and microphone"
      setError(errorMsg)
      console.error("Camera start error:", err)
      setIsActive(false)
    }
  }, [selectedDeviceId, modelsLoaded, detectFacialExpression])

  const stopCamera = useCallback(() => {
    // Clear detection interval
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current)
      detectionIntervalRef.current = null
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    // Reset state
    setIsActive(false)
    setFacialExpression({
      neutral: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
      detection: false,
    })
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const emotionLabel: Record<Emotion, string> = {
    neutral: "NEUTRAL",
    happy: "HAPPY",
    sad: "SAD",
    angry: "ANGRY",
    fear: "ANXIOUS",
    surprise: "SURPRISED",
    thinking: "CONTEMPLATIVE",
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Video className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold tracking-wide text-foreground">
          Camera Feed & Analysis
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Please allow camera and microphone access in your browser settings
          </p>
        </div>
      )}

      {/* Location Info */}
      <div className="flex items-center gap-2 rounded border border-border bg-card p-3">
        <MapPin className="h-4 w-4 text-foreground" />
        <div className="flex flex-col text-sm">
          {location.city && location.country ? (
            <>
              <span className="font-medium text-foreground">
                {location.city}, {location.country}
              </span>
              <span className="text-xs text-muted-foreground">
                {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                {location.accuracy && ` ±${location.accuracy}m`}
              </span>
            </>
          ) : location.error ? (
            <span className="text-xs text-muted-foreground">Location: {location.error}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Fetching location...</span>
          )}
        </div>
      </div>

      {/* Camera viewport */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-border bg-background">
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)",
          }}
        />

        <video
          ref={videoRef}
          autoPlay={true}
          playsInline={true}
          muted={true}
          className={`h-full w-full object-cover ${isActive ? "block" : "hidden"}`}
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 hidden h-full w-full"
        />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/50">
            <CameraOff className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Camera Offline
            </span>
          </div>
        )}

        {/* Corner brackets */}
        <div className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l border-t border-muted-foreground/30" />
        <div className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r border-t border-muted-foreground/30" />
        <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b border-l border-muted-foreground/30" />
        <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b border-r border-muted-foreground/30" />

        {/* Emotion & Detection overlay */}
        {isActive && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div>
              <span className="rounded bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
                {emotionLabel[currentEmotion]}
              </span>
              {facialExpression.detection && (
                <span className="ml-2 text-[10px] text-green-400">
                  ✓ Face Detected
                </span>
              )}
            </div>
            <span className="h-2 w-2 animate-pulse rounded-full bg-foreground" />
          </div>
        )}
      </div>

      {/* Facial Expression Analysis */}
      {isActive && facialExpression.detection && (
        <div className="rounded border border-border bg-card p-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            FACIAL EXPRESSION ANALYSIS
          </div>
          <div className="space-y-1">
            {[
              { label: "Happy", value: facialExpression.happy },
              { label: "Surprised", value: facialExpression.surprised },
              { label: "Fearful", value: facialExpression.fearful },
              { label: "Angry", value: facialExpression.angry },
              { label: "Sad", value: facialExpression.sad },
              { label: "Neutral", value: facialExpression.neutral },
            ].map((exp) => (
              <div key={exp.label} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">{exp.label}</span>
                <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all"
                    style={{ width: `${(exp.value * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-foreground w-8 text-right">
                  {(exp.value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera Toggle */}
      <button
        onClick={isActive ? stopCamera : startCamera}
        className="flex items-center justify-center gap-2 rounded border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        {isActive ? (
          <>
            <CameraOff className="h-4 w-4" />
            <span>Stop Camera</span>
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            <span>Start Camera</span>
          </>
        )}
      </button>

      {/* Camera Selector */}
      {devices.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MonitorSmartphone className="h-4 w-4" />
            Select Camera
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => {
              onDeviceChange(e.target.value)
              if (isActive) {
                stopCamera()
                setTimeout(startCamera, 200)
              }
            }}
            className="rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {devices.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId} className="bg-card text-foreground">
                {device.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current detected emotion */}
      <div className="rounded border border-border bg-card p-3">
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          DETECTED EMOTION
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground animate-pulse" />
          <span className="text-base font-medium text-foreground">{emotionLabel[currentEmotion]}</span>
        </div>
      </div>
    </div>
  )
}
