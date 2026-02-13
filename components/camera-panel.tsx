"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Camera, CameraOff, Video, MonitorSmartphone } from "lucide-react"
import type { Emotion } from "@/lib/companion-types"

interface CameraPanelProps {
  onEmotionDetected: (emotion: Emotion) => void
  selectedDeviceId: string
  onDeviceChange: (deviceId: string) => void
}

export function CameraPanel({ onEmotionDetected, selectedDeviceId, onDeviceChange }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral")
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load available camera devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        tempStream.getTracks().forEach((t) => t.stop())

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput")
        setDevices(videoDevices)
        if (videoDevices.length > 0 && !selectedDeviceId) {
          onDeviceChange(videoDevices[0].deviceId)
        }
      } catch {
        // Camera permission denied
      }
    }
    loadDevices()
  }, [selectedDeviceId, onDeviceChange])

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 320 }, height: { ideal: 240 } }
          : { width: { ideal: 320 }, height: { ideal: 240 } },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      streamRef.current = stream
      setIsActive(true)

      // Simulated emotion detection (in a real app, use a model like face-api.js)
      intervalRef.current = setInterval(() => {
        const emotions: Emotion[] = ["neutral", "happy", "sad", "thinking", "surprise"]
        const weights = [0.4, 0.2, 0.1, 0.2, 0.1]
        let rand = Math.random()
        let emotion: Emotion = "neutral"
        for (let i = 0; i < emotions.length; i++) {
          rand -= weights[i]
          if (rand <= 0) {
            emotion = emotions[i]
            break
          }
        }
        setCurrentEmotion(emotion)
        onEmotionDetected(emotion)
      }, 3000)
    } catch {
      // Camera access denied
    }
  }, [selectedDeviceId, onEmotionDetected])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    setIsActive(false)
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
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Video className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Camera Feed
        </span>
      </div>

      {/* Camera viewport */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-border bg-background">
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
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover grayscale ${isActive ? "block" : "hidden"}`}
        />

        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <CameraOff className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/40">
              Camera Offline
            </span>
          </div>
        )}

        {/* Corner brackets (retro UI) */}
        <div className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l border-t border-muted-foreground/30" />
        <div className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r border-t border-muted-foreground/30" />
        <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b border-l border-muted-foreground/30" />
        <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b border-r border-muted-foreground/30" />

        {/* Emotion overlay */}
        {isActive && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="bg-background/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-foreground">
              {emotionLabel[currentEmotion]}
            </span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
          </div>
        )}
      </div>

      {/* Camera Toggle */}
      <button
        onClick={isActive ? stopCamera : startCamera}
        className="flex items-center justify-center gap-2 border border-border bg-card px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-accent"
      >
        {isActive ? (
          <>
            <CameraOff className="h-3 w-3" />
            <span>Stop Camera</span>
          </>
        ) : (
          <>
            <Camera className="h-3 w-3" />
            <span>Start Camera</span>
          </>
        )}
      </button>

      {/* Camera Selector */}
      {devices.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
            <MonitorSmartphone className="h-3 w-3" />
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
            className="border border-border bg-card px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
      <div className="border border-border bg-card p-3">
        <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          Detected Emotion
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-foreground animate-pulse-glow" />
          <span className="text-xs text-foreground">{emotionLabel[currentEmotion]}</span>
        </div>
      </div>
    </div>
  )
}
