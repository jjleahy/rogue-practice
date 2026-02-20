/**
 * Countdown Screen
 *
 * Shows a countdown before excerpt performance begins.
 * Uses the excerpt's BPM for countdown timing.
 */

export function createCountdownScreen(context) {
  const { game, audioManager, ui } = context;
  let timerId = null;

  return {
    id: 'countdown',

    enter() {
      const excerpt = game.state.currentExcerpt;
      const beatInterval = 60000 / (excerpt?.bpm || 60);

      audioManager.commandDetector.deactivate();
      ui.showScreen('countdown');
      ui.clearPlayedNotes();

      if (excerpt) {
        ui.displayExcerpt(excerpt.notes.map(n => n.replace(/\d+$/, '')));
        ui.setTempo(excerpt.bpm);
      }

      let count = 4;
      ui.updateGameplayInstruction(`Starting in ${count}...`);

      timerId = setInterval(() => {
        count--;
        if (count > 0) {
          ui.updateGameplayInstruction(`Starting in ${count}...`);
        } else {
          clearInterval(timerId);
          timerId = null;
          game.replaceTo('performance');
        }
      }, beatInterval);
    },

    exit() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    },
  };
}
