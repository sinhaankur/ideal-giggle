# Empathy Engine Documentation

## Scope and Disambiguation
This document describes empathy as implemented by the Empatheia runtime and UI map.

For other uses, see empathy and empath disambiguation contexts in general reference literature.

This model is not the same as sympathy, pity, or simple emotional contagion.

- Empathy: understanding another person's perspective and emotional meaning, then responding in a useful way.
- Sympathy: caring about someone else's pain without necessarily modeling their viewpoint.
- Emotional contagion: mirroring emotion without clear perspective-taking.

## Why the Engine Uses a Tree
Empathy is broad and can become vague unless the system has a structured model. The engine uses a layered tree so prompts, extraction, and follow-up questions stay aligned.

The tree also keeps the system from over-indexing on one style (for example, warmth without clarity, or analysis without care).

## Tree of Understanding

```text
Empathy
|-- 1) Core Capability
|   |-- Perceive another perspective
|   |-- Understand emotional meaning
|   |-- Respond in a tolerable and useful way
|
|-- 2) Primary Dimensions
|   |-- Cognitive empathy
|   |   |-- Perspective-taking
|   |   |-- Context and belief inference
|   |
|   |-- Affective empathy
|   |   |-- Emotional resonance
|   |   |-- Empathic concern
|   |
|   |-- Regulatory empathy
|   |   |-- Emotional boundaries
|   |   |-- Distress management
|   |
|   |-- Compassionate empathy
|       |-- Supportive action
|       |-- Reframing and practical help
|
|-- 3) Observable Runtime Anchors (Map Quadrants)
|   |-- SAYS  : explicit language and narrative
|   |-- THINKS: assumptions, beliefs, interpretation
|   |-- DOES  : actions, coping patterns, avoidance
|   |-- FEELS : emotional tone, pain, unmet needs
|
|-- 4) Deepening Logic
|   |-- Surface -> Internal -> Social -> Shadow
|   |-- Detect dissonance across quadrants
|   |-- Ask one grounded follow-up question
|
|-- 5) Measurement and Confidence
|   |-- Behavioral signals (text, pacing, coherence)
|   |-- Self-report signals (what user claims)
|   |-- Confidence is provisional, never absolute
|
|-- 6) Failure Modes
|   |-- Advice before understanding
|   |-- Over-identification / rescuing stance
|   |-- Selective empathy or in-group bias
|   |-- Validation loops without movement
|
|-- 7) Safety Constraints
|   |-- No diagnosis or clinical claims
|   |-- Keep agency with the user
|   |-- Suggest professional help for crisis contexts
|   |-- Stay specific, respectful, and non-coercive
```

## Runtime Interpretation Rules
The conversation system prompt follows these principles:

- Start with accurate reflection tied to user wording.
- Name one emotional signal and one cognitive frame.
- Offer one small reframe that preserves user agency.
- Ask exactly one follow-up question.
- Update empathy quadrants with concise evidence.

## Visual Emotion Wheel Question Set
Use these questions when the user is working from a visual emotion wheel.

- Identification: Which primary emotion is strongest right now (joy, trust, fear, surprise, sadness, disgust, anger, anticipation)?
- Blend: Is there a second emotion mixed in (for example, anxiety, shame, optimism, contempt)?
- Intensity: Is this mild, medium, or intense right now?
- Trajectory: Is the feeling rising, steady, or fading?
- Trigger: What event, memory, or thought activated it?
- Meaning: What interpretation are you making about this feeling?
- Body signal: Where do you notice it in your body first?
- Need: What need is not being met right now?
- Next step: What is one small action that would make you 10 percent steadier?

## Centering Response Template (Stability First)
When the user is dysregulated, answer with a short stability protocol before deeper reflection.

1. Validate in one line.
2. Guide one grounding action.
3. Ask one concrete stabilizing question.

Suggested response pattern:

"I am here with you. Let's stabilize first: inhale for 4, exhale for 6, three times, then place both feet on the floor and name 3 things you can see right now. Which primary emotion on the wheel is strongest in this moment?"

## Practical Distinctions Used by the Engine

- High empathy is not the same as high agreement.
- Deep empathy is not emotional flooding.
- Corrective reflection is preferred over generic reassurance.
- Progress means better clarity and regulation, not only longer responses.

## Notes on Limits
Empathy signals are inferred from text and interaction context. They are probabilistic and can be wrong. The engine treats all inference as revisable and updates over the session.

## Mapping to the Codebase

- Prompt construction: `lib/conversation/communication-engine.ts`
- Empathy extraction and code generation: `lib/companion-types.ts`
- UI map rendering: `components/empathy-panel.tsx`
- Main orchestration and fallback flow: `app/page.tsx`
