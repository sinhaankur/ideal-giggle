// Conversation arc classifier. Maps turn count, trajectory, and current
// state onto a phase of the standard counseling arc. The phase drives
// what kind of move makes sense next — early phases stay exploratory,
// middle phases probe and name, late phases consolidate.

import type { ArcPhase, PlanInput, RegulationState } from "./types"

interface ArcInput extends PlanInput {
  regulation: RegulationState
}

export function classifyArc(input: ArcInput): ArcPhase {
  const { userTurnCount, sessionMinutes, recentReadings = [], regulation, reading, wantsForwardMotion } = input

  // Closing: late session OR user signals winding down. We deliberately
  // shift to closing only when ventral — closing while sympathetic /
  // dorsal would be abandonment.
  if (
    regulation === "ventral" &&
    (userTurnCount >= 20 || sessionMinutes >= 25) &&
    reading.arousal < 0.55
  ) {
    return "closing"
  }

  // Opening: first 3 user turns OR very early in time.
  if (userTurnCount < 3 || sessionMinutes < 1.5) {
    return "opening"
  }

  // Integrating: arousal is dropping over the last few readings AND
  // valence is improving — the user is settling. We move from naming
  // / reframing into integration.
  if (recentReadings.length >= 3) {
    const tail = recentReadings.slice(-3)
    const arousalDrop = tail[0].arousal - tail[tail.length - 1].arousal > 0.15
    const valenceLift = tail[tail.length - 1].valence - tail[0].valence > 0.15
    if (arousalDrop && valenceLift && regulation === "ventral") {
      return "integrating"
    }
  }

  // Reframing: the user has named something concrete (high confidence
  // reading) AND has explicitly invited forward motion, AND is in
  // ventral state.
  if (
    regulation === "ventral" &&
    wantsForwardMotion === true &&
    reading.confidence === "high" &&
    userTurnCount >= 6
  ) {
    return "reframing"
  }

  // Naming: a clear primary + secondary has emerged (dyad or
  // high-confidence single emotion) and the user has been talking long
  // enough that they're not still scoping the topic.
  if (
    reading.confidence === "high" &&
    userTurnCount >= 4 &&
    (reading.dyad !== null || reading.secondary !== null)
  ) {
    return "naming"
  }

  // Default: exploring. Most of the middle of a session sits here.
  return "exploring"
}
