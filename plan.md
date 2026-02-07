# Rogue Practice - Development Plan

## Vision

A roguelike practice game where gameplay is controlled entirely via brass instrument + microphone. Guitar Hero meets roguelike meets deliberate practice.

**Core Loop**: Perform excerpt → judged on pitch/rhythm/intonation → gain/lose HP → rewards → next excerpt → permadeath if HP=0

---

## Current State

### Audio Layer ✓
- AudioWorklet with WASM (microdsp) for pitch/onset detection
- LenientNoteListener working well for forgiving note detection
- CommandDetector for Sol-Do/Do-Sol gesture recognition
- InstrumentContext with instrument config and pitch conversion
- Tuning calibration via InstrumentContext tendency tracking (exponential moving average)
- PerformanceAnalyzer with note segmentation, onset refinement, and best-fit matching
- audio-test.html for testing and visualization

### Needs Work
- **Instrument setup flow** - Fundamental note detection to auto-configure instrument

### Proof-of-Concept (to iterate/replace)
- Game state machine (game.js)
- Screens (screens.js, index.html)
- UI (ui.js)
- Excerpt handling and display

---

## Development Phases

Development is iterative - focus on whichever area needs most attention.

### Phase 1: Audio Detection & Testing

- [x] Pitch detection (WASM microdsp)
- [x] LenientNoteListener for stable note events
- [x] InstrumentContext for instrument config
- [x] Tuning tendency tracking in InstrumentContext
- [x] audio-test.html test harness
- [ ] Tune LenientNoteListener thresholds based on real instrument testing

### Phase 2: Performance Analyzer

- [x] Implement PerformanceAnalyzer.analyze() algorithm
- [x] Segment pitch buffer into detected notes
- [x] Match detected notes to expected notes (best-fit)
- [x] Handle octave errors by checking pitch class
- [x] Calculate timing and intonation errors
- [x] Test with looping major scale at 80 BPM via audio-test.html
- [ ] Iterate on matching algorithm thresholds and edge cases

### Phase 3: Command Detection

- [x] Build command detector on top of LenientNoteListener
- [x] Detect Sol-Do (confirm) and Do-Sol (cancel) sequences
- [x] Handle silence gaps via minimum note duration (400ms threshold)
- [x] Test command recognition via audio-test.html
- [x] Implement multi-listener pattern for extensibility
- [ ] Iterate on thresholds and edge cases based on real instrument testing

### Phase 4: Instrument Setup Flow
- [ ] Design instrument setup screen (play fundamental, detect instrument)
- [ ] Integrate with InstrumentContext
- [ ] Handle edge cases (wrong note, timeout, multiple instruments with same fundamental)
- [ ] Wire up tuning tendency updates from performance results

### Phase 5: Game State & Screens
- [ ] Iterate on screen patterns (or replace)
- [ ] Test that commands navigate between screens
- [ ] Minimal visual design (positioned text, notes, simple metronome)

### Phase 6: Game Mechanics & Exercise Generation
- [ ] Design HP/scoring system
- [ ] Create exercise/excerpt format
- [ ] Build exercise generation or library
- [ ] Implement difficulty progression
- [ ] Test and iterate on what makes practice engaging

---

## Open Questions

### Audio
- What will end up working / not working? Can microphones and current algorithms make a good enough experience, or will players feel like the microphone isn't precise enough? What can I do to work around those limitations?

### Game Design
- How strict should timing windows be at each difficulty level?
- Should excerpts loop for repetition practice, or always one-shot?
- How to display upcoming notes without overwhelming?
- How to intermix open-ended practicing with structured challenge stages?
- What reward systems work between excerpts?

### Technical
- What patterns/frameworks make sense as complexity grows?
- When to add more unit tests vs integration testing via test pages?

---

## Future Ideas (brainstorming)

These are just ideas to explore - all require testing and experimentation.

### Stage Types
- **Open practice stages** - try to play a pattern accurately as many times as one can within three minutes, regardless of speed?
- **Rhythm/intonation practice** - precise pitch/rhythm required, even if others are judged less
- **Boost the metronome stages** - every time you play the lick correct, metronome +3, everytime missed, metronome -5, get the metronome as high as possible in three minutes
- **Specific skill/pitch patterns** - based on the hardest bits, get specific exercises on the consistently failed notes
- **Boss stages** - demonstrate proficiency of all the previous exercises combined

### Mechanics
- Is there an HP system or something else that determines how long someone can continue?
- Rewards between stages (HP/status restore, looser grading, more practice iterations, being able to warp ahead)
- Run statistics and history
- Difficulty scaling through a run
- Procedural exercise generation

### Polish
- LilyPond integration for notation display
- Visual metronome refinements
- Progress tracking across sessions
