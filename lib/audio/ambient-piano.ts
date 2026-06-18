// Generative ambient piano — soft, slow, endlessly varying piano-like tones
// synthesized in-browser with the Web Audio API. No audio files, no streaming,
// no network, no licensing: it fits EMPATHEIA's privacy-first, offline ethos.
//
// The sound is intentionally sparse and calming — a note (or gentle two-note
// interval) every few seconds, drawn from a pentatonic scale so nothing ever
// clashes, run through a soft lowpass + feedback delay for a roomy, reverb-ish
// tail. It loops forever without exact repetition.
//
// Crucially, the companion's voice and crisis moments take precedence: callers
// duck the piano (or stop it) so it never competes with speech or intrudes on
// a hard moment. See setDucked() / mood-aware setMood().

export type PianoMood = "calm" | "neutral" | "tender" | "light"

// Pentatonic note frequencies (C major pentatonic across two gentle octaves).
// Pentatonic = any combination sounds consonant, so randomized selection never
// produces a sour interval.
const PENTATONIC_HZ = [
  220.0, 246.94, 293.66, 329.63, 392.0, // A3 B3 D4 E4 G4
  440.0, 493.88, 587.33, 659.25, 783.99, // A4 B4 D5 E5 G5
]

interface MoodProfile {
  // Seconds between notes (randomized within a range derived from these).
  minGap: number
  maxGap: number
  // Chance a note is accompanied by a soft harmony note.
  harmonyChance: number
  // Master gain ceiling for this mood (kept low — this is background).
  gain: number
}

const MOOD_PROFILES: Record<PianoMood, MoodProfile> = {
  // Slowest and sparsest — for settling/grounding.
  calm: { minGap: 3.2, maxGap: 6.5, harmonyChance: 0.15, gain: 0.16 },
  neutral: { minGap: 2.4, maxGap: 5.0, harmonyChance: 0.25, gain: 0.18 },
  // Warmer, slightly more harmony.
  tender: { minGap: 2.6, maxGap: 5.2, harmonyChance: 0.4, gain: 0.17 },
  // A touch livelier and brighter.
  light: { minGap: 1.8, maxGap: 3.8, harmonyChance: 0.35, gain: 0.2 },
}

export class AmbientPiano {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private delay: DelayNode | null = null
  private feedback: GainNode | null = null
  private lowpass: BiquadFilterNode | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private ducked = false
  private mood: PianoMood = "calm"
  // User-facing 0..1 volume on top of the per-mood ceiling.
  private volume = 0.7

  get isRunning(): boolean {
    return this.running
  }

  // Lazily build the audio graph on first start (must be inside a user
  // gesture so the AudioContext is allowed to run).
  private ensureGraph() {
    if (this.ctx) return
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()

    const master = ctx.createGain()
    master.gain.value = 0

    // Soft room: lowpass to take the edge off, plus a feedback delay for a
    // long, reverb-like tail without a convolver/impulse asset.
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.value = 2000

    const delay = ctx.createDelay(2.0)
    delay.delayTime.value = 0.42
    const feedback = ctx.createGain()
    feedback.gain.value = 0.35

    lowpass.connect(master)
    lowpass.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(master)
    master.connect(ctx.destination)

    this.ctx = ctx
    this.master = master
    this.lowpass = lowpass
    this.delay = delay
    this.feedback = feedback
  }

  // Effective master gain given mood, user volume, and ducking.
  private targetGain(): number {
    if (this.ducked) return 0
    return MOOD_PROFILES[this.mood].gain * this.volume
  }

  private rampMaster(seconds = 0.6) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(this.targetGain(), now + seconds)
  }

  // Play one soft "piano" note: a couple of detuned oscillators through a
  // percussive gain envelope. Cheap, and good enough to read as a mallet/piano
  // pluck once filtered + delayed.
  private playNote(freq: number, when: number, velocity = 1) {
    if (!this.ctx || !this.lowpass) return
    const ctx = this.ctx
    const voiceGain = ctx.createGain()
    const peak = 0.22 * velocity
    voiceGain.gain.setValueAtTime(0.0001, when)
    voiceGain.gain.exponentialRampToValueAtTime(peak, when + 0.012)
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, when + 2.2)

    ;[0, 0.5].forEach((detune, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? "triangle" : "sine"
      osc.frequency.value = freq
      osc.detune.value = detune
      osc.connect(voiceGain)
      osc.start(when)
      osc.stop(when + 2.3)
    })

    voiceGain.connect(this.lowpass)
  }

  private scheduleNext() {
    if (!this.running || !this.ctx) return
    const profile = MOOD_PROFILES[this.mood]
    const gap = profile.minGap + Math.random() * (profile.maxGap - profile.minGap)

    this.timer = setTimeout(() => {
      if (!this.running || !this.ctx) return
      // Don't synthesize while fully ducked — saves work and avoids a note
      // sneaking in right as the companion starts speaking.
      if (!this.ducked) {
        const now = this.ctx.currentTime + 0.05
        const idx = Math.floor(Math.random() * PENTATONIC_HZ.length)
        this.playNote(PENTATONIC_HZ[idx], now, 0.8 + Math.random() * 0.2)
        if (Math.random() < profile.harmonyChance) {
          // Harmony note a few scale steps up.
          const hIdx = Math.min(PENTATONIC_HZ.length - 1, idx + 2 + Math.floor(Math.random() * 2))
          this.playNote(PENTATONIC_HZ[hIdx], now + 0.08, 0.5)
        }
      }
      this.scheduleNext()
    }, gap * 1000)
  }

  async start() {
    this.ensureGraph()
    if (!this.ctx) return
    if (this.ctx.state === "suspended") {
      await this.ctx.resume()
    }
    if (this.running) return
    this.running = true
    this.rampMaster(1.2)
    this.scheduleNext()
  }

  stop() {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.rampMaster(0.8)
  }

  // Duck to silence (voice output / crisis) without tearing down the graph,
  // so it can resume seamlessly. Idempotent.
  setDucked(ducked: boolean) {
    if (this.ducked === ducked) return
    this.ducked = ducked
    this.rampMaster(ducked ? 0.25 : 0.9)
  }

  setMood(mood: PianoMood) {
    if (this.mood === mood) return
    this.mood = mood
    this.rampMaster(1.5)
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    this.rampMaster(0.4)
  }

  // Full teardown — release the AudioContext.
  dispose() {
    this.stop()
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}
