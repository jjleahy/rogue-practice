/**
 * Results Screen
 *
 * Shows performance analysis results. Uses CommandDetector for navigation:
 * - Sol-Do: continue to next excerpt
 * - Do-Sol: back to menu
 */

export function createResultsScreen(context) {
  const { game, audioManager, ui } = context;
  const unsubs = [];

  return {
    id: 'results',

    enter() {
      const result = game.state.lastResult;
      const player = game.state.player;

      // Calculate scoring (accuracy is 0-100 from PerformanceAnalyzer)
      const accuracy = result ? result.accuracy : 0;
      const success = accuracy >= 50;
      let hpChange = 0;

      if (accuracy >= 90) hpChange = 20;
      else if (accuracy >= 70) hpChange = 10;
      else if (accuracy >= 50) hpChange = 0;
      else if (accuracy >= 30) hpChange = -10;
      else hpChange = -25;

      // Apply HP change
      player.hp = Math.max(0, Math.min(player.maxHp, player.hp + hpChange));

      // Update stats
      const notesCorrect = result ? result.notes.filter(n => n.matched).length : 0;
      const notesTotal = result ? result.notes.length : 0;

      if (success) {
        player.excerptsCompleted++;
        player.totalNotesHit += notesCorrect;
        player.currentStreak += notesCorrect;
        player.bestStreak = Math.max(player.bestStreak, player.currentStreak);
      } else {
        player.currentStreak = 0;
      }

      // Update UI
      ui.showScreen('results');
      ui.updateHP(player.hp, player.maxHp);
      ui.showResults({
        success,
        notesCorrect,
        notesTotal,
        timingScore: accuracy >= 70 ? 'Good' : accuracy >= 50 ? 'OK' : 'Needs Work',
        hpChange,
      });

      ui.debugLog(`Result: ${notesCorrect}/${notesTotal} (${accuracy}%), HP: ${hpChange >= 0 ? '+' : ''}${hpChange}`);

      // Check for game over
      if (player.hp <= 0) {
        setTimeout(() => game.replaceTo('game-over'), 2000);
        return;
      }

      // Navigation
      const cd = audioManager.commandDetector;
      cd.activate();

      unsubs.push(cd.onConfirm(() => {
        // Pick next excerpt and continue
        pickNextExcerpt();
        game.replaceTo('countdown');
      }));

      unsubs.push(cd.onCancel(() => {
        game.replaceTo('menu');
      }));
    },

    exit() {
      unsubs.forEach(fn => fn());
      unsubs.length = 0;
      audioManager.commandDetector.deactivate();
    },
  };

  function pickNextExcerpt() {
    const excerpts = [
      { name: 'Simple Scale Up', notes: ['C4', 'D4', 'E4', 'F4'], bpm: 60 },
      { name: 'Alternating Notes', notes: ['C4', 'E4', 'C4', 'E4', 'C4', 'E4'], bpm: 60 },
      { name: 'Scale Down', notes: ['G4', 'F4', 'E4', 'D4', 'C4'], bpm: 72 },
      { name: 'Arpeggio', notes: ['C4', 'E4', 'G4', 'C5'], bpm: 80 },
    ];
    game.state.currentExcerpt = excerpts[Math.floor(Math.random() * excerpts.length)];
    ui.debugLog(`Next excerpt: ${game.state.currentExcerpt.name}`);
  }
}
