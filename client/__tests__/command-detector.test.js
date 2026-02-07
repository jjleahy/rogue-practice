import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandDetector } from '../audio/command-detector.js';
import { LenientNoteListener } from '../audio/lenient-note-listener.js';

// Helper: create a noteStart event
function noteStart(pitchClass, startTime = 0) {
  return {
    type: 'noteStart',
    pitch: `${pitchClass}4`,
    pitchClass,
    octave: 4,
    frequency: 440,
    cents: 0,
    startTime,
  };
}

// Helper: create a noteEnd event
function noteEnd(pitchClass, startTime = 0, endTime = 500) {
  return {
    type: 'noteEnd',
    pitch: `${pitchClass}4`,
    pitchClass,
    octave: 4,
    frequency: 440,
    cents: 0,
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}

describe('CommandDetector', () => {
  let detector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new CommandDetector();
    detector.activate();
  });

  describe('multi-listener pattern', () => {
    it('calls multiple onConfirm listeners', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      detector.onConfirm(fn1);
      detector.onConfirm(fn2);

      // Feed sol-do sequence (held long enough for timers to fire)
      detector._handleNoteStart(noteStart('G', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('C', 500));
      vi.advanceTimersByTime(500);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('calls multiple onCancel listeners', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      detector.onCancel(fn1);
      detector.onCancel(fn2);

      // Feed do-sol sequence
      detector._handleNoteStart(noteStart('C', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('G', 500));
      vi.advanceTimersByTime(500);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('calls multiple onOption listeners', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      detector.onOption(fn1);
      detector.onOption(fn2);

      // Feed an option note (re = D)
      detector._handleNoteStart(noteStart('D', 0));
      vi.advanceTimersByTime(500);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn1.mock.calls[0][0]).toEqual({ solfege: 're', pitchClass: 'D' });
    });

    it('returns unsubscribe function that works', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const unsub = detector.onConfirm(fn1);
      detector.onConfirm(fn2);

      unsub();

      detector._handleNoteStart(noteStart('G', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('C', 500));
      vi.advanceTimersByTime(500);

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('removeAllListeners clears all command listeners', () => {
      const fn = vi.fn();
      detector.onConfirm(fn);
      detector.onCancel(fn);
      detector.onOption(fn);

      detector.removeAllListeners();

      // Trigger confirm
      detector._handleNoteStart(noteStart('G', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('C', 500));
      vi.advanceTimersByTime(500);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('subscribeTo / unsubscribeFrom', () => {
    it('subscribeTo adds handlers to LenientNoteListener without replacing existing listeners', () => {
      // Mock a minimal LenientNoteListener with the multi-listener interface
      const mockListener = {
        onNoteStart: vi.fn(() => vi.fn()),
        onNoteEnd: vi.fn(() => vi.fn()),
      };

      detector.subscribeTo(mockListener);

      expect(mockListener.onNoteStart).toHaveBeenCalledTimes(1);
      expect(mockListener.onNoteEnd).toHaveBeenCalledTimes(1);
    });

    it('unsubscribeFrom calls stored unsubscribe functions', () => {
      const unsubStart = vi.fn();
      const unsubEnd = vi.fn();
      const mockListener = {
        onNoteStart: vi.fn(() => unsubStart),
        onNoteEnd: vi.fn(() => unsubEnd),
      };

      detector.subscribeTo(mockListener);
      detector.unsubscribeFrom();

      expect(unsubStart).toHaveBeenCalledTimes(1);
      expect(unsubEnd).toHaveBeenCalledTimes(1);
    });

    it('unsubscribeFrom is safe to call without prior subscribeTo', () => {
      expect(() => detector.unsubscribeFrom()).not.toThrow();
    });

    it('integrates with real LenientNoteListener (additive subscription)', () => {
      // Use a real LenientNoteListener to verify additive behavior
      vi.mock('../audio/instrument-context.js', () => ({
        default: {
          frequencyToPitch: vi.fn(() => ({
            pitch: 'G4', pitchClass: 'G', octave: 4, midiNote: 67, cents: 0,
          })),
        },
      }));

      const listener = new LenientNoteListener();
      const externalFn = vi.fn();

      // External consumer registers first
      listener.onNoteStart(externalFn);

      // CommandDetector subscribes additively
      detector.subscribeTo(listener);

      // Both should be registered (2 noteStart listeners)
      expect(listener._noteStartListeners.length).toBe(2);

      // After unsubscribe, only external remains
      detector.unsubscribeFrom();
      expect(listener._noteStartListeners.length).toBe(1);
    });
  });

  describe('basic sequence detection', () => {
    it('detects confirm (sol-do)', () => {
      const fn = vi.fn();
      detector.onConfirm(fn);

      detector._handleNoteStart(noteStart('G', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('C', 500));
      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('detects cancel (do-sol)', () => {
      const fn = vi.fn();
      detector.onCancel(fn);

      detector._handleNoteStart(noteStart('C', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('G', 500));
      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not fire if note is too short', () => {
      const fn = vi.fn();
      detector.onConfirm(fn);

      detector._handleNoteStart(noteStart('G', 0));
      // End before threshold (400ms)
      detector._handleNoteEnd(noteEnd('G', 0, 200));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('C', 500));
      vi.advanceTimersByTime(500);

      // Sol was too short, so sol-do sequence incomplete
      expect(fn).not.toHaveBeenCalled();
    });

    it('does not fire when inactive', () => {
      const fn = vi.fn();
      detector.onConfirm(fn);
      detector.deactivate();

      detector._handleNoteStart(noteStart('G', 0));
      vi.advanceTimersByTime(500);
      detector._handleNoteStart(noteStart('C', 500));
      vi.advanceTimersByTime(500);

      expect(fn).not.toHaveBeenCalled();
    });
  });
});
