/**
 * Tests for screen patterns
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HoldPitchScreen, ChoiceScreen, ScreenManager } from '../screens.js';

// Mock Audio module
vi.mock('../audio.js', () => ({
    frequencyToNoteInfo: (freq) => ({
        note: 'C4',
        frequency: freq,
        cents: 0
    }),
    sameNoteClass: (note1, note2) => {
        const strip = (n) => n.replace(/\d+$/, '');
        return strip(note1) === strip(note2);
    },
    getIntervalFromRoot: (note) => {
        const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const noteName = note.replace(/\d+$/, '').replace(/[#b]/, '');
        return noteMap[noteName] ?? null;
    },
    getNoteHistory: () => [],
    checkCommand: () => null
}));

// Mock UI module
vi.mock('../ui.js', () => ({
    debugLog: vi.fn()
}));

describe('HoldPitchScreen', () => {
    it('should initialize with default config', () => {
        const screen = new HoldPitchScreen({
            onComplete: vi.fn()
        });

        expect(screen.holdTime).toBe(1500);
        expect(screen.stabilityThreshold).toBe(2);
        expect(screen.minSamples).toBe(5);
    });

    it('should accept custom config', () => {
        const screen = new HoldPitchScreen({
            holdTime: 2000,
            stabilityThreshold: 3,
            minSamples: 10,
            onComplete: vi.fn()
        });

        expect(screen.holdTime).toBe(2000);
        expect(screen.stabilityThreshold).toBe(3);
        expect(screen.minSamples).toBe(10);
    });

    it('should call onUpdate when pitch detected', () => {
        const onUpdate = vi.fn();
        const screen = new HoldPitchScreen({ onUpdate });

        screen.enter();
        screen.handlePitchDetected({ note: 'C4', frequency: 261.63 });

        expect(onUpdate).toHaveBeenCalledWith(0, { note: 'C4', frequency: 261.63 });
    });

    it('should track pitch stability and progress', () => {
        const onUpdate = vi.fn();
        const screen = new HoldPitchScreen({
            holdTime: 1000,
            minSamples: 3,
            onUpdate
        });

        screen.enter();

        // First note
        screen.handleNoteStart({ note: 'C4', frequency: 261.63 });
        expect(onUpdate).toHaveBeenCalledWith(expect.any(Number), expect.any(Object));

        // Second note (similar pitch)
        screen.handleNoteStart({ note: 'C4', frequency: 262.0 });
        expect(screen.pitches.length).toBe(2);
    });

    it('should reset on unstable pitch', () => {
        const onReset = vi.fn();
        const screen = new HoldPitchScreen({
            stabilityThreshold: 2,
            onReset
        });

        screen.enter();

        // First note
        screen.handleNoteStart({ note: 'C4', frequency: 261.63 });
        expect(screen.pitches.length).toBe(1);

        // Jump to E4 (different pitch, should reset)
        screen.handleNoteStart({ note: 'E4', frequency: 329.63 });
        expect(onReset).toHaveBeenCalled();
        expect(screen.pitches.length).toBe(1); // Reset, then added new
    });

    it('should complete after holding steady pitch', () => {
        vi.useFakeTimers();
        const onComplete = vi.fn();
        const screen = new HoldPitchScreen({
            holdTime: 100,
            minSamples: 2,
            onComplete
        });

        screen.enter();

        // Add pitches over time
        screen.handleNoteStart({ note: 'C4', frequency: 261.63 });
        vi.advanceTimersByTime(50);
        screen.handleNoteStart({ note: 'C4', frequency: 261.8 });
        vi.advanceTimersByTime(60);
        screen.handleNoteStart({ note: 'C4', frequency: 261.7 });

        expect(onComplete).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledWith(
            expect.any(Number),
            expect.objectContaining({ note: 'C4' })
        );

        vi.useRealTimers();
    });

    it('should enforce target pitch if specified', () => {
        const onReset = vi.fn();
        const screen = new HoldPitchScreen({
            targetPitch: 'C4',
            onReset
        });

        screen.enter();

        // Wrong pitch
        screen.handleNoteStart({ note: 'E4', frequency: 329.63 });
        expect(onReset).toHaveBeenCalled();
        expect(screen.pitches.length).toBe(0);

        // Correct pitch
        screen.handleNoteStart({ note: 'C4', frequency: 261.63 });
        expect(screen.pitches.length).toBe(1);
    });

    it('should not process when inactive', () => {
        const onUpdate = vi.fn();
        const screen = new HoldPitchScreen({ onUpdate });

        // Don't call enter()
        screen.handlePitchDetected({ note: 'C4', frequency: 261.63 });
        expect(onUpdate).not.toHaveBeenCalled();
    });
});

describe('ChoiceScreen', () => {
    it('should initialize with choices', () => {
        const choices = [
            { interval: 0, label: 'Option 1', value: 'opt1' },
            { interval: 4, label: 'Option 2', value: 'opt2' }
        ];
        const screen = new ChoiceScreen({ choices });

        expect(screen.choices).toEqual(choices);
    });

    it('should highlight choice when matching interval played', () => {
        const onHighlight = vi.fn();
        const choices = [
            { interval: 0, label: 'Root', value: 'root' },
            { interval: 4, label: 'Third', value: 'third' },
            { interval: 7, label: 'Fifth', value: 'fifth' }
        ];
        const screen = new ChoiceScreen({ choices, onHighlight });

        screen.enter();

        // Play E (interval 4 from C root)
        screen.handleNoteStart({ note: 'E4', frequency: 329.63 });

        expect(onHighlight).toHaveBeenCalledWith(choices[1]);
        expect(screen.getCurrentChoice()).toEqual(choices[1]);
    });

    it('should not highlight for non-matching interval', () => {
        const onHighlight = vi.fn();
        const choices = [
            { interval: 0, label: 'Root', value: 'root' },
            { interval: 4, label: 'Third', value: 'third' }
        ];
        const screen = new ChoiceScreen({ choices, onHighlight });

        screen.enter();

        // Play G (interval 7, not in choices)
        screen.handleNoteStart({ note: 'G4', frequency: 392.0 });

        expect(onHighlight).not.toHaveBeenCalled();
    });

    it('should auto-confirm if enabled', () => {
        const onConfirm = vi.fn();
        const choices = [
            { interval: 0, label: 'Root', value: 'root' }
        ];
        const screen = new ChoiceScreen({
            choices,
            onConfirm,
            autoConfirmOnHighlight: true
        });

        screen.enter();

        // Play C (root)
        screen.handleNoteStart({ note: 'C4', frequency: 261.63 });

        expect(onConfirm).toHaveBeenCalledWith(choices[0]);
    });

    it('should support programmatic selection', () => {
        const onConfirm = vi.fn();
        const choices = [
            { interval: 0, label: 'Option 1', value: 'opt1' },
            { interval: 4, label: 'Option 2', value: 'opt2' }
        ];
        const screen = new ChoiceScreen({ choices, onConfirm });

        screen.enter();
        screen.selectByIndex(1);

        expect(onConfirm).toHaveBeenCalledWith(choices[1]);
    });
});

describe('ScreenManager', () => {
    it('should set and activate screen', () => {
        const manager = new ScreenManager();
        const screen = new HoldPitchScreen({ onComplete: vi.fn() });

        manager.setScreen(screen);

        expect(manager.getCurrentScreen()).toBe(screen);
        expect(screen.active).toBe(true);
        expect(manager.isActive()).toBe(true);
    });

    it('should clear screen', () => {
        const manager = new ScreenManager();
        const screen = new HoldPitchScreen({ onComplete: vi.fn() });

        manager.setScreen(screen);
        manager.clearScreen();

        expect(manager.getCurrentScreen()).toBe(null);
        expect(screen.active).toBe(false);
        expect(manager.isActive()).toBe(false);
    });

    it('should route audio callbacks to current screen', () => {
        const manager = new ScreenManager();
        const onUpdate = vi.fn();
        const screen = new HoldPitchScreen({ onUpdate });

        manager.setScreen(screen);
        manager.handlePitchDetected({ note: 'C4', frequency: 261.63 });

        expect(onUpdate).toHaveBeenCalled();
    });

    it('should exit old screen when setting new screen', () => {
        const manager = new ScreenManager();
        const screen1 = new HoldPitchScreen({ onComplete: vi.fn() });
        const screen2 = new HoldPitchScreen({ onComplete: vi.fn() });

        manager.setScreen(screen1);
        expect(screen1.active).toBe(true);

        manager.setScreen(screen2);
        expect(screen1.active).toBe(false);
        expect(screen2.active).toBe(true);
    });
});
