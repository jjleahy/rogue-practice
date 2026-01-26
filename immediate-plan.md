# Immediate Next Steps

## Completed Phases:

### ✅ Phase 1: ES Module Refactor
- ✅ Convert audio.js to ES module (exported functions)
- ✅ Convert ui.js to ES module (exported functions)
- ✅ Convert game.js to ES module (imports Audio/UI)
- ✅ Remove game-container background (transparent)
- ✅ Remove command-hint CSS and HTML element
- ✅ Update script tags to `type="module"` and only load game.js
- ✅ Test in browser - verified working

### ✅ Phase 3: Add Vitest + Tests
- ✅ Installed Vitest and jsdom as dev dependencies
- ✅ Added `"type": "module"` to package.json
- ✅ Added test script to package.json
- ✅ Created vitest.config.js
- ✅ Created `client/__tests__/audio.test.js` with 29 tests
- ✅ All tests passing (noteToFrequency, frequencyToNoteInfo, getCentsFromFrequency, sameNoteClass, getIntervalFromRoot, checkCommand)

### ✅ Phase 4: Flats Instead of Sharps
- ✅ Changed NOTE_STRINGS in audio.js to use flats (Db, Eb, Gb, Ab, Bb)
- ✅ Updated sameNoteClass() to handle enharmonic equivalents (C# ↔ Db, etc.)
- ✅ Updated noteToFrequency() to convert sharps to flats
- ✅ Updated tests with enharmonic test cases
- ✅ All 39 tests passing

### ✅ Phase 5: Instrument Mapping Config
- ✅ Created `client/instruments.js`
- ✅ Mapped fundamentals (Bb2, Eb3, F3) to clef/transposition options:
  - Bb2: C Bass Clef (no transposition) & Bb Treble Clef (-14 semitones)
  - Eb3: Eb Treble Clef (-9 semitones)
  - F3: F Treble Clef (-7 semitones)
- ✅ Added helper functions: getInstrumentByFundamental, getSupportedFundamentals, findClosestFundamental

### ✅ Phase 6: Screen Patterns
- ✅ Created `client/screens.js` with base Screen class
- ✅ Implemented HoldPitchScreen pattern (for calibration-like flows)
- ✅ Implemented ChoiceScreen pattern (for menu-like selection)
- ✅ Added ScreenManager to route audio callbacks
- ✅ Refactored calibration to use HoldPitchScreen
- ✅ All tests passing (67 total: 39 audio.test.js + 28 screens.test.js)

## Next Phases (From Plan):

### Phase 7: Two-Step Calibration
- Add CALIBRATION_CLEF state
- Detect fundamental → show options
- Choose clef/transposition
- Apply transposition to all note display

### Phase 8: Debug Improvements (Defer)
- Better visibility
- Timeline view

## Plan File Location
Full plan: `C:\Users\john\.claude\plans\deep-puzzling-book.md`
