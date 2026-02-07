/**
 * CommandDetector - Detects command gestures from note sequences
 *
 * Consumes events from LenientNoteListener and detects:
 * - Confirm sequence (sol-do): triggers confirm callback
 * - Cancel sequence (do-sol): triggers cancel callback
 * - Active options (configurable pitches): triggers option callback
 *
 * Notes must be held for noteThreshold (default 400ms) to be registered.
 * Detection happens the moment a note crosses the threshold, not on note end.
 */

// Pitch class to solfege mapping (using instrument's written pitch)
const PITCH_TO_SOLFEGE = {
  'C': 'do',
  'D': 're',
  'E': 'mi',
  'F': 'fa',
  'G': 'sol',
  'A': 'la',
  'B': 'ti',
};

// Default configuration
const DEFAULT_CONFIG = {
  // Minimum note duration (ms) to register as a command note
  noteThreshold: 400,

  // Confirm sequence (e.g., sol-do = 5th down to root)
  confirmSequence: ['sol', 'do'],

  // Cancel sequence (e.g., do-sol = root up to 5th)
  cancelSequence: ['do', 'sol'],

  // Active options that trigger immediate selection
  activeOptions: ['re', 'mi', 'fa'],

  // Number of recent notes to remember for sequence detection
  memoryLength: 2,

  // Time (ms) of inactivity before memory is cleared
  memoryClearDelay: 1200,
};

class CommandDetector {
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };

    // State
    this._active = false;
    this._memory = [];  // Recent detected notes (solfege)
    this._pendingNote = null;  // { pitchClass, solfege, startTime, timerId }
    this._memoryClearTimerId = null;  // Timer for clearing stale memory

    // Listener arrays (multi-listener pattern)
    this._confirmListeners = [];
    this._cancelListeners = [];
    this._optionListeners = [];

    // Bound handlers for event subscription
    this._handleNoteStart = this._handleNoteStart.bind(this);
    this._handleNoteEnd = this._handleNoteEnd.bind(this);
  }

  // --- Configuration ---

  /**
   * Update configuration
   * @param {Partial<typeof DEFAULT_CONFIG>} config
   */
  configure(config) {
    Object.assign(this._config, config);
  }

  /**
   * Set active options (pitches that trigger option callback)
   * @param {string[]} options - Array of solfege names (e.g., ['re', 'mi', 'fa'])
   */
  setActiveOptions(options) {
    this._config.activeOptions = options;
  }

  /**
   * Get current active options
   * @returns {string[]}
   */
  getActiveOptions() {
    return [...this._config.activeOptions];
  }

  // --- Activation ---

  /**
   * Activate the command detector
   * Must be called after subscribing to LenientNoteListener
   */
  activate() {
    if (this._active) return;
    this._active = true;
    this._clearState();
  }

  /**
   * Deactivate the command detector
   * Clears all state and stops listening
   */
  deactivate() {
    if (!this._active) return;
    this._active = false;
    this._clearState();
  }

  /**
   * Check if detector is active
   * @returns {boolean}
   */
  isActive() {
    return this._active;
  }

  // --- Listeners ---

  /**
   * Add listener for confirm gesture (sol-do)
   * @param {function} callback
   * @returns {function} Unsubscribe function
   */
  onConfirm(callback) {
    this._confirmListeners.push(callback);
    return () => {
      const idx = this._confirmListeners.indexOf(callback);
      if (idx !== -1) this._confirmListeners.splice(idx, 1);
    };
  }

  /**
   * Add listener for cancel gesture (do-sol)
   * @param {function} callback
   * @returns {function} Unsubscribe function
   */
  onCancel(callback) {
    this._cancelListeners.push(callback);
    return () => {
      const idx = this._cancelListeners.indexOf(callback);
      if (idx !== -1) this._cancelListeners.splice(idx, 1);
    };
  }

  /**
   * Add listener for option selection
   * @param {function} callback - Receives { solfege, pitchClass }
   * @returns {function} Unsubscribe function
   */
  onOption(callback) {
    this._optionListeners.push(callback);
    return () => {
      const idx = this._optionListeners.indexOf(callback);
      if (idx !== -1) this._optionListeners.splice(idx, 1);
    };
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this._confirmListeners = [];
    this._cancelListeners = [];
    this._optionListeners = [];
  }

  // --- LenientNoteListener Integration ---

  /**
   * Subscribe to a LenientNoteListener
   * @param {LenientNoteListener} listener
   */
  subscribeTo(listener) {
    this._unsubNoteStart = listener.onNoteStart(this._handleNoteStart);
    this._unsubNoteEnd = listener.onNoteEnd(this._handleNoteEnd);
  }

  /**
   * Unsubscribe from previously subscribed LenientNoteListener
   */
  unsubscribeFrom() {
    if (this._unsubNoteStart) { this._unsubNoteStart(); this._unsubNoteStart = null; }
    if (this._unsubNoteEnd) { this._unsubNoteEnd(); this._unsubNoteEnd = null; }
  }

  /**
   * Get the note start handler (for manual subscription)
   * @returns {function}
   */
  getNoteStartHandler() {
    return this._handleNoteStart;
  }

  /**
   * Get the note end handler (for manual subscription)
   * @returns {function}
   */
  getNoteEndHandler() {
    return this._handleNoteEnd;
  }

  // --- Event Handlers ---

  _handleNoteStart(event) {
    if (!this._active) return;

    const { pitchClass, startTime } = event;

    // Get base pitch class (strip accidentals for solfege mapping)
    const basePitchClass = pitchClass.charAt(0);
    const solfege = PITCH_TO_SOLFEGE[basePitchClass];

    if (!solfege) {
      // Unknown pitch class, ignore
      return;
    }

    // Cancel any pending note timer
    this._cancelPendingNote();

    // Start timer for this note
    const timerId = setTimeout(() => {
      this._commitNote(solfege, pitchClass);
    }, this._config.noteThreshold);

    this._pendingNote = {
      pitchClass,
      solfege,
      startTime,
      timerId,
    };
  }

  _handleNoteEnd(event) {
    if (!this._active) return;

    // If there's a pending note and it ended before threshold, cancel it
    if (this._pendingNote) {
      const elapsed = event.endTime - this._pendingNote.startTime;
      if (elapsed < this._config.noteThreshold) {
        this._cancelPendingNote();
      }
      // If elapsed >= threshold, the timer already fired and committed the note
    }
  }

  // --- Internal Logic ---

  _emit(listeners, event) {
    for (const fn of listeners) {
      fn(event);
    }
  }

  _cancelPendingNote() {
    if (this._pendingNote) {
      clearTimeout(this._pendingNote.timerId);
      this._pendingNote = null;
    }
  }

  _commitNote(solfege, pitchClass) {
    this._pendingNote = null;

    // Add to memory
    this._memory.push(solfege);
    if (this._memory.length > this._config.memoryLength) {
      this._memory.shift();
    }

    // Reset memory clear timer
    this._resetMemoryClearTimer();

    // Check for sequences first (they take priority and clear memory)
    if (this._checkSequence(this._config.confirmSequence)) {
      this._memory = [];
      this._emit(this._confirmListeners);
      return;
    }

    if (this._checkSequence(this._config.cancelSequence)) {
      this._memory = [];
      this._emit(this._cancelListeners);
      return;
    }

    // Check for active options
    if (this._config.activeOptions.includes(solfege)) {
      this._emit(this._optionListeners, { solfege, pitchClass });
    }
  }

  _checkSequence(sequence) {
    if (this._memory.length < sequence.length) {
      return false;
    }

    // Check if the last N notes match the sequence
    const start = this._memory.length - sequence.length;
    for (let i = 0; i < sequence.length; i++) {
      if (this._memory[start + i] !== sequence[i]) {
        return false;
      }
    }
    return true;
  }

  _clearState() {
    this._cancelPendingNote();
    this._cancelMemoryClearTimer();
    this._memory = [];
  }

  _resetMemoryClearTimer() {
    this._cancelMemoryClearTimer();
    this._memoryClearTimerId = setTimeout(() => {
      this._memory = [];
    }, this._config.memoryClearDelay);
  }

  _cancelMemoryClearTimer() {
    if (this._memoryClearTimerId) {
      clearTimeout(this._memoryClearTimerId);
      this._memoryClearTimerId = null;
    }
  }

  // --- Debug ---

  /**
   * Get current memory (for debugging)
   * @returns {string[]}
   */
  getMemory() {
    return [...this._memory];
  }
}

export default CommandDetector;
export { CommandDetector, PITCH_TO_SOLFEGE, DEFAULT_CONFIG };
