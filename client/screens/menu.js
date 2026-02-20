/**
 * Menu Screen
 *
 * Uses CommandDetector for navigation:
 * - Options (re/mi/fa) highlight menu items
 * - Sol-Do confirms highlighted option
 * - Do-Sol goes back (to instrument setup)
 */

export function createMenuScreen(context) {
  const { game, audioManager, ui } = context;
  const unsubs = [];

  let highlightedIndex = -1;

  const menuActions = [
    { solfege: 'do', label: 'Start New Run', action: () => startRun() },
    { solfege: 're', label: 'Free Practice', action: () => ui.debugLog('Free Practice not yet implemented') },
    { solfege: 'mi', label: 'Settings', action: () => ui.debugLog('Settings not yet implemented') },
  ];

  function startRun() {
    game.resetRun();
    pickExcerpt();
    game.navigate('countdown');
  }

  function pickExcerpt() {
    // Hardcoded test excerpts (to be replaced with proper exercise system)
    const excerpts = [
      { name: 'Simple Scale Up', notes: ['C4', 'D4', 'E4', 'F4'], bpm: 60 },
      { name: 'Alternating Notes', notes: ['C4', 'E4', 'C4', 'E4', 'C4', 'E4'], bpm: 60 },
      { name: 'Scale Down', notes: ['G4', 'F4', 'E4', 'D4', 'C4'], bpm: 72 },
      { name: 'Arpeggio', notes: ['C4', 'E4', 'G4', 'C5'], bpm: 80 },
    ];

    const difficulty = Math.ceil(game.state.player.excerptsCompleted / 2) + 1;
    game.state.currentExcerpt = excerpts[Math.floor(Math.random() * excerpts.length)];
    ui.debugLog(`Excerpt: ${game.state.currentExcerpt.name}`);
  }

  return {
    id: 'menu',

    enter() {
      highlightedIndex = -1;
      const cd = audioManager.commandDetector;
      cd.activate();
      cd.setActiveOptions(['do', 're', 'mi']);

      ui.showScreen('menu');
      ui.clearMenuHighlight();
      ui.updateHP(game.state.player.hp, game.state.player.maxHp);

      unsubs.push(cd.onOption(({ solfege }) => {
        const idx = menuActions.findIndex(a => a.solfege === solfege);
        if (idx >= 0) {
          highlightedIndex = idx;
          ui.highlightMenuOption(idx);
        }
      }));

      unsubs.push(cd.onConfirm(() => {
        if (highlightedIndex >= 0) {
          menuActions[highlightedIndex].action();
        } else {
          // No option highlighted — default to start run
          menuActions[0].action();
        }
      }));

      unsubs.push(cd.onCancel(() => {
        game.goBack();
      }));
    },

    exit() {
      unsubs.forEach(fn => fn());
      unsubs.length = 0;
      audioManager.commandDetector.deactivate();
    },
  };
}
