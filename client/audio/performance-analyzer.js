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

  // --- Analysis Helpers ---

  /**
   * Segment the pitch buffer into discrete detected notes
   * @returns {Object[]} Array of detected notes with { startMs, endMs, pitch, avgCentsFromTendency, samples }
   */
  _segmentDetectedNotes() {
    const notes = [];
    let currentNote = null;

    for (const sample of this._pitchBuffer) {
      if (!sample.isTone) {
        // End current note if we were tracking one
        if (currentNote) {
          this._finalizeNote(currentNote, notes);
          currentNote = null;
        }
        continue;
      }

      // Convert frequency to pitch info
      const pitchInfo = instrumentContext.frequencyToPitch(sample.frequencyHz);

      if (!currentNote) {
        // Start a new note
        currentNote = {
          startMs: sample.relativeTime,
          endMs: sample.relativeTime,
          pitch: pitchInfo.pitch,
          midiNote: pitchInfo.midiNote,
          samples: [{ centsFromTendency: pitchInfo.centsFromTendency, time: sample.relativeTime }],
        };
      } else {
        // Check if this is a significant pitch change (>0.8 semitones = 80 cents)
        const midiDiff = Math.abs(pitchInfo.midiNote - currentNote.midiNote);
        if (midiDiff >= 0.8) {
          // End current note and start a new one
          this._finalizeNote(currentNote, notes);
          currentNote = {
            startMs: sample.relativeTime,
            endMs: sample.relativeTime,
            pitch: pitchInfo.pitch,
            midiNote: pitchInfo.midiNote,
            samples: [{ centsFromTendency: pitchInfo.centsFromTendency, time: sample.relativeTime }],
          };
        } else {
          // Continue current note
          currentNote.endMs = sample.relativeTime;
          currentNote.samples.push({ centsFromTendency: pitchInfo.centsFromTendency, time: sample.relativeTime });
        }
      }
    }

    // Finalize last note if present
    if (currentNote) {
      this._finalizeNote(currentNote, notes);
    }

    return notes;
  }

  /**
   * Finalize a note by calculating average cents and filtering short notes
   * @param {Object} note - Note being finalized
   * @param {Object[]} notes - Array to push finalized note to
   */
  _finalizeNote(note, notes) {
    const duration = note.endMs - note.startMs;
    // Filter notes shorter than 50ms (noise)
    if (duration < 50) return;

    // Calculate average centsFromTendency
    const sumCents = note.samples.reduce((sum, s) => sum + s.centsFromTendency, 0);
    note.avgCentsFromTendency = Math.round(sumCents / note.samples.length);

    // Remove samples array to save memory (we have the average now)
    delete note.samples;

    notes.push(note);
  }

  /**
   * Refine note start time using onset events
   * Look for onset within 80ms before pitch detection start
   * @param {Object} note - Detected note
   * @returns {number} Refined start time in ms
   */
  _refineStartWithOnset(note) {
    const searchStart = note.startMs - 80;
    const searchEnd = note.startMs;

    // Find onset events in the search window
    const onsetsInWindow = this._onsetBuffer.filter(
      onset => onset.relativeTime >= searchStart && onset.relativeTime <= searchEnd
    );

    if (onsetsInWindow.length > 0) {
      // Use the latest onset before the pitch detection
      const latestOnset = onsetsInWindow[onsetsInWindow.length - 1];
      return latestOnset.relativeTime;
    }

    return note.startMs;
  }

  /**
   * Compare detected pitch to expected pitch
   * @param {string} detectedPitch - Detected pitch (e.g., 'C4')
   * @param {string} expectedPitch - Expected pitch (e.g., 'C4')
   * @returns {{ matches: boolean, octaveError: boolean }}
   */
  _comparePitches(detectedPitch, expectedPitch) {
    if (detectedPitch === expectedPitch) {
      return { matches: true, octaveError: false };
    }

    // Extract pitch class (note name without octave)
    const detectedClass = detectedPitch.replace(/\d+$/, '');
    const expectedClass = expectedPitch.replace(/\d+$/, '');

    if (detectedClass === expectedClass) {
      // Same pitch class, different octave
      return { matches: true, octaveError: true };
    }

    return { matches: false, octaveError: false };
  }

  // --- Analysis ---

  /**
   * Analyze the recorded performance against expectations
   * Call after stop() to get results
   *
   * @returns {PerformanceResult}
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

    // 1. Segment pitch buffer into detected notes
    const detectedNotes = this._segmentDetectedNotes();

    // 2. Refine start times with onset events
    for (const note of detectedNotes) {
      note.refinedStartMs = this._refineStartWithOnset(note);
    }

    // 3. Match detected notes to expected notes
    const TOLERANCE_MS = 300;
    const usedDetected = new Set();
    const analyzedNotes = [];
    const missedNotes = [];

    for (const expected of this._expectations) {
      // Find best matching detected note within tolerance window
      let bestMatch = null;
      let bestTimingError = Infinity;

      for (let i = 0; i < detectedNotes.length; i++) {
        if (usedDetected.has(i)) continue;

        const detected = detectedNotes[i];
        const timingError = detected.refinedStartMs - expected.ms;

        // Check if within tolerance window
        if (Math.abs(timingError) > TOLERANCE_MS) continue;

        // Check pitch match (including octave errors)
        const comparison = this._comparePitches(detected.pitch, expected.pitch);
        if (!comparison.matches) continue;

        // Prefer the closest match in time
        if (Math.abs(timingError) < Math.abs(bestTimingError)) {
          bestMatch = { index: i, detected, timingError, comparison };
          bestTimingError = timingError;
        }
      }

      if (bestMatch) {
        usedDetected.add(bestMatch.index);
        analyzedNotes.push({
          expected: expected.pitch,
          detected: bestMatch.detected.pitch,
          expectedMs: expected.ms,
          detectedMs: bestMatch.detected.refinedStartMs,
          timingErrorMs: Math.round(bestMatch.timingError),
          cents: bestMatch.detected.avgCentsFromTendency,
          matched: true,
          octaveError: bestMatch.comparison.octaveError,
        });
      } else {
        // Note was missed
        missedNotes.push(expected.pitch);
        analyzedNotes.push({
          expected: expected.pitch,
          detected: null,
          expectedMs: expected.ms,
          detectedMs: null,
          timingErrorMs: 0,
          cents: 0,
          matched: false,
          octaveError: false,
        });
      }
    }

    // 4. Collect extra notes (detected but not matched)
    const extraNotes = detectedNotes
      .filter((_, i) => !usedDetected.has(i))
      .map(note => ({
        pitch: note.pitch,
        startMs: note.refinedStartMs,
        endMs: note.endMs,
        cents: note.avgCentsFromTendency,
      }));

    // 5. Calculate summary stats
    const matchedNotes = analyzedNotes.filter(n => n.matched);
    const accuracy = this._expectations.length > 0
      ? Math.round((matchedNotes.length / this._expectations.length) * 100)
      : 0;

    const averageTimingError = matchedNotes.length > 0
      ? Math.round(matchedNotes.reduce((sum, n) => sum + Math.abs(n.timingErrorMs), 0) / matchedNotes.length)
      : 0;

    const averageCentsError = matchedNotes.length > 0
      ? Math.round(matchedNotes.reduce((sum, n) => sum + Math.abs(n.cents), 0) / matchedNotes.length)
      : 0;

    return {
      notes: analyzedNotes,
      extraNotes,
      missedNotes,
      accuracy,
      averageTimingError,
      averageCentsError,
      _debug: {
        pitchEventsRecorded: this._pitchBuffer.length,
        onsetEventsRecorded: this._onsetBuffer.length,
        detectedNotesCount: detectedNotes.length,
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
