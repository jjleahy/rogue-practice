/**
 * Game state model
 */

export function createInitialState() {
  return {
    screenId: 'init',
    screenStack: [],

    player: {
      hp: 100,
      maxHp: 100,
      excerptsCompleted: 0,
      totalNotesHit: 0,
      bestStreak: 0,
      currentStreak: 0,
    },

    currentExcerpt: null,
    lastResult: null,
    instrumentReady: false,
  };
}

export function resetPlayerState(state) {
  state.player = {
    hp: 100,
    maxHp: 100,
    excerptsCompleted: 0,
    totalNotesHit: 0,
    bestStreak: 0,
    currentStreak: 0,
  };
  state.screenStack = [];
  state.currentExcerpt = null;
  state.lastResult = null;
}
