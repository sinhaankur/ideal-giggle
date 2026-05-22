"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Camera, CameraOff, Video, MonitorSmartphone, MapPin } from "lucide-react"
import * as faceapi from "face-api.js"
import type { Emotion, FacialExpression, LocationData } from "@/lib/companion-types"
import {
  FaceDepthEngine,
  type FaceReading,
  type RawFaceDetection,
} from "@/lib/face/depth-engine"

// face-api detector tuned for a single user in front of a webcam. The
// default inputSize is 416 which is overkill — 224 is ~3x faster and
// still catches a single face filling the frame. scoreThreshold trades
// some recall for stable detections (no flicker on partial occlusions).
const FACE_DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.5,
})

// Min interval between detection passes. 2 fps is more than enough for
// emotion-aware chat — the UI smooths over the gaps and 500 ms+ pause
// gives the JS thread room to render and stream tokens.
const DETECTION_INTERVAL_MS = 500

// Loaded once per session, shared across mounts so toggling the panel
// doesn't re-load weights from disk.
let faceModelsLoadedPromise: Promise<void> | null = null
function loadFaceModelsOnce(): Promise<void> {
  if (faceModelsLoadedPromise) return faceModelsLoadedPromise
  const isFileProtocol =
    typeof window !== "undefined" && window.location.protocol === "file:"
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""
  const MODEL_URL = isFileProtocol ? "./face-models" : `${basePath}/face-models`
  faceModelsLoadedPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
  ]).then(() => undefined)
  return faceModelsLoadedPromise
}

interface CameraPanelProps {
  onEmotionDetected: (emotion: Emotion) => void
  selectedDeviceId: string
  onDeviceChange: (deviceId: string) => void
}

export function CameraPanel({ onEmotionDetected, selectedDeviceId, onDeviceChange }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [faceTrackingEnabled, setFaceTrackingEnabled] = useState(true)
  const [faceTarget, setFaceTarget] = useState({ x: 50, y: 50, zoom: 1 })
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
  const detectionTimerRef = useRef<number | null>(null)
  const detectionInFlightRef = useRef(false)
  const detectionCancelledRef = useRef(false)
  const depthEngineRef = useRef<FaceDepthEngine>(new FaceDepthEngine())
  const [depthReading, setDepthReading] = useState<FaceReading | null>(null)

  // Geolocation is opt-in now. Auto-prompting on mount was hostile —
  // users got a permission dialog before they'd done anything, and the
  // location wasn't even feeding chat. Click "Share location" to enable.
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({ ...prev, error: "Geolocation not supported" }))
      return
    }
    setLocation((prev) => ({ ...prev, error: null }))

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLocation((prev) => ({
          ...prev,
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
        }))

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
            : typeof err === "object" && err !== null && "message" in err
              ? (err as { message?: string }).message ?? "Failed to get geolocation"
              : "Failed to get geolocation"
        setLocation((prev) => ({ ...prev, error: errorMessage }))
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
      // Single-face detector is ~2x faster than detectAllFaces for the
      // selfie scenario where we always pick the first detection anyway.
      const detection = await faceapi
        .detectSingleFace(video, FACE_DETECTOR_OPTIONS)
        .withFaceLandmarks()
        .withFaceExpressions()

      if (detection) {
        const box = detection.detection.box

        // Face-centered framing: move viewport center toward detected face center.
        const videoWidth = video.videoWidth || 640
        const videoHeight = video.videoHeight || 480
        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
        const nextX = clamp(((box.x + box.width / 2) / videoWidth) * 100, 20, 80)
        const nextY = clamp(((box.y + box.height / 2) / videoHeight) * 100, 20, 80)
        const faceWidthRatio = box.width / videoWidth
        const nextZoom = clamp(0.5 / Math.max(faceWidthRatio, 0.18), 1, 1.7)

        setFaceTarget((prev) => ({
          x: prev.x * 0.7 + nextX * 0.3,
          y: prev.y * 0.7 + nextY * 0.3,
          zoom: prev.zoom * 0.7 + nextZoom * 0.3,
        }))

        // Translate face-api detection into the depth engine's structural
        // shape, then ingest. The engine handles smoothing, lighting,
        // head pose, blink rate, and engagement.
        const landmarks = detection.landmarks
        const rawDetection: RawFaceDetection = {
          expressions: {
            neutral: detection.expressions.neutral,
            happy: detection.expressions.happy,
            sad: detection.expressions.sad,
            angry: detection.expressions.angry,
            fearful: detection.expressions.fearful,
            disgusted: detection.expressions.disgusted,
            surprised: detection.expressions.surprised,
          },
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          landmarks: {
            leftEye: landmarks.getLeftEye().map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
            rightEye: landmarks
              .getRightEye()
              .map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
            nose: landmarks.getNose().map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
            mouth: landmarks.getMouth().map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
          },
        }

        const reading = depthEngineRef.current.ingest(rawDetection, video)
        setDepthReading(reading)
        setFacialExpression(reading.expressions)
        setCurrentEmotion(reading.emotion)
        // Only emit upstream when the frame quality is good enough — this
        // is what was making the chat see flickery emotion changes.
        if (reading.frameQuality !== "poor") {
          onEmotionDetected(reading.emotion)
        }
      } else {
        const reading = depthEngineRef.current.ingest(null, video)
        setDepthReading(reading)
        setFacialExpression((prev) => ({ ...prev, detection: false }))
        setFaceTarget((prev) => ({
          x: prev.x * 0.8 + 50 * 0.2,
          y: prev.y * 0.8 + 50 * 0.2,
          zoom: prev.zoom * 0.8 + 1 * 0.2,
        }))
      }
    } catch (err) {
      console.error("Facial detection error:", err)
    }
  }, [modelsLoaded, onEmotionDetected])

  // Recursive scheduler: only fires the next detection after the previous
  // finishes (avoids queue buildup on slow devices) and pauses entirely
  // when the tab is backgrounded.
  const scheduleNextDetection = useCallback(() => {
    if (detectionCancelledRef.current) return
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      // Cheap idle re-check while tab is hidden — no GPU/CPU work.
      detectionTimerRef.current = window.setTimeout(scheduleNextDetection, 1000)
      return
    }
    detectionTimerRef.current = window.setTimeout(async () => {
      if (detectionInFlightRef.current || detectionCancelledRef.current) return
      detectionInFlightRef.current = true
      try {
        await detectFacialExpression()
      } finally {
        detectionInFlightRef.current = false
        scheduleNextDetection()
      }
    }, DETECTION_INTERVAL_MS)
  }, [detectFacialExpression])

  const startCamera = useCallback(async () => {
    try {
      setError(null)

      if (!videoRef.current) {
        setError("Video element not found")
        return
      }

      // Constrain to a frontal selfie window with a stable framerate so
      // face-api gets clean, well-exposed frames. The depth engine
      // surfaces a low-light warning if the room is still too dim.
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: "user",
        },
        audio: true,
      }

      if (selectedDeviceId) {
        (constraints.video as MediaTrackConstraints).deviceId = { exact: selectedDeviceId }
      }

      // Kick off model load + camera stream in parallel — the user no
      // longer pays for face-api download on page load if they never
      // start the camera.
      const modelLoad = loadFaceModelsOnce()
        .then(() => setModelsLoaded(true))
        .catch((err) => {
          console.error("Failed to load face-api models:", err)
          setModelsLoaded(true) // proceed; the chat works without face detection
        })

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      videoRef.current.srcObject = stream

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
      detectionCancelledRef.current = false

      // Wait for models so the first detection isn't a no-op; then start
      // the recursive scheduler.
      await modelLoad
      scheduleNextDetection()
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to start camera and microphone"
      setError(errorMsg)
      console.error("Camera start error:", err)
      setIsActive(false)
    }
  }, [selectedDeviceId, scheduleNextDetection])

  const stopCamera = useCallback(() => {
    detectionCancelledRef.current = true
    if (detectionTimerRef.current !== null) {
      window.clearTimeout(detectionTimerRef.current)
      detectionTimerRef.current = null
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
    depthEngineRef.current.reset()
    setDepthReading(null)
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
    setFaceTarget({ x: 50, y: 50, zoom: 1 })
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

  const videoObjectPosition = faceTrackingEnabled ? `${faceTarget.x}% ${faceTarget.y}%` : "50% 50%"
  const videoTransform = faceTrackingEnabled && facialExpression.detection ? `scale(${faceTarget.zoom.toFixed(3)})` : "scale(1)"

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

      {/* Location Info — opt-in. We don't auto-prompt for geolocation on
          mount anymore (it was surprising and the value isn't used by the
          chat engine yet, only displayed). */}
      <div className="flex items-center justify-between gap-2 rounded border border-border bg-card p-3">
        <div className="flex items-center gap-2">
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
              <span className="text-xs text-muted-foreground">Location off</span>
            )}
          </div>
        </div>
        {!location.city && (
          <button
            onClick={requestLocation}
            className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            Share location
          </button>
        )}
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
          className={`h-full w-full object-cover transition-[object-position,transform] duration-300 ${isActive ? "block" : "hidden"}`}
          style={{
            objectPosition: videoObjectPosition,
            transform: videoTransform,
            transformOrigin: "center center",
          }}
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

      {/* Frame quality / lighting hint surfaced from the depth engine */}
      {isActive && depthReading && depthReading.lighting.recommendation && (
        <div
          className={`rounded border px-3 py-2 text-[11px] ${
            depthReading.lighting.level === "dark"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
          role="status"
        >
          <div className="font-semibold uppercase tracking-wide text-[10px] mb-0.5">
            Lighting · {depthReading.lighting.level}
          </div>
          {depthReading.lighting.recommendation}
        </div>
      )}

      {isActive && depthReading?.detection && (
        <div className="grid grid-cols-2 gap-2 rounded border border-border bg-card p-3 text-[11px]">
          <div>
            <div className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
              Engagement
            </div>
            <div className="mt-0.5 text-foreground">
              {depthReading.engagement.facing ? "facing the camera" : "looking away"}
              {" · "}
              <span className="text-muted-foreground">
                {(depthReading.engagement.score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
              Read confidence
            </div>
            <div className="mt-0.5 text-foreground">
              {depthReading.frameQuality}
              {depthReading.confidence > 0
                ? ` · ${(depthReading.confidence * 100).toFixed(0)}%`
                : ""}
            </div>
          </div>
          {depthReading.headPose && (
            <div className="col-span-2 text-muted-foreground/80">
              <span className="uppercase tracking-wide text-[10px]">Head pose:</span>{" "}
              yaw {depthReading.headPose.yaw.toFixed(0)}° · pitch{" "}
              {depthReading.headPose.pitch.toFixed(0)}° · roll{" "}
              {depthReading.headPose.roll.toFixed(0)}°
            </div>
          )}
        </div>
      )}

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

      {/* Face Tracking Controls */}
      <div className="rounded border border-border bg-card p-3">
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
          FACE TRACKING
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFaceTrackingEnabled((prev) => !prev)}
            className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            {faceTrackingEnabled ? "Tracking On" : "Tracking Off"}
          </button>
          <button
            onClick={() => setFaceTarget({ x: 50, y: 50, zoom: 1 })}
            className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Recenter
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Keeps camera framing centered on your face when detection is active.
        </p>
      </div>

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
