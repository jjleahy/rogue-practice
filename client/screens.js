/**
 * Reusable screen patterns for audio-controlled UI flows
 */

import * as Audio from './audio.js';
import * as UI from './ui.js';

/**
 * Base Screen class
 */
class Screen {
    constructor() {
        this.active = false;
    }

    /**
     * Called when screen becomes active
     */
    enter() {
        this.active = true;
    }

    /**
     * Called when screen becomes inactive
     */
    exit() {
        this.active = false;
    }

    /**
     * Handle pitch detection (called continuously while active)
     */
    handlePitchDetected(noteInfo) {
        // Override in subclasses
    }

    /**
     * Handle note start (called when note onset detected)
     */
    handleNoteStart(noteData) {
        // Override in subclasses
    }

    /**
     * Handle note end (called when note offset detected)
     */
    handleNoteEnd(noteData) {
        // Override in subclasses
    }

    /**
     * Handle silence (called during periods of no sound)
     */
    handleSilence(duration) {
        // Override in subclasses
    }
}

/**
 * HoldPitchScreen - Requires holding a steady pitch for a duration
 *
 * Example use cases:
 * - Calibration (detect and hold fundamental note)
 * - Confirmation screens (hold a specific pitch to confirm)
 */
export class HoldPitchScreen extends Screen {
    /**
     * @param {Object} config
     * @param {number} config.holdTime - Duration in ms to hold pitch
     * @param {number} config.stabilityThreshold - Max semitone difference to maintain hold
     * @param {number} config.minSamples - Minimum pitch samples required
     * @param {Function} config.onUpdate - Called with progress updates (percent, noteData)
     * @param {Function} config.onComplete - Called when hold completes (avgFrequency, noteInfo)
     * @param {Function} config.onReset - Called when hold is reset due to instability
     * @param {string} config.targetPitch - Optional: specific pitch to hold (e.g., 'C4')
     */
    constructor(config) {
        super();
        this.holdTime = config.holdTime || 1500;
        this.stabilityThreshold = config.stabilityThreshold || 2;
        this.minSamples = config.minSamples || 5;
        this.onUpdate = config.onUpdate || (() => {});
        this.onComplete = config.onComplete || (() => {});
        this.onReset = config.onReset || (() => {});
        this.targetPitch = config.targetPitch || null;

        this.pitches = [];
        this.startTime = null;
        this.completed = false;
    }

    enter() {
        super.enter();
        this.pitches = [];
        this.startTime = null;
        this.completed = false;
    }

    exit() {
        super.exit();
        this.pitches = [];
        this.startTime = null;
    }

    handlePitchDetected(noteInfo) {
        if (!this.active || this.completed) return;

        // Call update callback with current pitch
        this.onUpdate(0, noteInfo);
    }

    handleNoteStart(noteData) {
        if (!this.active || this.completed) return;

        const now = performance.now();

        // If target pitch specified, check if it matches
        if (this.targetPitch && !Audio.sameNoteClass(noteData.note, this.targetPitch)) {
            // Wrong pitch, reset
            this.reset();
            return;
        }

        // Check stability with previous pitches
        if (this.pitches.length > 0) {
            const lastPitch = this.pitches[this.pitches.length - 1];
            const semitonesDiff = Math.abs(12 * Math.log2(noteData.frequency / lastPitch.frequency));

            if (semitonesDiff > this.stabilityThreshold) {
                // Pitch changed too much, reset and start fresh with this note
                this.reset();
            }
        }

        // Add pitch to collection
        this.pitches.push(noteData);

        if (this.startTime === null) {
            this.startTime = now;
        }

        // Calculate progress
        const holdDuration = now - this.startTime;
        const progressPercent = Math.min(100, (holdDuration / this.holdTime) * 100);

        this.onUpdate(progressPercent, noteData);

        // Check if hold complete
        if (holdDuration >= this.holdTime && this.pitches.length >= this.minSamples) {
            this.complete();
        }
    }

    reset() {
        this.pitches = [];
        this.startTime = null;
        this.onReset();
    }

    complete() {
        this.completed = true;

        // Calculate average frequency
        const avgFrequency = this.pitches.reduce((sum, p) => sum + p.frequency, 0) / this.pitches.length;
        const noteInfo = Audio.frequencyToNoteInfo(avgFrequency);

        this.onComplete(avgFrequency, noteInfo);
    }
}

/**
 * ChoiceScreen - Select from multiple options by playing different pitches
 *
 * Example use cases:
 * - Menu selection (play different notes to highlight options)
 * - Multiple choice questions
 * - Settings selection
 */
export class ChoiceScreen extends Screen {
    /**
     * @param {Object} config
     * @param {Array<Object>} config.choices - Array of {interval, label, value}
     * @param {Function} config.onHighlight - Called when choice highlighted (choice)
     * @param {Function} config.onConfirm - Called when choice confirmed (choice)
     * @param {Function} config.onBack - Called when back command detected
     * @param {boolean} config.autoConfirmOnHighlight - If true, automatically confirms on highlight
     */
    constructor(config) {
        super();
        this.choices = config.choices || [];
        this.onHighlight = config.onHighlight || (() => {});
        this.onConfirm = config.onConfirm || (() => {});
        this.onBack = config.onBack || (() => {});
        this.autoConfirmOnHighlight = config.autoConfirmOnHighlight || false;

        this.currentHighlight = null;
        this.lastHighlightTime = 0;
        this.highlightDebounceMs = 200;
    }

    enter() {
        super.enter();
        this.currentHighlight = null;
        this.lastHighlightTime = 0;
    }

    exit() {
        super.exit();
        this.currentHighlight = null;
    }

    handleNoteStart(noteData) {
        if (!this.active) return;

        const now = performance.now();

        // Get interval from root
        const interval = Audio.getIntervalFromRoot(noteData.note);
        if (interval === null) return;

        // Normalize interval to 0-11
        const normalizedInterval = ((interval % 12) + 12) % 12;

        // Find matching choice
        const choice = this.choices.find(c => c.interval === normalizedInterval);

        if (choice) {
            // Debounce rapid re-highlights
            if (this.currentHighlight === choice && (now - this.lastHighlightTime) < this.highlightDebounceMs) {
                return;
            }

            this.currentHighlight = choice;
            this.lastHighlightTime = now;
            this.onHighlight(choice);

            // Auto-confirm if enabled
            if (this.autoConfirmOnHighlight) {
                this.onConfirm(choice);
            }
        }
    }

    handleNoteEnd(noteData) {
        if (!this.active) return;

        // Check for commands (confirm/back)
        const history = Audio.getNoteHistory(2);
        if (history.length < 2) return;

        const command = Audio.checkCommand(history);

        if (command === 'confirm') {
            UI.debugLog('Command: CONFIRM (Sol-Do)');
            if (this.currentHighlight) {
                this.onConfirm(this.currentHighlight);
            }
        } else if (command === 'back') {
            UI.debugLog('Command: BACK (Do-Sol)');
            this.onBack();
        }
    }

    /**
     * Programmatically select a choice by index
     */
    selectByIndex(index) {
        if (index >= 0 && index < this.choices.length) {
            const choice = this.choices[index];
            this.currentHighlight = choice;
            this.onConfirm(choice);
        }
    }

    /**
     * Get currently highlighted choice
     */
    getCurrentChoice() {
        return this.currentHighlight;
    }
}

/**
 * ScreenManager - Manages active screen and routes audio events
 */
export class ScreenManager {
    constructor() {
        this.currentScreen = null;
    }

    /**
     * Set the active screen
     */
    setScreen(screen) {
        if (this.currentScreen) {
            this.currentScreen.exit();
        }

        this.currentScreen = screen;

        if (this.currentScreen) {
            this.currentScreen.enter();
        }
    }

    /**
     * Clear active screen
     */
    clearScreen() {
        if (this.currentScreen) {
            this.currentScreen.exit();
        }
        this.currentScreen = null;
    }

    /**
     * Route audio callback to current screen
     */
    handlePitchDetected(noteInfo) {
        if (this.currentScreen) {
            this.currentScreen.handlePitchDetected(noteInfo);
        }
    }

    handleNoteStart(noteData) {
        if (this.currentScreen) {
            this.currentScreen.handleNoteStart(noteData);
        }
    }

    handleNoteEnd(noteData) {
        if (this.currentScreen) {
            this.currentScreen.handleNoteEnd(noteData);
        }
    }

    handleSilence(duration) {
        if (this.currentScreen) {
            this.currentScreen.handleSilence(duration);
        }
    }

    /**
     * Get current screen
     */
    getCurrentScreen() {
        return this.currentScreen;
    }

    /**
     * Check if a screen is active
     */
    isActive() {
        return this.currentScreen !== null;
    }
}
