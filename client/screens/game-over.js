/**
 * Game Over Screen
 *
 * Shows run statistics. Sol-Do restarts from instrument setup.
 */

export function createGameOverScreen(context) {
  const { game, audioManager, ui } = context;
  const unsubs = [];

  return {
    id: 'game-over',

    enter() {
      const player = game.state.player;

      ui.showScreen('game-over');
      ui.showGameOver({
        excerptsCompleted: player.excerptsCompleted,
        totalNotes: player.totalNotesHit,
        bestStreak: player.bestStreak,
      });

      const cd = audioManager.commandDetector;
      cd.activate();

      unsubs.push(cd.onConfirm(() => {
        game.resetRun();
        game.replaceTo('menu');
      }));
    },

    exit() {
      unsubs.forEach(fn => fn());
      unsubs.length = 0;
      audioManager.commandDetector.deactivate();
    },
  };
}
