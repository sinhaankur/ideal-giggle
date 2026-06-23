// Low-light frame normalization for face detection.
//
// face-api's detector loses faces fast as the frame darkens — not because the
// face isn't there, but because contrast collapses into the noise floor. We
// fix that the way a camera ISP would: estimate the frame's brightness and, if
// it's low, push the pixels through a gamma + gain + contrast curve so the face
// pops back out. Detection then runs against the brightened canvas.
//
// The boost is *adaptive*: a slightly-dim room gets a gentle lift, a near-dark
// room gets a strong one, and a well-lit frame is passed through untouched
// (no canvas copy, no cost).

export interface LowLightResult {
  // The element to hand to the detector — either the original video (bright
  // enough, no work done) or a brightened offscreen canvas.
  source: HTMLVideoElement | HTMLCanvasElement
  // Mean luminance of the ORIGINAL frame, 0..1. Reused by callers so they
  // don't have to sample the frame twice.
  luminance: number
  // How much gain was applied (1 = none). Useful for telemetry/diagnostics.
  gain: number
  boosted: boolean
}

// Below this mean luminance we start brightening. Above it the frame is left
// alone. Tuned to kick in for "dim" rooms, not just pitch black.
const BOOST_THRESHOLD = 0.42
// Downscale used only for the cheap brightness probe.
const PROBE_SIZE = 24

function buildLut(gain: number, gamma: number, contrast: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    let v = i / 255
    // Gamma lifts shadows, gain scales overall brightness.
    v = Math.pow(v, gamma) * gain
    // Gentle S-curve around mid-grey restores the contrast crushed by noise.
    v = (v - 0.5) * contrast + 0.5
    lut[i] = Math.max(0, Math.min(255, Math.round(v * 255)))
  }
  return lut
}

export class LowLightProcessor {
  private probeCanvas: HTMLCanvasElement | null = null
  private workCanvas: HTMLCanvasElement | null = null

  private getCanvas(which: "probe" | "work"): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null
    if (which === "probe") {
      if (!this.probeCanvas) {
        this.probeCanvas = document.createElement("canvas")
        this.probeCanvas.width = PROBE_SIZE
        this.probeCanvas.height = PROBE_SIZE
      }
      return this.probeCanvas
    }
    if (!this.workCanvas) this.workCanvas = document.createElement("canvas")
    return this.workCanvas
  }

  // Sample mean luminance (BT.601) from a tiny downscaled copy. Cheap enough
  // to run every frame. Returns 0.5 if the frame can't be read (e.g. tainted).
  private probeLuminance(video: HTMLVideoElement): number {
    const canvas = this.getCanvas("probe")
    if (!canvas) return 0.5
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx || !video.videoWidth || !video.videoHeight) return 0.5
    try {
      ctx.drawImage(video, 0, 0, PROBE_SIZE, PROBE_SIZE)
      const data = ctx.getImageData(0, 0, PROBE_SIZE, PROBE_SIZE).data
      let sum = 0
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      return Math.max(0, Math.min(1, sum / (data.length / 4) / 255))
    } catch {
      return 0.5
    }
  }

  // Map a measured luminance to a brightening curve. Darker frames get more
  // gain, more shadow lift and more contrast. Returns null when no boost is
  // warranted so the caller can skip the copy entirely.
  private curveFor(luminance: number): { gain: number; gamma: number; contrast: number } | null {
    if (luminance >= BOOST_THRESHOLD) return null
    // 0 at the threshold, 1 as luminance approaches 0.
    const darkness = Math.min(1, (BOOST_THRESHOLD - luminance) / BOOST_THRESHOLD)
    return {
      gain: 1 + darkness * 1.6, // up to ~2.6x
      gamma: 1 - darkness * 0.45, // down to ~0.55 (lifts shadows)
      contrast: 1 + darkness * 0.5, // up to ~1.5x
    }
  }

  // Returns the best source to detect against plus the original luminance.
  process(video: HTMLVideoElement): LowLightResult {
    const luminance = this.probeLuminance(video)
    const curve = this.curveFor(luminance)
    if (!curve) {
      return { source: video, luminance, gain: 1, boosted: false }
    }

    const canvas = this.getCanvas("work")
    if (!canvas || !video.videoWidth || !video.videoHeight) {
      return { source: video, luminance, gain: 1, boosted: false }
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return { source: video, luminance, gain: 1, boosted: false }

    // Cap working resolution so the per-pixel pass stays cheap on big frames.
    const maxW = 480
    const scale = Math.min(1, maxW / video.videoWidth)
    const w = Math.round(video.videoWidth * scale)
    const h = Math.round(video.videoHeight * scale)
    canvas.width = w
    canvas.height = h

    try {
      ctx.drawImage(video, 0, 0, w, h)
      const image = ctx.getImageData(0, 0, w, h)
      const data = image.data
      const lut = buildLut(curve.gain, curve.gamma, curve.contrast)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = lut[data[i]]
        data[i + 1] = lut[data[i + 1]]
        data[i + 2] = lut[data[i + 2]]
      }
      ctx.putImageData(image, 0, 0)
      return { source: canvas, luminance, gain: curve.gain, boosted: true }
    } catch {
      // Tainted frame — fall back to the raw video.
      return { source: video, luminance, gain: 1, boosted: false }
    }
  }

  reset(): void {
    // Canvases are reused; nothing stateful to clear, but keep the API
    // symmetric with the depth engine.
  }
}
