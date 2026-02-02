/**
 * InstrumentContext - Shared context for instrument configuration and calibration
 *
 * Holds:
 * - Instrument name and configuration (from instruments.js)
 * - Transposition (semitones from concert pitch)
 * - Clef (treble/bass)
 * - Calibrated root frequency (player's fundamental)
 * - Global pitch tendency (learned over time)
 *
 * Used by both LenientNoteListener and PerformanceAnalyzer to:
 * - Convert between written and sounding pitch
 * - Calculate expected frequencies (with tendency correction)
 * - Determine intervals from calibrated root
 */

import { getInstrument, getInstrumentNames } from '../instruments.js';

// Note names using flats (matches brass convention)
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

class InstrumentContext {
  constructor() {
    // Current instrument name (key into INSTRUMENTS)
    this._instrumentName = null;

    // Transposition in semitones (from instrument config or manual override)
    this._transpositionSemitones = 0;

    // Clef (from instrument config or manual override)
    this._clef = 'treble';

    // Calibrated root - the player's fundamental note frequency in Hz
    // For Bb trumpet, this would be ~233 Hz (Bb3) when playing written C4
    this._calibratedRootHz = null;

    // Global pitch tendency in cents (positive = sharp, negative = flat)
    // Updated by PerformanceAnalyzer and successful calibrations
    this._globalTendencyCents = 0;

    // Number of samples used to calculate tendency (for weighted averaging)
    this._tendencySampleCount = 0;
  }

  // --- Configuration ---

  /**
   * Set the current instrument by name
   * @param {string} name - Instrument name (e.g., "Trumpet", "Euphonium")
   */
  setInstrument(name) {
    const config = getInstrument(name);
    if (!config) {
      throw new Error(`Unknown instrument: ${name}. Use one of: ${getInstrumentNames().join(', ')}`);
    }
    this._instrumentName = name;
    this._transpositionSemitones = config.transposition;
    this._clef = config.clef;
  }

  /**
   * Get current instrument name
   * @returns {string|null}
   */
  getInstrumentName() {
    return this._instrumentName;
  }

  /**
   * Get current instrument config
   * @returns {object|null}
   */
  getInstrumentConfig() {
    return this._instrumentName ? getInstrument(this._instrumentName) : null;
  }

  /**
   * Set transposition directly in semitones (for manual override)
   * @param {number} semitones - Semitones from concert pitch
   */
  setTranspositionSemitones(semitones) {
    this._transpositionSemitones = semitones;
    this._instrumentName = null; // Clear instrument since manually overridden
  }

  /**
   * Get current transposition in semitones
   * @returns {number}
   */
  getTranspositionSemitones() {
    return this._transpositionSemitones;
  }

  /**
   * Set clef directly (for manual override)
   * @param {string} clef - 'treble' or 'bass'
   */
  setClef(clef) {
    if (clef !== 'treble' && clef !== 'bass') {
      throw new Error(`Unknown clef: ${clef}. Use 'treble' or 'bass'`);
    }
    this._clef = clef;
  }

  /**
   * Get current clef
   * @returns {string}
   */
  getClef() {
    return this._clef;
  }

  /**
   * Set calibrated root from detected frequency
   * Called after player holds their fundamental note during calibration
   * @param {number} frequencyHz - The detected frequency
   */
  setCalibration(frequencyHz) {
    this._calibratedRootHz = frequencyHz;
  }

  /**
   * Get calibrated root frequency
   * @returns {number|null}
   */
  getCalibrationHz() {
    return this._calibratedRootHz;
  }

  /**
   * Check if instrument is calibrated
   * @returns {boolean}
   */
  isCalibrated() {
    return this._calibratedRootHz !== null;
  }

  /**
   * Clear calibration
   */
  clearCalibration() {
    this._calibratedRootHz = null;
  }

  // --- Pitch Tendency ---

  /**
   * Update global pitch tendency with a new sample
   * Uses exponential moving average to weight recent samples more heavily
   * @param {number} cents - Deviation from expected pitch in cents
   */
  updateTendency(cents) {
    this._tendencySampleCount++;
    // Exponential moving average with alpha based on sample count
    // Early samples have more weight, then stabilizes
    const alpha = Math.min(0.3, 1 / this._tendencySampleCount);
    this._globalTendencyCents = this._globalTendencyCents * (1 - alpha) + cents * alpha;
  }

  /**
   * Get current global pitch tendency
   * @returns {number} Cents offset (positive = tends sharp)
   */
  getTendencyCents() {
    return this._globalTendencyCents;
  }

  /**
   * Reset pitch tendency tracking
   */
  resetTendency() {
    this._globalTendencyCents = 0;
    this._tendencySampleCount = 0;
  }

  // --- Pitch Conversion ---

  /**
   * Convert written pitch to sounding pitch
   * @param {string} writtenPitch - e.g., 'C4', 'Bb3'
   * @returns {string} Sounding pitch
   */
  writtenToSounding(writtenPitch) {
    const { pitchClass, octave } = this._parsePitch(writtenPitch);
    return this._transposePitch(pitchClass, octave, this._transpositionSemitones);
  }

  /**
   * Convert sounding pitch to written pitch
   * @param {string} soundingPitch - e.g., 'Bb3', 'F4'
   * @returns {string} Written pitch
   */
  soundingToWritten(soundingPitch) {
    const { pitchClass, octave } = this._parsePitch(soundingPitch);
    return this._transposePitch(pitchClass, octave, -this._transpositionSemitones);
  }

  /**
   * Get expected frequency for a written pitch, accounting for tendency
   * @param {string} writtenPitch - e.g., 'C4', 'Bb3'
   * @returns {number} Expected frequency in Hz
   */
  expectedFrequency(writtenPitch) {
    const soundingPitch = this.writtenToSounding(writtenPitch);
    const baseFreq = this.pitchToFrequency(soundingPitch);
    // Apply tendency correction: if player tends +10 cents sharp, expect +10 cents
    return baseFreq * Math.pow(2, this._globalTendencyCents / 1200);
  }

  /**
   * Convert frequency to pitch name and cents deviation
   * Returns written pitch by default (factoring in instrument transposition)
   * @param {number} frequencyHz
   * @param {Object} [options]
   * @param {boolean} [options.concertPitch=false] - If true, return concert/sounding pitch instead of written
   * @returns {{ pitch: string, pitchClass: string, octave: number, cents: number, midiNote: number }}
   */
  frequencyToPitch(frequencyHz, options = {}) {
    // MIDI note number (can be fractional)
    const midiFloat = 12 * Math.log2(frequencyHz / 440) + 69;
    const midiRounded = Math.round(midiFloat);
    const cents = Math.round((midiFloat - midiRounded) * 100);

    const soundingPitchClass = NOTE_NAMES[((midiRounded % 12) + 12) % 12];
    const soundingOctave = Math.floor(midiRounded / 12) - 1;
    const soundingPitch = `${soundingPitchClass}${soundingOctave}`;

    // If concert pitch requested, return sounding pitch directly
    if (options.concertPitch) {
      return {
        pitch: soundingPitch,
        pitchClass: soundingPitchClass,
        octave: soundingOctave,
        cents,
        midiNote: midiRounded,
      };
    }

    // Default: return written pitch (apply inverse transposition)
    const writtenPitch = this.soundingToWritten(soundingPitch);
    const parsed = this._parsePitch(writtenPitch);
    return {
      pitch: writtenPitch,
      pitchClass: parsed.pitchClass,
      octave: parsed.octave,
      cents,
      midiNote: midiRounded,
      soundingPitch,  // Include sounding pitch for reference
    };
  }

  /**
   * Convert pitch name to frequency (A4 = 440Hz, no tendency adjustment)
   * @param {string} pitch - e.g., 'A4', 'Bb3'
   * @returns {number} Frequency in Hz
   */
  pitchToFrequency(pitch) {
    const { pitchClass, octave } = this._parsePitch(pitch);
    const noteIndex = NOTE_NAMES.indexOf(pitchClass);
    if (noteIndex === -1) {
      // Try sharp notation
      const sharpToFlat = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
      const flatEquiv = sharpToFlat[pitchClass];
      if (flatEquiv) {
        return this.pitchToFrequency(`${flatEquiv}${octave}`);
      }
      throw new Error(`Unknown pitch class: ${pitchClass}`);
    }
    const midiNumber = (octave + 1) * 12 + noteIndex;
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
  }

  /**
   * Get interval in semitones from calibrated root
   * Returns interval mod 12 (octave-agnostic) for command recognition
   * @param {number} frequencyHz
   * @returns {{ semitones: number, octaveAgnostic: number } | null}
   */
  getIntervalFromRoot(frequencyHz) {
    if (!this._calibratedRootHz) return null;

    const semitones = 12 * Math.log2(frequencyHz / this._calibratedRootHz);
    const rounded = Math.round(semitones);
    const octaveAgnostic = ((rounded % 12) + 12) % 12;

    return {
      semitones: rounded,
      octaveAgnostic,
    };
  }

  // --- Private Helpers ---

  /**
   * Parse pitch string into components
   * @param {string} pitch - e.g., 'Bb3', 'C#4'
   * @returns {{ pitchClass: string, octave: number }}
   */
  _parsePitch(pitch) {
    const match = pitch.match(/^([A-G][b#]?)(-?\d+)$/);
    if (!match) {
      throw new Error(`Invalid pitch format: ${pitch}`);
    }
    return {
      pitchClass: match[1],
      octave: parseInt(match[2], 10),
    };
  }

  /**
   * Transpose a pitch by semitones
   * @param {string} pitchClass
   * @param {number} octave
   * @param {number} semitones
   * @returns {string}
   */
  _transposePitch(pitchClass, octave, semitones) {
    let noteIndex = NOTE_NAMES.indexOf(pitchClass);
    if (noteIndex === -1) {
      // Handle sharps by converting to flats
      const sharpToFlat = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
      pitchClass = sharpToFlat[pitchClass] || pitchClass;
      noteIndex = NOTE_NAMES.indexOf(pitchClass);
    }

    const newIndex = noteIndex + semitones;
    const newNoteIndex = ((newIndex % 12) + 12) % 12;
    const octaveShift = Math.floor(newIndex / 12);

    return `${NOTE_NAMES[newNoteIndex]}${octave + octaveShift}`;
  }
}

// Singleton instance
const instrumentContext = new InstrumentContext();

export default instrumentContext;
export { InstrumentContext, NOTE_NAMES, getInstrumentNames };
