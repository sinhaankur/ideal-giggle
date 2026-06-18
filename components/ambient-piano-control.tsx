"use client"

import { useEffect, useRef, useState } from "react"
import { Music, VolumeX } from "lucide-react"
import { AmbientPiano, type PianoMood } from "@/lib/audio/ambient-piano"

interface AmbientPianoControlProps {
  // When true, the piano ducks to silence (companion is speaking, or a crisis
  // moment is active) — speech and hard moments always take precedence.
  duck?: boolean
  // Mood-aware texture: calmer = slower/sparser. Optional; defaults to calm.
  mood?: PianoMood
}

export function AmbientPianoControl({ duck = false, mood = "calm" }: AmbientPianoControlProps) {
  const pianoRef = useRef<AmbientPiano | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)

  // Lazily create the engine on first interaction (AudioContext needs a user
  // gesture). Tear it down on unmount.
  useEffect(() => {
    return () => {
      pianoRef.current?.dispose()
      pianoRef.current = null
    }
  }, [])

  // React to ducking + mood without restarting the stream.
  useEffect(() => {
    pianoRef.current?.setDucked(duck)
  }, [duck])

  useEffect(() => {
    pianoRef.current?.setMood(mood)
  }, [mood])

  useEffect(() => {
    pianoRef.current?.setVolume(volume)
  }, [volume])

  const toggle = async () => {
    if (!pianoRef.current) {
      pianoRef.current = new AmbientPiano()
      pianoRef.current.setMood(mood)
      pianoRef.current.setVolume(volume)
      pianoRef.current.setDucked(duck)
    }
    if (playing) {
      pianoRef.current.stop()
      setPlaying(false)
    } else {
      await pianoRef.current.start()
      setPlaying(true)
    }
  }

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground">
          <Music className="h-3.5 w-3.5" />
          AMBIENT PIANO
        </div>
        <button
          onClick={toggle}
          className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
            playing
              ? "border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
              : "border-border bg-background text-foreground hover:bg-accent"
          }`}
          aria-pressed={playing}
        >
          {playing ? "On" : "Off"}
        </button>
      </div>

      {playing && (
        <div className="flex items-center gap-2">
          <VolumeX className="h-3 w-3 text-muted-foreground/60" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-violet-400"
            aria-label="Ambient piano volume"
          />
        </div>
      )}

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {playing
          ? duck
            ? "Resting while we talk — it'll return softly."
            : "Soft generated piano. It quiets itself when the companion speaks."
          : "Gentle, generated piano for the background. Plays entirely on your device."}
      </p>
    </div>
  )
}
