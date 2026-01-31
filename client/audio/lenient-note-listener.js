/**
 * LenientNoteListener - Forgiving note detection for commands and calibration
 *
 * Receives raw pitch messages from worklet and emits clean note events.
 * Designed to be forgiving of:
 * - Brief pitch detection blips
 * - Momentary signal dropouts
 * - Attack transients before pitch stabilizes
 *
 * Outputs note start/end events with:
 * - Pitch class (octave-agnostic for commands)
 * - Full pitch (with octave for calibration)
 * - Average frequency and cents deviation
 *
 * Algorithm:
 * 1. Track when pitch becomes stable (consistent for MIN_STABLE_TIME)
 * 2. Emit noteStart when pitch is stable
 * 3. Emit noteEnd when pitch changes or silence exceeds threshold
 *
 * Note: Onset detection is NOT used here - it's reserved for PerformanceAnalyzer
 * which needs precise timing. LenientNoteListener just needs stable pitch events.
 */

import instrumentContext from './instrument-context.js';

// Configuration
const CONFIG = {
  // Minimum time (ms) pitch must be stable before emitting noteStart
  // Shorter = more responsive, but more false positives
  MIN_STABLE_TIME_MS: 80,

  // Silence duration (ms) before considering note ended
  SILENCE_THRESHOLD_MS: 120,

  // Pitch change threshold in semitones to consider it a new note
  PITCH_CHANGE_THRESHOLD: 1.2,

  // Minimum clarity for pitch to be considered valid
  MIN_CLARITY: 0.7,
};

class LenientNoteListener {
  constructor() {
    // Current note state
    this._currentNote = null;  // { pitch, pitchClass, frequency, startTime, frequencies: [] }
    this._noteStartEmitted = false;

    // Tracking for pitch stability
    this._stablePitchStart = null;  // wallTime when current pitch became stable
    this._lastValidPitchTime = null;  // wallTime of last valid pitch detection

    // Callbacks
    this._onNoteStart = null;
    this._onNoteEnd = null;
    this._onPitchUpdate = null;  // Raw pitch updates (for visualization)

    // Enabled state
    this._enabled = true;
  }

  // --- Configuration ---

  /**
   * Update configuration options
   * @param {Partial<typeof CONFIG>} options
   */
  configure(options) {
    Object.assign(CONFIG, options);
  }

  /**
   * Enable/disable the listener
   * When disabled, no events are emitted
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this._resetState();
    }
  }

  isEnabled() {
    return this._enabled;
  }

  // --- Callbacks ---

  /**
   * Set callback for note start events
   * @param {function} callback - Receives note event object
   */
  onNoteStart(callback) {
    this._onNoteStart = callback;
  }

  /**
   * Set callback for note end events
   * @param {function} callback - Receives note event object with duration
   */
  onNoteEnd(callback) {
    this._onNoteEnd = callback;
  }

  /**
   * Set callback for raw pitch updates (for visualization)
   * @param {function} callback - Receives raw pitch data
   */
  onPitchUpdate(callback) {
    this._onPitchUpdate = callback;
  }

  // --- Input from worklet ---

  /**
   * Handle pitch message from worklet
   * @param {Object} data - { frequencyHz, clarity, midiNoteNumber, isTone, audioTime }
   */
  handlePitch(data) {
    const wallTime = performance.now();

    // Notify raw pitch callback
    if (this._onPitchUpdate) {
      this._onPitchUpdate(data);
    }

    if (!this._enabled) return;

    // Check if this is a valid pitch reading
    const isValid = data.isTone && data.clarity >= CONFIG.MIN_CLARITY;

    if (isValid) {
      this._handleValidPitch(data, wallTime);
    } else {
      this._handleInvalidPitch(wallTime);
    }
  }

  /**
   * Handle level message from worklet (currently unused, but available)
   * @param {Object} data - { rms, audioTime }
   */
  handleLevel(data) {
    // Could be used for silence detection, but we rely on pitch detection for now
  }

  // --- Internal processing ---

  _handleValidPitch(data, wallTime) {
    const { frequencyHz, midiNoteNumber } = data;
    const pitchInfo = instrumentContext.frequencyToPitch(frequencyHz);

    this._lastValidPitchTime = wallTime;

    if (this._currentNote === null) {
      // Starting a new potential note
      this._startPotentialNote(pitchInfo, frequencyHz, wallTime);
    } else {
      // Check if this is the same note or a different one
      const semitonesDiff = Math.abs(midiNoteNumber - this._currentNote.midiNote);

      if (semitonesDiff > CONFIG.PITCH_CHANGE_THRESHOLD) {
        // Pitch changed significantly - end current note and start new one
        this._endCurrentNote(wallTime);
        this._startPotentialNote(pitchInfo, frequencyHz, wallTime);
      } else {
        // Same note - accumulate frequency data
        this._currentNote.frequencies.push(frequencyHz);

        // Check if we should emit noteStart (if not already emitted)
        if (!this._noteStartEmitted) {
          const stableDuration = wallTime - this._stablePitchStart;
          if (stableDuration >= CONFIG.MIN_STABLE_TIME_MS) {
            this._emitNoteStart(wallTime);
          }
        }
      }
    }
  }

  _handleInvalidPitch(wallTime) {
    if (this._currentNote === null) return;

    // Check if silence has exceeded threshold
    if (this._lastValidPitchTime !== null) {
      const silenceDuration = wallTime - this._lastValidPitchTime;
      if (silenceDuration >= CONFIG.SILENCE_THRESHOLD_MS) {
        this._endCurrentNote(wallTime);
      }
    }
  }

  _startPotentialNote(pitchInfo, frequencyHz, wallTime) {
    this._currentNote = {
      pitch: pitchInfo.pitch,
      pitchClass: pitchInfo.pitchClass,
      octave: pitchInfo.octave,
      midiNote: pitchInfo.midiNote,
      frequencies: [frequencyHz],
      potentialStartTime: wallTime,
    };
    this._stablePitchStart = wallTime;
    this._noteStartEmitted = false;
  }

  _emitNoteStart(wallTime) {
    if (!this._currentNote || this._noteStartEmitted) return;

    const avgFrequency = this._getAverageFrequency();
    const pitchInfo = instrumentContext.frequencyToPitch(avgFrequency);

    // Use when pitch became stable as start time
    this._currentNote.startTime = this._stablePitchStart;
    this._currentNote.frequency = avgFrequency;
    this._noteStartEmitted = true;

    if (this._onNoteStart) {
      this._onNoteStart({
        type: 'noteStart',
        pitch: pitchInfo.pitch,
        pitchClass: pitchInfo.pitchClass,
        octave: pitchInfo.octave,
        frequency: avgFrequency,
        cents: pitchInfo.cents,
        startTime: this._stablePitchStart,
        interval: instrumentContext.getIntervalFromRoot(avgFrequency),
      });
    }
  }

  _endCurrentNote(wallTime) {
    if (!this._currentNote) return;

    const avgFrequency = this._getAverageFrequency();
    const pitchInfo = instrumentContext.frequencyToPitch(avgFrequency);

    // Only emit noteEnd if we emitted noteStart
    if (this._noteStartEmitted && this._onNoteEnd) {
      const duration = wallTime - this._currentNote.startTime;

      this._onNoteEnd({
        type: 'noteEnd',
        pitch: pitchInfo.pitch,
        pitchClass: pitchInfo.pitchClass,
        octave: pitchInfo.octave,
        frequency: avgFrequency,
        cents: pitchInfo.cents,
        startTime: this._currentNote.startTime,
        endTime: wallTime,
        duration: duration,
        interval: instrumentContext.getIntervalFromRoot(avgFrequency),
      });
    }

    this._currentNote = null;
    this._noteStartEmitted = false;
    this._stablePitchStart = null;
  }

  _getAverageFrequency() {
    if (!this._currentNote || this._currentNote.frequencies.length === 0) {
      return 0;
    }
    const sum = this._currentNote.frequencies.reduce((a, b) => a + b, 0);
    return sum / this._currentNote.frequencies.length;
  }

  _resetState() {
    this._currentNote = null;
    this._noteStartEmitted = false;
    this._stablePitchStart = null;
    this._lastValidPitchTime = null;
  }

  // --- Public methods ---

  /**
   * Reset state
   */
  reset() {
    this._resetState();
  }

  /**
   * Get current note if one is active
   * @returns {Object|null}
   */
  getCurrentNote() {
    if (!this._currentNote || !this._noteStartEmitted) return null;

    const avgFrequency = this._getAverageFrequency();
    const pitchInfo = instrumentContext.frequencyToPitch(avgFrequency);

    return {
      pitch: pitchInfo.pitch,
      pitchClass: pitchInfo.pitchClass,
      frequency: avgFrequency,
      cents: pitchInfo.cents,
      startTime: this._currentNote.startTime,
      duration: performance.now() - this._currentNote.startTime,
      interval: instrumentContext.getIntervalFromRoot(avgFrequency),
    };
  }

  /**
   * Check if currently detecting a note
   * @returns {boolean}
   */
  isNoteActive() {
    return this._noteStartEmitted && this._currentNote !== null;
  }
}

export default LenientNoteListener;
export { LenientNoteListener, CONFIG as LENIENT_CONFIG };
