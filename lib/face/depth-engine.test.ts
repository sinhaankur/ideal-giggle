import { describe, expect, it } from "vitest"
import { FaceDepthEngine, type RawFaceDetection } from "./depth-engine"

// In the node test environment `document` is undefined, so the engine's
// luminance probe falls back to a neutral 0.5 ("good" lighting). That's fine —
// these tests exercise the expression-smoothing, hysteresis and floor logic,
// not the canvas path.

// A stand-in for HTMLVideoElement with just the fields the engine reads.
const fakeVideo = { videoWidth: 640, videoHeight: 480 } as unknown as HTMLVideoElement

// Build a centered, frontal, frame-filling face so engagement/frame-quality
// come back "good" and don't suppress the emotion under test. `expr` overrides
// the seven expression scores (others default to 0).
function detectionWith(expr: Partial<RawFaceDetection["expressions"]>): RawFaceDetection {
  const baseExpr = {
    neutral: 0,
    happy: 0,
    sad: 0,
    angry: 0,
    fearful: 0,
    disgusted: 0,
    surprised: 0,
    ...expr,
  }
  // A roughly frontal landmark set: eyes level, nose centered, mouth below.
  const leftEye = [
    { x: 250, y: 200 },
    { x: 258, y: 196 },
    { x: 266, y: 196 },
    { x: 274, y: 200 },
    { x: 266, y: 204 },
    { x: 258, y: 204 },
  ]
  const rightEye = leftEye.map((p) => ({ x: p.x + 100, y: p.y }))
  const nose = [
    { x: 320, y: 210 },
    { x: 320, y: 230 },
    { x: 320, y: 250 },
    { x: 320, y: 268 },
  ]
  const mouth = [
    { x: 300, y: 300 },
    { x: 340, y: 300 },
  ]
  return {
    expressions: baseExpr,
    box: { x: 220, y: 160, width: 200, height: 220 }, // ~0.14 area ratio
    landmarks: { leftEye, rightEye, nose, mouth },
  }
}

// Feed the same detection n times so the EMA can converge.
function settle(engine: FaceDepthEngine, det: RawFaceDetection, n: number) {
  let reading = engine.ingest(det, fakeVideo)
  for (let i = 1; i < n; i++) reading = engine.ingest(det, fakeVideo)
  return reading
}

describe("FaceDepthEngine — emotion mapping", () => {
  it("reads a clearly happy face as happy", () => {
    const engine = new FaceDepthEngine()
    const reading = settle(engine, detectionWith({ happy: 0.9, neutral: 0.1 }), 8)
    expect(reading.emotion).toBe("happy")
    expect(reading.detection).toBe(true)
  })

  it("maps fearful to 'fear' once it clears its higher floor", () => {
    const engine = new FaceDepthEngine()
    const reading = settle(engine, detectionWith({ fearful: 0.9, neutral: 0.1 }), 8)
    expect(reading.emotion).toBe("fear")
  })

  it("falls back to neutral when the dominant score is weak", () => {
    const engine = new FaceDepthEngine()
    // sad just barely on top but well under the 0.35 floor.
    const reading = settle(engine, detectionWith({ sad: 0.3, neutral: 0.25 }), 8)
    expect(reading.emotion).toBe("neutral")
  })

  it("requires a higher bar for fear than for happy", () => {
    const engine = new FaceDepthEngine()
    // 0.45 clears the 0.35 generic floor but not the 0.5 fear floor.
    const reading = settle(engine, detectionWith({ fearful: 0.45, neutral: 0.2 }), 10)
    expect(reading.emotion).toBe("neutral")
  })
})

describe("FaceDepthEngine — hysteresis", () => {
  it("does not flip the label on a single marginal challenger frame", () => {
    const engine = new FaceDepthEngine()
    // Establish a stable 'happy'.
    settle(engine, detectionWith({ happy: 0.9, neutral: 0.05 }), 8)
    // One frame where sad nudges just ahead — should NOT switch yet.
    const reading = engine.ingest(detectionWith({ sad: 0.5, happy: 0.45 }), fakeVideo)
    expect(reading.emotion).toBe("happy")
  })

  it("switches once a challenger leads by the margin for enough frames", () => {
    const engine = new FaceDepthEngine()
    settle(engine, detectionWith({ happy: 0.9, neutral: 0.05 }), 8)
    // Sustained strong sad — the EMA crosses over and dwell is satisfied.
    const reading = settle(engine, detectionWith({ sad: 0.95, happy: 0.02 }), 12)
    expect(reading.emotion).toBe("sad")
  })
})

describe("FaceDepthEngine — no detection", () => {
  it("reports none/neutral with zero confidence when no face is present", () => {
    const engine = new FaceDepthEngine()
    const reading = engine.ingest(null, fakeVideo)
    expect(reading.detection).toBe(false)
    expect(reading.emotion).toBe("neutral")
    expect(reading.confidence).toBe(0)
    expect(reading.frameQuality).toBe("none")
  })

  it("resets stable state so a new session starts clean", () => {
    const engine = new FaceDepthEngine()
    settle(engine, detectionWith({ happy: 0.9 }), 8)
    engine.reset()
    // First frame after reset should adopt the new expression immediately.
    const reading = engine.ingest(detectionWith({ sad: 0.9, neutral: 0.05 }), fakeVideo)
    expect(reading.emotion).toBe("sad")
  })
})
