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
  /audio                    - Audio detection system
    audio.js                - AudioInputManager: orchestrates worklet, routes to listeners
    audio-worklet-processor.js - Runs WASM pitch/onset detection
    lenient-note-listener.js   - Forgiving note detection for commands/calibration
    command-detector.js        - Gesture detection (sol-do confirm, do-sol cancel)
    performance-analyzer.js    - Precise analysis for judging excerpts
    instrument-context.js      - Instrument config, tuning tendency, pitch conversion
    audio-test.html            - Test harness for audio layers
    /lib/microdsp              - WASM pitch detection library
  instruments.js            - Instrument definitions (transposition, clef, range)
  /screens                  - Screen factory functions (instrument-setup, menu, countdown, etc.)
  game.js                   - Game class: state machine, screen navigation
  game-state.js             - State model (createInitialState, resetPlayerState)
  ui.js                     - DOM manipulation and visual feedback
  index.html                - Game UI

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
4. **CommandDetector** - Detects Sol-Do (confirm) and Do-Sol (cancel) gesture sequences for navigation
5. **PerformanceAnalyzer** - Buffers raw data during excerpt performance, matches detected notes against expectations
6. **InstrumentContext** - Singleton holding instrument config, tuning tendency (learned over time), pitch conversion utilities

### Instrument Setup vs Tuning Calibration

- **Instrument Setup**: Player holds fundamental note for 1.5s; system detects instrument and configures transposition/clef in InstrumentContext. After detection, player confirms instrument + clef choice, or silence returns to detection.
- **Tuning Calibration**: InstrumentContext tracks the player's overall pitch tendency, adjusting pitch detection boundaries accordingly. Tendency is updated via `instrumentContext.updateTendency()` which uses exponential moving average to weight recent samples

### Game Layer

Game class (game.js) owns state and screen navigation (navigate, goBack, replaceTo). Screens are factory functions in /screens returning `{ id, enter(), exit() }`. Each screen subscribes to audioManager in enter() and cleans up in exit().

### UI Principles

- **Minimal UI** — avoid introductory text, labels, and chrome. A start button, then the instrument drives everything.
- **No fixed-width container or status bar** — let the UI scale with the screen.
- **Show transposed pitches** — UI shows the instrument's written pitch (e.g., "G" not "Sol", "D" / "E" / "F" for menu options). Concert pitch may appear in parentheses.
- **Always-visible note indicator** — a small visual in the corner showing lenient listener activity (note detected, confirm/back gestures).
- **Debug panel** — keep the debug log visible during development.

## Core Concepts

### Navigation via Audio
- **Instrument Setup**: Hold fundamental note to establish player's instrument and key
- **Confirm**: Sol-Do (5th down to root) - e.g., G→C for Bb instruments (written pitch)
- **Back**: Do-Sol (root up to 5th) - e.g., C→G for Bb instruments (written pitch)
- **Menu selection**: Re / Mi / Fa (not Do, to avoid conflict with back gesture). Written pitches: D / E / F for Bb instruments.

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

| Action      | Solfege    | Bb instrument (written) |
|-------------|------------|-------------------------|
| Confirm     | Sol → Do   | G → C                   |
| Back        | Do → Sol   | C → G                   |
| Menu opt 1  | Re         | D                       |
| Menu opt 2  | Mi         | E                       |
| Menu opt 3  | Fa         | F                       |

## Roadmap

See `plan.md` for development phases and open questions.
