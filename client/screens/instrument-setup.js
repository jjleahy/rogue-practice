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
const STABILITY_THRESHOLD_SEMITONES = 2;

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

      // Listen for stable notes
      unsubs.push(audioManager.lenientListener.onNoteStart(event => {
        if (completed) return;

        ui.updateCalibrationPitch(event.pitch);

        // Check stability: is this the same pitch class we've been tracking?
        if (holdPitchClass && holdPitchClass === event.pitchClass && holdOctave === event.octave) {
          // Same note continuing — add frequency sample
          frequencies.push(event.frequency);

          const elapsed = performance.now() - holdStartTime;
          const percent = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
          ui.updateCalibrationStability(percent);
          ui.updateCalibrationStatus(`Hold ${event.pitch}... ${Math.round(elapsed)}ms`);
        } else {
          // Different note — check if it's close enough (stability threshold)
          if (holdPitchClass && event.frequency && frequencies.length > 0) {
            const lastFreq = frequencies[frequencies.length - 1];
            const semitonesDiff = Math.abs(12 * Math.log2(event.frequency / lastFreq));
            if (semitonesDiff > STABILITY_THRESHOLD_SEMITONES) {
              // Too different, restart
              reset();
            }
          }

          // Start tracking new note
          holdPitchClass = event.pitchClass;
          holdOctave = event.octave;
          holdStartTime = performance.now();
          frequencies = [event.frequency];
          ui.updateCalibrationStability(0);
          ui.updateCalibrationStatus(`Hold ${event.pitch}...`);
          startProgressTracking();
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
