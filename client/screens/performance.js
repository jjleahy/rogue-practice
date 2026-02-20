/**
 * Performance Screen
 *
 * Player performs the excerpt. Uses PerformanceAnalyzer for precise
 * note matching, and LenientNoteListener for real-time visual feedback.
 *
 * CommandDetector is deactivated during performance.
 */

export function createPerformanceScreen(context) {
  const { game, audioManager, ui } = context;
  const unsubs = [];
  let playedNotes = [];
  let expectedNoteIndex = 0;

  return {
    id: 'performance',

    enter() {
      const excerpt = game.state.currentExcerpt;
      if (!excerpt) {
        ui.debugLog('ERROR: No excerpt set');
        game.replaceTo('menu');
        return;
      }

      playedNotes = [];
      expectedNoteIndex = 0;

      audioManager.commandDetector.deactivate();
      ui.showScreen('performance');
      ui.updateGameplayInstruction('Play!');

      // Set up PerformanceAnalyzer with expected notes
      const pa = audioManager.performanceAnalyzer;
      const beatDuration = 60000 / excerpt.bpm;
      const expectations = excerpt.notes.map((pitch, i) => ({
        pitch,
        ms: i * beatDuration,
        endMs: (i + 1) * beatDuration - 50,
      }));
      pa.setExpectations(expectations);
      pa.start();

      // Real-time feedback via LenientNoteListener
      unsubs.push(audioManager.lenientListener.onNoteStart(event => {
        if (expectedNoteIndex >= excerpt.notes.length) return;

        const expectedNote = excerpt.notes[expectedNoteIndex];
        const expectedClass = expectedNote.replace(/\d+$/, '');
        const isCorrect = event.pitchClass === expectedClass;

        playedNotes.push({
          note: event.pitchClass,
          expected: expectedClass,
          correct: isCorrect,
          cents: event.cents,
        });

        ui.updatePlayedNotes(playedNotes, excerpt.notes);
        ui.debugLog(`Played ${event.pitch}, expected ${expectedNote}: ${isCorrect ? 'HIT' : 'MISS'}`);

        expectedNoteIndex++;

        if (expectedNoteIndex >= excerpt.notes.length) {
          // All notes played — stop analyzer and show results
          setTimeout(() => {
            pa.stop();
            game.state.lastResult = pa.analyze();
            game.replaceTo('results');
          }, 500);
        }
      }));

      // Start visual metronome
      ui.startMetronome();
    },

    exit() {
      unsubs.forEach(fn => fn());
      unsubs.length = 0;
      ui.stopMetronome();

      // Make sure analyzer is stopped
      if (audioManager.performanceAnalyzer.isRecording()) {
        audioManager.performanceAnalyzer.stop();
      }
    },
  };
}
