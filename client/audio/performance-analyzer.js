/**
 * PerformanceAnalyzer - Closely-listening mode for judging played excerpts
 *
 * Receives raw worklet messages and expected note sequence, then performs
 * detailed analysis to match played notes against expectations.
 *
 * Responsibilities:
 * - Buffer raw pitch/onset events during performance
 * - Accept expected notes with timing (written pitch, converted to frequencies)
 * - Perform best-fit matching after performance ends
 * - Correct for octave errors using expected pitch context
 * - Work backwards from pitch to find likely onset times
 * - Report per-note accuracy (timing, pitch, intonation)
 *
 * NOT YET IMPLEMENTED - This is a stub with documented interface.
 * The analyze() method currently returns mock data.
 */

import instrumentContext from './instrument-context.js';

/**
 * @typedef {Object} ExpectedNote
 * @property {string} pitch - Written pitch, e.g., 'Bb4', 'C5'
 * @property {number} ms - Start time in ms from performance start
 * @property {number} endMs - End time in ms from performance start
 */

/**
 * @typedef {Object} AnalyzedNote
 * @property {string} expected - Expected written pitch
 * @property {string|null} detected - Detected pitch (null if missed)
 * @property {number} expectedMs - Expected start time
 * @property {number|null} detectedMs - Detected start time
 * @property {number} timingErrorMs - Timing error (positive = late)
 * @property {number} cents - Intonation error in cents
 * @property {boolean} matched - Whether note was correctly identified
 * @property {boolean} octaveError - Whether pitch was correct but wrong octave
 */

/**
 * @typedef {Object} PerformanceResult
 * @property {AnalyzedNote[]} notes - Analysis of each expected note
 * @property {Object[]} extraNotes - Notes played that weren't expected
 * @property {string[]} missedNotes - Expected notes that weren't played
 * @property {number} accuracy - Overall accuracy percentage
 * @property {number} averageTimingError - Average timing error in ms
 * @property {number} averageCentsError - Average intonation error in cents
 */

class PerformanceAnalyzer {
  constructor() {
    // Buffered raw events during performance
    this._pitchBuffer = [];
    this._onsetBuffer = [];

    // Expected notes (converted to frequencies)
    this._expectations = null;

    // Performance timing
    this._startTime = null;
    this._isRecording = false;

    // Callbacks
    this._onAnalysisComplete = null;
  }

  // --- Configuration ---

  /**
   * Set expected notes for the performance
   * Notes should be in written pitch; they will be converted to expected frequencies
   * using InstrumentContext (transposition + pitch tendencies)
   *
   * @param {ExpectedNote[]} notes - Array of expected notes
   *
   * @example
   * analyzer.setExpectations([
   *   { pitch: 'Bb4', ms: 0, endMs: 450 },
   *   { pitch: 'C5', ms: 500, endMs: 950 },
   *   { pitch: 'D5', ms: 1000, endMs: 1450 },
   * ]);
   */
  setExpectations(notes) {
    // Convert written pitches to expected frequencies
    this._expectations = notes.map(note => ({
      ...note,
      expectedFrequency: instrumentContext.expectedFrequency(note.pitch),
      soundingPitch: instrumentContext.writtenToSounding(note.pitch),
    }));
  }

  /**
   * Get current expectations (for debugging)
   * @returns {Object[]|null}
   */
  getExpectations() {
    return this._expectations;
  }

  // --- Recording Control ---

  /**
   * Start recording performance
   * Call this when the excerpt playback begins
   * @param {number} [referenceTime] - Optional reference time (defaults to performance.now())
   */
  start(referenceTime = performance.now()) {
    this._pitchBuffer = [];
    this._onsetBuffer = [];
    this._startTime = referenceTime;
    this._isRecording = true;
  }

  /**
   * Stop recording performance
   * Call this when the excerpt ends
   */
  stop() {
    this._isRecording = false;
  }

  /**
   * Check if currently recording
   * @returns {boolean}
   */
  isRecording() {
    return this._isRecording;
  }

  // --- Input from worklet ---

  /**
   * Handle pitch message from worklet
   * Only buffers if recording is active
   * @param {Object} data - { frequencyHz, clarity, midiNoteNumber, isTone, audioTime }
   */
  handlePitch(data) {
    if (!this._isRecording) return;

    const relativeTime = performance.now() - this._startTime;
    this._pitchBuffer.push({
      ...data,
      relativeTime,
      wallTime: performance.now(),
    });
  }

  /**
   * Handle onset message from worklet
   * @param {Object} data - { novelty, audioTime }
   */
  handleOnset(data) {
    if (!this._isRecording) return;

    const relativeTime = performance.now() - this._startTime;
    this._onsetBuffer.push({
      ...data,
      relativeTime,
      wallTime: performance.now(),
    });
  }

  // --- Analysis ---

  /**
   * Analyze the recorded performance against expectations
   * Call after stop() to get results
   *
   * @returns {PerformanceResult}
   *
   * TODO: Implement actual analysis algorithm:
   * 1. Segment pitch buffer into detected notes
   * 2. Correlate detected notes with onset events
   * 3. Match detected notes to expected notes (best-fit graph)
   * 4. Handle octave errors by checking pitch class match
   * 5. Calculate timing and intonation errors
   * 6. Update InstrumentContext pitch tendencies
   */
  analyze() {
    if (!this._expectations || this._expectations.length === 0) {
      return {
        notes: [],
        extraNotes: [],
        missedNotes: [],
        accuracy: 0,
        averageTimingError: 0,
        averageCentsError: 0,
      };
    }

    // TODO: Implement actual analysis
    // For now, return stub data indicating not implemented
    console.warn('[PerformanceAnalyzer] analyze() not yet implemented - returning stub data');

    const stubNotes = this._expectations.map(exp => ({
      expected: exp.pitch,
      detected: null,
      expectedMs: exp.ms,
      detectedMs: null,
      timingErrorMs: 0,
      cents: 0,
      matched: false,
      octaveError: false,
    }));

    return {
      notes: stubNotes,
      extraNotes: [],
      missedNotes: this._expectations.map(e => e.pitch),
      accuracy: 0,
      averageTimingError: 0,
      averageCentsError: 0,
      _debug: {
        pitchEventsRecorded: this._pitchBuffer.length,
        onsetEventsRecorded: this._onsetBuffer.length,
        durationMs: this._pitchBuffer.length > 0
          ? this._pitchBuffer[this._pitchBuffer.length - 1].relativeTime
          : 0,
      },
    };
  }

  /**
   * Set callback for when analysis completes
   * (For future async analysis support)
   * @param {function} callback
   */
  onAnalysisComplete(callback) {
    this._onAnalysisComplete = callback;
  }

  // --- Debugging ---

  /**
   * Get raw buffers for debugging
   * @returns {{ pitch: Object[], onset: Object[] }}
   */
  getBuffers() {
    return {
      pitch: [...this._pitchBuffer],
      onset: [...this._onsetBuffer],
    };
  }

  /**
   * Clear all state
   */
  reset() {
    this._pitchBuffer = [];
    this._onsetBuffer = [];
    this._expectations = null;
    this._startTime = null;
    this._isRecording = false;
  }
}

export default PerformanceAnalyzer;
export { PerformanceAnalyzer };
