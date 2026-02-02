# Rogue Practice - Development Plan

## Vision

A roguelike practice game where gameplay is controlled entirely via brass instrument + microphone. Guitar Hero meets roguelike meets deliberate practice.

**Core Loop**: Perform excerpt → judged on pitch/rhythm/intonation → gain/lose HP → rewards → next excerpt → permadeath if HP=0

---

## Current State

### Audio Layer ✓
- AudioWorklet with WASM (microdsp) for pitch/onset detection
- LenientNoteListener working well for forgiving note detection
- InstrumentContext with instrument config and pitch conversion
- audio-test.html for testing and visualization

### Needs Work
- **Tuning calibration** - InstrumentContext has tendency tracking, but not yet wired up to learn from performance
- **PerformanceAnalyzer** - Stub only, needs implementation for excerpt judging
- **Command detection** - Sol-Do/Do-Sol recognition not yet built on top of LenientNoteListener

### Proof-of-Concept (to iterate/replace)
- Game state machine (game.js)
- Screens (screens.js, index.html)
- UI (ui.js)
- Excerpt handling and display

---

## Development Phases

Development is iterative - focus on whichever area needs most attention.

### Phase 1: Audio Detection & Testing
*Current focus*

- [x] Pitch detection (WASM microdsp)
- [x] LenientNoteListener for stable note events
- [x] InstrumentContext for instrument config
- [x] audio-test.html test harness
- [ ] Tune LenientNoteListener thresholds based on real instrument testing
- [ ] Wire up tuning tendency learning in InstrumentContext

### Phase 2: Performance Analyzer
- [ ] Implement PerformanceAnalyzer.analyze() algorithm
- [ ] Segment pitch buffer into detected notes
- [ ] Match detected notes to expected notes (best-fit)
- [ ] Handle octave errors by checking pitch class
- [ ] Calculate timing and intonation errors
- [ ] Test with looping major scale at 80 BPM via audio-test.html

### Phase 3: Command Detection
- [ ] Build command detector on top of LenientNoteListener
- [ ] Detect Sol-Do (confirm) and Do-Sol (back) sequences
- [ ] Handle silence gaps to distinguish commands from noodling
- [ ] Test command recognition via audio-test.html or dedicated page

### Phase 4: Instrument Setup Flow
- [ ] Design instrument setup screen (play fundamental, detect instrument)
- [ ] Integrate with InstrumentContext
- [ ] Handle edge cases (wrong note, timeout, multiple instruments with same fundamental)

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
