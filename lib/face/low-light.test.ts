import { describe, expect, it } from "vitest"
import { LowLightProcessor } from "./low-light"

// In the node test environment `document` is undefined, so the processor can't
// create canvases and safely falls back to passing the raw video through. This
// test pins that safe-degradation contract — the camera panel relies on it so
// detection never crashes when canvas isn't available.

const fakeVideo = { videoWidth: 640, videoHeight: 480 } as unknown as HTMLVideoElement

describe("LowLightProcessor — safe fallback", () => {
  it("passes the video through untouched when no canvas is available", () => {
    const proc = new LowLightProcessor()
    const result = proc.process(fakeVideo)
    expect(result.source).toBe(fakeVideo)
    expect(result.boosted).toBe(false)
    expect(result.gain).toBe(1)
  })

  it("reports a defined luminance and never throws", () => {
    const proc = new LowLightProcessor()
    expect(() => proc.process(fakeVideo)).not.toThrow()
    const result = proc.process(fakeVideo)
    expect(result.luminance).toBeGreaterThanOrEqual(0)
    expect(result.luminance).toBeLessThanOrEqual(1)
  })

  it("reset is a no-op that does not throw", () => {
    const proc = new LowLightProcessor()
    expect(() => proc.reset()).not.toThrow()
  })
})
