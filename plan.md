# Brass Roguelike - Development Plan

## Vision

A roguelike practice game where gameplay is controlled entirely via brass instrument + microphone. Guitar Hero meets roguelike meets deliberate practice.

**Core Loop**: Perform excerpt → judged on pitch/rhythm → gain/lose HP → rewards → next excerpt → permadeath if HP=0

---

## Development Areas

Development is iterative - focus on whichever area needs most attention at any time.

### Area 1: Audio Input Foundation
**Goal**: Reliable pitch detection with note onset/offset timing

- [x] Pitch detection (autocorrelation with parabolic interpolation)
- [x] Note onset detection (when a note starts)
- [x] Note offset detection (when a note ends or changes)
- [x] Calibration flow: detect held fundamental, establish key
- [x] Command recognition: detect sol-do and do-sol sequences
- [ ] Silence/gap detection (distinguish commands from noodling)
- [ ] Tune detection thresholds based on real instrument testing

**Test**: Play notes, see them detected with accurate start/end times in debug panel.

### Area 2: Visual Feedback & State
**Goal**: Silent metronome and game state display

- [x] Visual metronome (flashing beat dots)
- [x] State machine: calibration → menu → countdown → playing → results
- [x] HP display
- [x] Result feedback (pass/fail, score)
- [ ] Countoff display (visual "1-2-3-4" before excerpt starts) - basic version exists
- [ ] Hold-to-confirm visual feedback

**Test**: Start tempo, see visual flash on each beat correctly synced.

### Area 3: Excerpt Playback & Scoring
**Goal**: Play an excerpt, get judged

- [x] Simple excerpt format (array of note names)
- [x] Display expected notes (text)
- [x] Capture played notes
- [x] Compare played vs expected (pitch class match)
- [x] HP damage on mistakes, HP gain on good performance
- [ ] Timing detection (was note played on the beat?)
- [ ] More nuanced scoring (partial credit, timing quality)

**Test**: Display "C D E F", play it, see accurate judgment.

### Area 4: LilyPond Integration
**Goal**: Generate and display real notation

- [x] Node.js server setup (Express)
- [ ] LilyPond wrapper: input notes → output PNG with transparent background
- [ ] API endpoint to request excerpt image
- [ ] Frontend: load and display notation image
- [ ] Pass note/timing expectations alongside image (JSON)
- [ ] Decide: pre-generated library vs on-demand generation

**Test**: Server generates a scale image, browser displays it.

### Area 5: Excerpt Library & Generation
**Goal**: Variety of musical content

- [x] Hardcoded excerpts (4 test excerpts: scales, alternating, arpeggio)
- [ ] Excerpt metadata (difficulty, type, key, range)
- [ ] More hardcoded excerpts (10-20 across difficulty levels)
- [ ] Procedural generation (random intervals, rhythms within constraints)
- [ ] Difficulty parameters (tempo, length, rhythm complexity, interval size)
- [ ] Excerpt categories: warmup, technique, passages, bosses

### Area 6: Game Loop & Roguelike
**Goal**: Complete run experience

- [x] Run initialization (calibration → first excerpt)
- [x] Excerpt completion → results → next excerpt
- [x] Permadeath (HP=0 → game over)
- [ ] Difficulty scaling through run
- [ ] Random excerpt selection (weighted by difficulty, type)
- [ ] Reward system between excerpts (HP restore, looser grading, etc.)
- [ ] Run statistics tracking

---

## Immediate Next Steps

1. **Test with real instrument**
   - Run the game, go through calibration with actual brass instrument
   - Note any detection issues (false positives, missed notes, timing)
   - Adjust thresholds as needed

2. **Improve timing detection**
   - Track when notes are played relative to metronome beats
   - Score timing accuracy (early, on-time, late)

3. **Add more excerpts**
   - Simple patterns: more scales, arpeggios
   - Varied rhythms: half notes, eighth notes

4. **LilyPond proof of concept**
   - Install LilyPond
   - Write Node script to generate a single PNG from notes
   - Display in browser

---

## Open Questions

- What silence gap distinguishes "command" from "warmup noodling"?
- How strict should timing windows be at each difficulty level?
- How to handle cracked notes / false starts?
- Should excerpts loop for repetition practice, or always one-shot?
- How to display upcoming notes without overwhelming (scrolling? highlighting?)

---

## File Quick Reference

| File | Purpose |
|------|---------|
| `client/index.html` | Game UI, all screens |
| `client/audio.js` | Pitch detection, note tracking, commands |
| `client/ui.js` | DOM updates, metronome, debug panel |
| `client/game.js` | State machine, excerpts, scoring |
| `server/server.js` | Express server (placeholder) |

---

## Success Criteria: First Playable

A minimal version where you can:
1. ✅ Start the game, calibrate your instrument
2. ✅ See a simple excerpt (text: "C D E F")
3. ✅ See a visual metronome counting
4. ✅ Play the notes
5. ✅ Get feedback: notes correct, HP change
6. ✅ Progress to next excerpt or game over

**Status**: Core loop is functional. Ready for instrument testing and iteration.
