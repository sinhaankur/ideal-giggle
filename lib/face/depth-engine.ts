// Face depth engine — turns single-frame face-api detections into a
// stable, multi-signal FaceReading. The raw face-api output is jittery
// and shallow ("dominant emotion" picks change every frame even when
// the user hasn't moved). This engine adds:
//
//   - Exponential moving average over expression scores (smoother label).
//   - Luminance probe of the face region to flag dim/dark lighting.
//   - Head pose (yaw / pitch / roll) from landmarks.
//   - Blink rate from eye aspect ratio.
//   - Engagement score (face area + frontality) so the rest of the app
//     can ignore readings where the user is half off-camera.
//
// The engine is stateless about the actual face-api types — it accepts
// a structural shape so the camera panel can pass detections in
// without coupling this file to face-api's class hierarchy.

import type { Emotion, FacialExpression } from "@/lib/companion-types"

interface RawExpressionScores {
  neutral: number
  happy: number
  sad: number
  angry: number
  fearful: number
  disgusted: number
  surprised: number
}

interface RawBox {
  x: number
  y: number
  width: number
  height: number
}

interface RawPoint {
  x: number
  y: number
}

interface RawLandmarks {
  // face-api FaceLandmarks68 helpers — the camera panel will pass
  // arrays from getLeftEye(), getRightEye(), getNose(), getMouth().
  leftEye: RawPoint[]
  rightEye: RawPoint[]
  nose: RawPoint[]
  mouth: RawPoint[]
}

export interface RawFaceDetection {
  expressions: RawExpressionScores
  box: RawBox
  landmarks: RawLandmarks
}

export interface LightingReading {
  level: "good" | "dim" | "dark"
  luminance: number // 0..1
  recommendation: string | null
}

export interface HeadPose {
  yaw: number // negative = looking left, positive = looking right (degrees)
  pitch: number // negative = looking up, positive = looking down
  roll: number // head tilt
}

export interface EngagementReading {
  // Whether the user is looking roughly toward the camera and close
  // enough that landmarks are reliable.
  facing: boolean
  areaRatio: number // face-box area / frame area
  score: number // 0..1 composite
}

export interface FaceReading {
  detection: boolean
  emotion: Emotion
  confidence: number
  expressions: FacialExpression
  lighting: LightingReading
  headPose: HeadPose | null
  engagement: EngagementReading
  blinkRate: number // blinks per minute
  frameQuality: "good" | "poor" | "none"
}

export const EMPTY_EXPRESSIONS: FacialExpression = {
  neutral: 0,
  happy: 0,
  sad: 0,
  angry: 0,
  fearful: 0,
  disgusted: 0,
  surprised: 0,
  detection: false,
}

const EMOTION_MAP: Record<keyof RawExpressionScores, Emotion> = {
  neutral: "neutral",
  happy: "happy",
  sad: "sad",
  angry: "angry",
  fearful: "fear",
  disgusted: "sad",
  surprised: "surprise",
}

function distance(a: RawPoint, b: RawPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// Eye Aspect Ratio (Soukupová & Čech, 2016) — collapses on a closed eye.
// Below ~0.21 typically means the eye is shut.
function eyeAspectRatio(eye: RawPoint[]): number {
  if (eye.length < 6) return 1
  const v1 = distance(eye[1], eye[5])
  const v2 = distance(eye[2], eye[4])
  const h = distance(eye[0], eye[3])
  if (h === 0) return 1
  return (v1 + v2) / (2 * h)
}

const BLINK_EAR_THRESHOLD = 0.22
const BLINK_WINDOW_MS = 60_000

function approximateHeadPose(landmarks: RawLandmarks, box: RawBox): HeadPose | null {
  if (
    landmarks.leftEye.length < 6 ||
    landmarks.rightEye.length < 6 ||
    landmarks.nose.length < 4
  ) {
    return null
  }

  const leftEyeCenter = landmarks.leftEye.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  leftEyeCenter.x /= landmarks.leftEye.length
  leftEyeCenter.y /= landmarks.leftEye.length
  const rightEyeCenter = landmarks.rightEye.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  rightEyeCenter.x /= landmarks.rightEye.length
  rightEyeCenter.y /= landmarks.rightEye.length

  const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2
  const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2
  const eyeWidth = Math.max(1, distance(leftEyeCenter, rightEyeCenter))
  const noseTip = landmarks.nose[landmarks.nose.length - 1]

  // Yaw: how far the nose tip is from the eye midpoint horizontally,
  // normalized by inter-eye distance, then mapped to degrees.
  const yawNorm = (noseTip.x - eyeMidX) / eyeWidth
  const yaw = Math.max(-45, Math.min(45, yawNorm * 60))

  // Pitch: nose tip vertical offset from eye midpoint, normalized by
  // half the box height.
  const pitchNorm = (noseTip.y - eyeMidY) / Math.max(1, box.height / 2)
  const pitch = Math.max(-45, Math.min(45, (pitchNorm - 0.4) * 50))

  // Roll: angle of eye line.
  const dy = rightEyeCenter.y - leftEyeCenter.y
  const dx = rightEyeCenter.x - leftEyeCenter.x
  const roll = (Math.atan2(dy, dx) * 180) / Math.PI

  return { yaw, pitch, roll }
}

interface BlinkSample {
  at: number
}

export class FaceDepthEngine {
  private emaScores: RawExpressionScores | null = null
  private readonly alpha = 0.32 // EMA factor — lower = more smoothing
  private blinkSamples: BlinkSample[] = []
  private earWasLow = false
  private offscreenCanvas: HTMLCanvasElement | null = null

  reset(): void {
    this.emaScores = null
    this.blinkSamples = []
    this.earWasLow = false
  }

  private getOffscreenCanvas(): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas")
      this.offscreenCanvas.width = 32
      this.offscreenCanvas.height = 32
    }
    return this.offscreenCanvas
  }

  // Sample average luminance from a small face-region thumbnail. Y =
  // 0.299R + 0.587G + 0.114B (BT.601). Returns 0..1.
  private measureLuminance(video: HTMLVideoElement, box: RawBox | null): number {
    const canvas = this.getOffscreenCanvas()
    if (!canvas) return 0.5
    const ctx = canvas.getContext("2d")
    if (!ctx) return 0.5
    if (!video.videoWidth || !video.videoHeight) return 0.5

    const sx = box ? box.x : 0
    const sy = box ? box.y : 0
    const sw = box ? box.width : video.videoWidth
    const sh = box ? box.height : video.videoHeight

    try {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let sum = 0
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        sum += 0.299 * r + 0.587 * g + 0.114 * b
        count += 1
      }
      const avg = count === 0 ? 128 : sum / count
      return Math.max(0, Math.min(1, avg / 255))
    } catch {
      // Cross-origin frames are tainted and getImageData throws. Bail to
      // a neutral 0.5 so downstream doesn't false-positive "dark".
      return 0.5
    }
  }

  private classifyLighting(luminance: number): LightingReading {
    if (luminance < 0.18) {
      return {
        level: "dark",
        luminance,
        recommendation:
          "It's quite dark — face detection becomes unreliable below this level. Try a lamp or window in front of you.",
      }
    }
    if (luminance < 0.32) {
      return {
        level: "dim",
        luminance,
        recommendation:
          "Lighting is on the dim side. A frontal light source will give cleaner emotion reads.",
      }
    }
    return { level: "good", luminance, recommendation: null }
  }

  private updateEma(scores: RawExpressionScores): RawExpressionScores {
    if (!this.emaScores) {
      this.emaScores = { ...scores }
      return this.emaScores
    }
    const next = { ...this.emaScores }
    ;(Object.keys(scores) as Array<keyof RawExpressionScores>).forEach((key) => {
      next[key] = next[key] * (1 - this.alpha) + scores[key] * this.alpha
    })
    this.emaScores = next
    return next
  }

  private updateBlinkRate(landmarks: RawLandmarks, now: number): number {
    if (landmarks.leftEye.length < 6 || landmarks.rightEye.length < 6) {
      return this.computeBlinkRate(now)
    }
    const ear = (eyeAspectRatio(landmarks.leftEye) + eyeAspectRatio(landmarks.rightEye)) / 2
    const isLow = ear < BLINK_EAR_THRESHOLD
    // Edge-trigger: count one blink per low→high transition.
    if (this.earWasLow && !isLow) {
      this.blinkSamples.push({ at: now })
    }
    this.earWasLow = isLow
    return this.computeBlinkRate(now)
  }

  private computeBlinkRate(now: number): number {
    this.blinkSamples = this.blinkSamples.filter((s) => now - s.at <= BLINK_WINDOW_MS)
    return this.blinkSamples.length // already per-minute since window is 60s
  }

  ingest(detection: RawFaceDetection | null, video: HTMLVideoElement): FaceReading {
    const now = Date.now()

    if (!detection) {
      const luminance = this.measureLuminance(video, null)
      return {
        detection: false,
        emotion: "neutral",
        confidence: 0,
        expressions: { ...EMPTY_EXPRESSIONS, detection: false },
        lighting: this.classifyLighting(luminance),
        headPose: null,
        engagement: { facing: false, areaRatio: 0, score: 0 },
        blinkRate: this.computeBlinkRate(now),
        frameQuality: "none",
      }
    }

    const smoothed = this.updateEma(detection.expressions)
    const dominantKey = (Object.keys(smoothed) as Array<keyof RawExpressionScores>).reduce(
      (a, b) => (smoothed[a] > smoothed[b] ? a : b)
    )
    const confidence = smoothed[dominantKey]
    const emotion: Emotion =
      confidence < 0.35 ? "neutral" : EMOTION_MAP[dominantKey] || "neutral"

    const luminance = this.measureLuminance(video, detection.box)
    const lighting = this.classifyLighting(luminance)
    const headPose = approximateHeadPose(detection.landmarks, detection.box)
    const blinkRate = this.updateBlinkRate(detection.landmarks, now)

    const frameW = video.videoWidth || 640
    const frameH = video.videoHeight || 480
    const areaRatio = (detection.box.width * detection.box.height) / (frameW * frameH)
    const facing =
      headPose !== null && Math.abs(headPose.yaw) < 25 && Math.abs(headPose.pitch) < 25
    const engagementScore = Math.max(
      0,
      Math.min(
        1,
        (areaRatio > 0.04 ? 0.5 : areaRatio * 12) +
          (facing ? 0.3 : 0) +
          (lighting.level === "good" ? 0.2 : 0)
      )
    )

    const frameQuality: FaceReading["frameQuality"] =
      lighting.level === "dark" || areaRatio < 0.02
        ? "poor"
        : engagementScore < 0.4
          ? "poor"
          : "good"

    return {
      detection: true,
      emotion,
      confidence,
      expressions: { ...smoothed, detection: true },
      lighting,
      headPose,
      engagement: { facing, areaRatio, score: engagementScore },
      blinkRate,
      frameQuality,
    }
  }
}
