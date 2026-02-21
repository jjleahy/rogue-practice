/**
 * Instrument Setup Screen
 *
 * Player holds their fundamental note. System detects the pitch,
 * identifies matching instruments, and configures InstrumentContext.
 *
 * Uses lenientListener directly (CommandDetector stays deactivated
 * so held notes aren't interpreted as gestures).
 */

import { findInstrumentsByFundamental } from '../instruments.js';

const HOLD_DURATION_MS = 1500;

export function createInstrumentSetupScreen(context) {
  const { game, audioManager, ui } = context;
  const unsubs = [];

  let holdStartTime = null;
  let holdPitchClass = null;
  let holdOctave = null;
  let frequencies = [];
  let completed = false;
  let progressTimerId = null;

  function reset() {
    holdStartTime = null;
    holdPitchClass = null;
    holdOctave = null;
    frequencies = [];
    if (progressTimerId) {
      clearInterval(progressTimerId);
      progressTimerId = null;
    }
    ui.updateCalibrationStability(0);
    ui.updateCalibrationStatus('Play and hold your fundamental note...');
  }

  function startProgressTracking() {
    progressTimerId = setInterval(() => {
      if (!holdStartTime || completed) return;
      const elapsed = performance.now() - holdStartTime;
      const percent = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      ui.updateCalibrationStability(percent);

      if (elapsed >= HOLD_DURATION_MS && frequencies.length >= 3) {
        complete();
      }
    }, 50);
  }

  function complete() {
    if (completed) return;
    completed = true;

    if (progressTimerId) {
      clearInterval(progressTimerId);
      progressTimerId = null;
    }

    const avgFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const pitch = `${holdPitchClass}${holdOctave}`;
    const matches = findInstrumentsByFundamental(pitch);

    ui.updateCalibrationStability(100);

    if (matches.length > 0) {
      // Use first match (TODO: let player choose if ambiguous)
      const instrumentName = matches[0];
      audioManager.instrumentContext.setInstrument(instrumentName);
      game.state.instrumentReady = true;

      ui.updateCalibrationStatus(`Detected: ${instrumentName}`);
      ui.debugLog(`Instrument: ${instrumentName} (fundamental ${pitch} @ ${avgFrequency.toFixed(1)}Hz)`);
    } else {
      // No instrument match — set transposition manually to 0 (concert pitch)
      audioManager.instrumentContext.setTranspositionSemitones(0);
      game.state.instrumentReady = true;

      ui.updateCalibrationStatus(`Calibrated to ${pitch}`);
      ui.debugLog(`No instrument match for ${pitch}, using concert pitch`);
    }

    setTimeout(() => {
      if (game.state.screenId === 'instrument-setup') {
        game.navigate('menu');
      }
    }, 1000);
  }

  return {
    id: 'instrument-setup',

    enter() {
      completed = false;
      audioManager.commandDetector.deactivate();
      ui.showScreen('instrument-setup');
      ui.updateCalibrationPitch('-');
      reset();

      // noteStart: lock in the pitch we're tracking
      unsubs.push(audioManager.lenientListener.onNoteStart(event => {
        if (completed) return;

        ui.updateCalibrationPitch(event.pitch);

        if (holdPitchClass && holdPitchClass === event.pitchClass && holdOctave === event.octave) {
          // Same note restarted — keep going
          return;
        }

        // New note — start tracking
        holdPitchClass = event.pitchClass;
        holdOctave = event.octave;
        holdStartTime = performance.now();
        frequencies = [event.frequency];
        ui.updateCalibrationStability(0);
        ui.updateCalibrationStatus(`Hold ${event.pitch}...`);
        startProgressTracking();
      }));

      // pitchUpdate: accumulate frequency samples while note is held
      unsubs.push(audioManager.lenientListener.onPitchUpdate(data => {
        if (completed || !holdPitchClass || !data.isTone) return;
        if (data.frequencyHz) {
          frequencies.push(data.frequencyHz);
        }
      }));

      unsubs.push(audioManager.lenientListener.onNoteEnd(event => {
        if (completed) return;
        // Note ended before hold complete — reset
        reset();
      }));

      // Debug skip button
      const skipBtn = document.getElementById('skip-calibration');
      if (skipBtn) {
        const handler = () => {
          audioManager.instrumentContext.setTranspositionSemitones(0);
          game.state.instrumentReady = true;
          ui.debugLog('Setup skipped — using concert pitch');
          game.navigate('menu');
        };
        skipBtn.addEventListener('click', handler);
        unsubs.push(() => skipBtn.removeEventListener('click', handler));
      }
    },

    exit() {
      unsubs.forEach(fn => fn());
      unsubs.length = 0;
      if (progressTimerId) {
        clearInterval(progressTimerId);
        progressTimerId = null;
      }
    },
  };
}
