/**
 * Tests for audio.js pure functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    noteToFrequency,
    frequencyToNoteInfo,
    getCentsFromFrequency,
    sameNoteClass,
    setCalibrationRoot,
    getIntervalFromRoot,
    checkCommand
} from '../audio.js';

describe('noteToFrequency', () => {
    it('converts A4 to 440Hz', () => {
        expect(noteToFrequency('A4')).toBeCloseTo(440, 1);
    });

    it('converts C4 to ~261.63Hz', () => {
        expect(noteToFrequency('C4')).toBeCloseTo(261.63, 1);
    });

    it('converts sharps and flats correctly', () => {
        expect(noteToFrequency('Db4')).toBeCloseTo(277.18, 1);
        expect(noteToFrequency('C#4')).toBeCloseTo(277.18, 1); // Enharmonic equivalent
    });

    it('converts flats correctly', () => {
        expect(noteToFrequency('Bb3')).toBeCloseTo(233.08, 1);
        expect(noteToFrequency('Eb4')).toBeCloseTo(311.13, 1);
        expect(noteToFrequency('Db4')).toBeCloseTo(277.18, 1);
        expect(noteToFrequency('Gb4')).toBeCloseTo(369.99, 1);
        expect(noteToFrequency('Ab4')).toBeCloseTo(415.30, 1);
    });

    it('handles different octaves', () => {
        expect(noteToFrequency('A3')).toBeCloseTo(220, 1);
        expect(noteToFrequency('A5')).toBeCloseTo(880, 1);
    });

    it('returns null for invalid note format', () => {
        expect(noteToFrequency('invalid')).toBeNull();
        expect(noteToFrequency('H4')).toBeNull();
        expect(noteToFrequency('A')).toBeNull();
    });
});

describe('frequencyToNoteInfo', () => {
    it('converts 440Hz to A4', () => {
        const info = frequencyToNoteInfo(440);
        expect(info.note).toBe('A4');
        expect(info.noteName).toBe('A');
        expect(info.octave).toBe(4);
        expect(info.cents).toBe(0);
    });

    it('converts 261.63Hz to C4', () => {
        const info = frequencyToNoteInfo(261.63);
        expect(info.note).toBe('C4');
        expect(info.noteName).toBe('C');
        expect(info.octave).toBe(4);
    });

    it('detects cents deviation', () => {
        // 445Hz is slightly sharp of A4 (440Hz)
        const info = frequencyToNoteInfo(445);
        expect(info.note).toBe('A4');
        expect(info.cents).toBeGreaterThan(0);
    });

    it('handles low frequencies', () => {
        const info = frequencyToNoteInfo(110);
        expect(info.note).toBe('A2');
    });

    it('handles high frequencies', () => {
        const info = frequencyToNoteInfo(880);
        expect(info.note).toBe('A5');
    });
});

describe('getCentsFromFrequency', () => {
    it('returns 0 cents for exact frequencies', () => {
        expect(getCentsFromFrequency(440)).toBe(0);
    });

    it('returns positive cents for sharp frequencies', () => {
        const cents = getCentsFromFrequency(445);
        expect(cents).toBeGreaterThan(0);
    });

    it('returns negative cents for flat frequencies', () => {
        const cents = getCentsFromFrequency(435);
        expect(cents).toBeLessThan(0);
    });
});

describe('sameNoteClass', () => {
    it('returns true for same note in different octaves', () => {
        expect(sameNoteClass('C4', 'C5')).toBe(true);
        expect(sameNoteClass('A3', 'A4')).toBe(true);
        expect(sameNoteClass('Bb2', 'Bb6')).toBe(true);
    });

    it('returns false for different note classes', () => {
        expect(sameNoteClass('C4', 'D4')).toBe(false);
        expect(sameNoteClass('A3', 'B3')).toBe(false);
    });

    it('returns true for same note in same octave', () => {
        expect(sameNoteClass('C4', 'C4')).toBe(true);
    });

    it('handles sharps and flats', () => {
        expect(sameNoteClass('Db4', 'Db5')).toBe(true);
        expect(sameNoteClass('Bb3', 'Bb4')).toBe(true);
    });

    it('recognizes enharmonic equivalents', () => {
        expect(sameNoteClass('C#4', 'Db5')).toBe(true);
        expect(sameNoteClass('Db4', 'C#5')).toBe(true);
        expect(sameNoteClass('D#4', 'Eb5')).toBe(true);
        expect(sameNoteClass('Eb4', 'D#5')).toBe(true);
        expect(sameNoteClass('F#4', 'Gb5')).toBe(true);
        expect(sameNoteClass('Gb4', 'F#5')).toBe(true);
        expect(sameNoteClass('G#4', 'Ab5')).toBe(true);
        expect(sameNoteClass('Ab4', 'G#5')).toBe(true);
        expect(sameNoteClass('A#4', 'Bb5')).toBe(true);
        expect(sameNoteClass('Bb4', 'A#5')).toBe(true);
    });

    it('returns false for non-enharmonic pairs', () => {
        expect(sameNoteClass('C4', 'Db4')).toBe(false);
        expect(sameNoteClass('E4', 'F4')).toBe(false);
    });
});

describe('getIntervalFromRoot', () => {
    beforeEach(() => {
        // Set Bb3 as calibration root before each test
        setCalibrationRoot('Bb3', noteToFrequency('Bb3'));
    });

    it('returns 0 for root note', () => {
        expect(getIntervalFromRoot('Bb3')).toBe(0);
        expect(getIntervalFromRoot('Bb4')).toBe(12); // One octave up
        expect(getIntervalFromRoot('Bb2')).toBe(-12); // One octave down
    });

    it('returns 7 for perfect fifth above root', () => {
        expect(getIntervalFromRoot('F4')).toBe(7);
        expect(getIntervalFromRoot('F3')).toBe(-5); // Fifth below in lower octave
    });

    it('returns 5 for perfect fourth above root', () => {
        expect(getIntervalFromRoot('Eb4')).toBe(5);
    });

    it('calculates intervals for various notes', () => {
        expect(getIntervalFromRoot('C4')).toBe(2); // Major 2nd
        expect(getIntervalFromRoot('D4')).toBe(4); // Major 3rd
        expect(getIntervalFromRoot('G4')).toBe(9); // Major 6th
    });

    it('returns null when no calibration root is set', () => {
        setCalibrationRoot(null, null);
        expect(getIntervalFromRoot('C4')).toBeNull();
    });
});

describe('checkCommand', () => {
    beforeEach(() => {
        // Set Bb3 as calibration root for command testing
        setCalibrationRoot('Bb3', noteToFrequency('Bb3'));
    });

    it('detects Sol-Do (confirm) command', () => {
        const noteSequence = [
            { note: 'F4', timestamp: 1000 },  // Sol (5th)
            { note: 'Bb3', timestamp: 1500 }  // Do (root)
        ];
        expect(checkCommand(noteSequence)).toBe('confirm');
    });

    it('detects Do-Sol (back) command', () => {
        const noteSequence = [
            { note: 'Bb3', timestamp: 1000 }, // Do (root)
            { note: 'F4', timestamp: 1500 }   // Sol (5th)
        ];
        expect(checkCommand(noteSequence)).toBe('back');
    });

    it('works with notes in different octaves', () => {
        // F4 (sol) to Bb3 (do) - confirm with octave crossing
        const confirmSequence = [
            { note: 'F4', timestamp: 1000 },
            { note: 'Bb3', timestamp: 1500 }
        ];
        expect(checkCommand(confirmSequence)).toBe('confirm');

        // Bb3 (do) to F4 (sol) - back with octave crossing
        const backSequence = [
            { note: 'Bb3', timestamp: 1000 },
            { note: 'F4', timestamp: 1500 }
        ];
        expect(checkCommand(backSequence)).toBe('back');
    });

    it('returns null for non-command sequences', () => {
        const noteSequence = [
            { note: 'C4', timestamp: 1000 },
            { note: 'D4', timestamp: 1500 }
        ];
        expect(checkCommand(noteSequence)).toBeNull();
    });

    it('returns null for single note', () => {
        const noteSequence = [
            { note: 'Bb3', timestamp: 1000 }
        ];
        expect(checkCommand(noteSequence)).toBeNull();
    });

    it('returns null when no calibration root is set', () => {
        setCalibrationRoot(null, null);
        const noteSequence = [
            { note: 'F4', timestamp: 1000 },
            { note: 'Bb3', timestamp: 1500 }
        ];
        expect(checkCommand(noteSequence)).toBeNull();
    });
});
