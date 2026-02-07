import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock instrument-context before importing LenientNoteListener
vi.mock('../audio/instrument-context.js', () => {
  return {
    default: {
      frequencyToPitch: vi.fn((freq) => {
        // Simple mock: map frequency ranges to pitch classes
        const midiNote = 69 + 12 * Math.log2(freq / 440);
        const noteNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const rounded = Math.round(midiNote);
        const pitchClass = noteNames[((rounded % 12) + 12) % 12];
        const octave = Math.floor(rounded / 12) - 1;
        return {
          pitch: `${pitchClass}${octave}`,
          pitchClass,
          octave,
          midiNote: rounded,
          cents: Math.round((midiNote - rounded) * 100),
        };
      }),
    },
  };
});

import { LenientNoteListener, LENIENT_CONFIG } from '../audio/lenient-note-listener.js';

// Helper: create a pitch event that will register as a valid tone
function makePitchEvent(frequencyHz, clarity = 0.95) {
  const midiNote = 69 + 12 * Math.log2(frequencyHz / 440);
  return {
    frequencyHz,
    clarity,
    midiNoteNumber: Math.round(midiNote),
    isTone: true,
    audioTime: 0,
  };
}

// Helper: create an invalid pitch event (silence/noise)
function makeInvalidPitch() {
  return { frequencyHz: 0, clarity: 0, midiNoteNumber: 0, isTone: false, audioTime: 0 };
}

describe('LenientNoteListener', () => {
  let listener;

  beforeEach(() => {
    listener = new LenientNoteListener();
    // Use short thresholds for test speed
    listener.configure({
      MIN_STABLE_TIME_MS: 0,
      SILENCE_THRESHOLD_MS: 0,
      MIN_CLARITY: 0.5,
    });
    // Mock performance.now for deterministic tests
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  describe('multi-listener pattern', () => {
    it('calls multiple noteStart listeners', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      listener.onNoteStart(fn1);
      listener.onNoteStart(fn2);

      // First event starts tracking; second checks stability and emits noteStart
      listener.handlePitch(makePitchEvent(440));
      listener.handlePitch(makePitchEvent(440));

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn1.mock.calls[0][0].type).toBe('noteStart');
    });

    it('calls multiple noteEnd listeners', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      listener.onNoteEnd(fn1);
      listener.onNoteEnd(fn2);

      // Start a note (two events needed to emit noteStart)
      listener.handlePitch(makePitchEvent(440));
      listener.handlePitch(makePitchEvent(440));

      // End it with silence after time passes
      vi.spyOn(performance, 'now').mockReturnValue(200);
      listener.handlePitch(makeInvalidPitch());

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn1.mock.calls[0][0].type).toBe('noteEnd');
    });

    it('calls multiple pitchUpdate listeners', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      listener.onPitchUpdate(fn1);
      listener.onPitchUpdate(fn2);

      const event = makePitchEvent(440);
      listener.handlePitch(event);

      expect(fn1).toHaveBeenCalledWith(event);
      expect(fn2).toHaveBeenCalledWith(event);
    });

    it('returns unsubscribe function that removes the listener', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const unsub1 = listener.onNoteStart(fn1);
      listener.onNoteStart(fn2);

      unsub1();

      // Two events needed to emit noteStart
      listener.handlePitch(makePitchEvent(440));
      listener.handlePitch(makePitchEvent(440));

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('unsubscribing one listener does not affect others', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const fn3 = vi.fn();
      listener.onNoteStart(fn1);
      const unsub2 = listener.onNoteStart(fn2);
      listener.onNoteStart(fn3);

      unsub2();

      // Two events needed to emit noteStart
      listener.handlePitch(makePitchEvent(440));
      listener.handlePitch(makePitchEvent(440));

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).not.toHaveBeenCalled();
      expect(fn3).toHaveBeenCalledTimes(1);
    });

    it('works with no listeners registered (no error)', () => {
      expect(() => {
        listener.handlePitch(makePitchEvent(440));
      }).not.toThrow();
    });

    it('removeAllListeners clears all listener arrays', () => {
      const fn = vi.fn();
      listener.onNoteStart(fn);
      listener.onNoteEnd(fn);
      listener.onPitchUpdate(fn);

      listener.removeAllListeners();

      listener.handlePitch(makePitchEvent(440));

      // pitchUpdate would have been called if still registered
      expect(fn).not.toHaveBeenCalled();
    });

    it('reset does not clear listeners', () => {
      const fn = vi.fn();
      listener.onPitchUpdate(fn);

      listener.reset();

      listener.handlePitch(makePitchEvent(440));
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
