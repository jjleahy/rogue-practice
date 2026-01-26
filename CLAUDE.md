# Brass Roguelike

A browser-based roguelike practice game controlled entirely via brass instrument and microphone. No keyboard/mouse during gameplay - navigation and performance all through played notes.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

Or open `client/index.html` directly for client-only testing.

## Project Structure

```
/client
  index.html    - Game UI (calibration, menu, gameplay, results, game over)
  audio.js      - Pitch detection, note onset/offset tracking, command recognition
  ui.js         - DOM manipulation, visual metronome
  game.js       - State machine, game logic, excerpt handling

/server
  server.js     - Express server (serves static files, future LilyPond integration)
  excerpts/     - (future) Excerpt definitions

/shared         - (future) Shared types
```

## Core Concepts

### Navigation via Audio
- **Calibration**: Hold fundamental note for 1.5s to establish player's key
- **Confirm**: Sol-Do (5th down to root) - e.g., F→Bb for Bb instruments
- **Back**: Do-Sol (root up to 5th) - e.g., Bb→F for Bb instruments

### Game Flow
1. Calibration → detect and set instrument root
2. Menu → select options by playing pitches, confirm with Sol-Do
3. Gameplay → visual metronome counts, play excerpt, notes judged
4. Results → see accuracy, HP change
5. Game Over (if HP=0) or continue to next excerpt

### Judging (priority order)
1. Note detected in time window
2. Correct pitch (note class, octave-agnostic)
3. Rhythmic accuracy (timing relative to beat)
4. Intonation (cents deviation)

## Technical Details

### Audio Detection
- FFT size: 8192 for high frequency resolution
- RMS threshold: 0.005 (detects quiet sounds)
- Correlation threshold: 0.9 for reliable pitch
- Note hold time: 80ms minimum to register
- Frequency range: 50-2000 Hz

### State Machine States
- `INIT` → `CALIBRATION` → `MENU` → `COUNTDOWN` → `PLAYING` → `RESULTS` → (loop or `GAMEOVER`)

## Development Notes

### Debug Features
- Skip Calibration button: Sets C4 as root for testing without instrument
- Debug panel: Shows detected notes, commands, state transitions
- Console logging: `[Debug]` prefixed messages

### Current Limitations
- Excerpts are hardcoded (4 test excerpts)
- No LilyPond integration yet
- Timing judgment is basic (correct note = pass)
- No reward system between excerpts yet

## Roadmap

See plan.md for detailed development areas and next steps.

## Commands Reference

| Action  | Notes to Play | Example (Bb instrument) |
|---------|---------------|-------------------------|
| Confirm | Sol → Do      | F → Bb                  |
| Back    | Do → Sol      | Bb → F                  |
