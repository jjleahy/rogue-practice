/**
 * TODO: Write tests for the new screen system (screens/ directory).
 * Each screen is a factory function that subscribes to audioManager
 * listeners in enter() and cleans up in exit().
 */

import { describe, it } from 'vitest';

describe('screens', () => {
  it.todo('instrument-setup screen detects held fundamental and configures instrument');
  it.todo('menu screen activates CommandDetector and responds to options/confirm/cancel');
  it.todo('countdown screen counts down beats then navigates to performance');
  it.todo('performance screen wires PerformanceAnalyzer and tracks notes');
  it.todo('results screen displays accuracy and applies HP changes');
  it.todo('game-over screen shows stats and allows restart');
  it.todo('screen exit() cleans up all audio subscriptions');
});
