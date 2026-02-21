/**
 * Game - State management and screen navigation
 *
 * Owns the game state, screen registry, and transition logic.
 * Screens are factory functions that subscribe to audioManager in enter()
 * and clean up in exit().
 */

import audioManager from './audio/audio.js';
import * as ui from './ui.js';
import { createInitialState, resetPlayerState } from './game-state.js';
import { createInstrumentSetupScreen } from './screens/instrument-setup.js';
import { createMenuScreen } from './screens/menu.js';
import { createCountdownScreen } from './screens/countdown.js';
import { createPerformanceScreen } from './screens/performance.js';
import { createResultsScreen } from './screens/results.js';
import { createGameOverScreen } from './screens/game-over.js';

class Game {
  constructor() {
    this.state = createInitialState();
    this._currentScreen = null;

    this._context = {
      game: this,
      audioManager,
      ui,
    };

    this._screenFactories = {
      'instrument-setup': createInstrumentSetupScreen,
      'menu': createMenuScreen,
      'countdown': createCountdownScreen,
      'performance': createPerformanceScreen,
      'results': createResultsScreen,
      'game-over': createGameOverScreen,
    };
  }

  async init() {
    ui.init();
    ui.showScreen('start');

    document.getElementById('start-button').addEventListener('click', () => {
      this._startAudio();
    });
  }

  async _startAudio() {
    ui.debugLog('Initializing audio...');

    const ok = await audioManager.init();
    if (!ok) {
      ui.debugLog('ERROR: Could not initialize audio');
      return;
    }

    await audioManager.start();
    ui.debugLog('Audio ready');

    this.navigate('instrument-setup');
  }

  /**
   * Navigate to a screen, pushing current onto stack for back navigation
   */
  navigate(screenId) {
    const factory = this._screenFactories[screenId];
    if (!factory) {
      ui.debugLog(`ERROR: Unknown screen: ${screenId}`);
      return;
    }

    if (this._currentScreen) {
      this._currentScreen.exit();
      this.state.screenStack.push(this.state.screenId);
    }

    this.state.screenId = screenId;
    this._currentScreen = factory(this._context);
    ui.debugLog(`Screen: ${screenId}`);
    this._currentScreen.enter();
  }

  /**
   * Go back to previous screen (pop stack)
   */
  goBack() {
    if (this.state.screenStack.length === 0) return;

    const prevId = this.state.screenStack.pop();
    if (this._currentScreen) {
      this._currentScreen.exit();
    }

    this.state.screenId = prevId;
    this._currentScreen = this._screenFactories[prevId](this._context);
    ui.debugLog(`Screen: ${prevId} (back)`);
    this._currentScreen.enter();
  }

  /**
   * Navigate without pushing to stack (no back support)
   */
  replaceTo(screenId) {
    const factory = this._screenFactories[screenId];
    if (!factory) {
      ui.debugLog(`ERROR: Unknown screen: ${screenId}`);
      return;
    }

    if (this._currentScreen) {
      this._currentScreen.exit();
    }

    this.state.screenId = screenId;
    this._currentScreen = factory(this._context);
    ui.debugLog(`Screen: ${screenId}`);
    this._currentScreen.enter();
  }

  /**
   * Reset player state for a new run
   */
  resetRun() {
    resetPlayerState(this.state);
  }
}

const game = new Game();

document.addEventListener('DOMContentLoaded', () => {
  game.init();
});

export default game;
