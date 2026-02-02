# Rogue Practice

A browser-based roguelike practice game controlled entirely via brass instrument and microphone. No keyboard/mouse during gameplay - navigation and performance all through played notes.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

For audio testing: open `client/audio/audio-test.html` directly in browser.

## Project Structure

```
/client
  /audio                    - Audio detection system (primary focus)
    audio.js                - AudioInputManager: orchestrates worklet, routes to listeners
    audio-worklet-processor.js - Runs WASM pitch/onset detection
    lenient-note-listener.js   - Forgiving note detection for commands/calibration
    performance-analyzer.js    - Precise analysis for judging excerpts (stub)
    instrument-context.js      - Instrument config, tuning tendency, pitch conversion
    audio-test.html            - Test harness for audio layers
    /lib/microdsp              - WASM pitch detection library
  instruments.js            - Instrument definitions (transposition, clef, range)
  screens.js                - Screen patterns (HoldPitchScreen, ChoiceScreen)
  game.js                   - State machine (proof-of-concept)
  ui.js                     - DOM manipulation (proof-of-concept)
  index.html                - Game UI (proof-of-concept)

/server
  server.js                 - Express server (serves static files)

/client/__tests__           - Vitest tests
```

## Architecture

### Audio Layer (well-structured)

The audio system uses a layered architecture:

1. **AudioWorklet** - Runs WASM (microdsp) for pitch detection and onset detection in real-time
2. **AudioInputManager** - Routes worklet messages to listeners, manages lifecycle
3. **LenientNoteListener** - Emits `noteStart`/`noteEnd` events with forgiving thresholds (for commands, instrument setup)
4. **PerformanceAnalyzer** - Buffers raw data during excerpt performance, matches against expectations (not yet implemented)
5. **InstrumentContext** - Singleton holding instrument config, tuning tendency (learned over time), pitch conversion utilities

### Instrument Setup vs Tuning Calibration

- **Instrument Setup**: Player plays their fundamental note; system detects instrument and configures transposition/clef in InstrumentContext
- **Tuning Calibration**: InstrumentContext learns the player's overall pitch tendency organically over time, adjusting expectations accordingly (no explicit user action required)

### Game Layer (proof-of-concept)

Current game code (game.js, ui.js, screens.js, index.html) is proof-of-concept to be iterated or replaced. Focus is on getting audio right first.

## Core Concepts

### Navigation via Audio
- **Instrument Setup**: Hold fundamental note to establish player's instrument and key
- **Confirm**: Sol-Do (5th down to root) - e.g., F→Bb for Bb instruments
- **Back**: Do-Sol (root up to 5th) - e.g., Bb→F for Bb instruments

### Instruments
Supports Bb, Eb, F, and C instruments with appropriate transposition and clef settings. See `instruments.js` for full list.

## Development

### Testing
```bash
npm test          # Run Vitest tests
```

### Debug Features
- `audio-test.html`: Visualize pitch detection, note events, instrument setup
- Console logging with `[AudioInputManager]`, `[LenientNoteListener]` prefixes

## Commands Reference

| Action  | Notes to Play | Example (Bb instrument) |
|---------|---------------|-------------------------|
| Confirm | Sol → Do      | F → Bb                  |
| Back    | Do → Sol      | Bb → F                  |

## Roadmap

See `plan.md` for development phases and open questions.
