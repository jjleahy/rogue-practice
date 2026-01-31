/**
 * AudioInputManager - Orchestrates audio input and routes to listeners
 *
 * Responsibilities:
 * - Create and manage AudioWorklet connection
 * - Route worklet messages to registered listeners
 * - Manage audio lifecycle (start, stop, cleanup)
 * - Expose LenientNoteListener and PerformanceAnalyzer
 *
 * Usage:
 *   import audioManager from './audio/audio.js';
 *
 *   await audioManager.init();
 *   audioManager.lenientListener.onNoteStart(note => { ... });
 *   await audioManager.start();
 */

import instrumentContext from './instrument-context.js';
import LenientNoteListener from './lenient-note-listener.js';
import PerformanceAnalyzer from './performance-analyzer.js';

class AudioInputManager {
  constructor() {
    this._audioContext = null;
    this._workletNode = null;
    this._mediaStream = null;
    this._source = null;

    this._isInitialized = false;
    this._isRunning = false;

    // Listeners
    this._lenientListener = new LenientNoteListener();
    this._performanceAnalyzer = new PerformanceAnalyzer();

    // Raw event callback (for visualization/debugging)
    this._onRawEvent = null;

    // Level callback (separate since it's high-frequency)
    this._onLevel = null;
  }

  // --- Public accessors ---

  /**
   * Get the LenientNoteListener instance
   * @returns {LenientNoteListener}
   */
  get lenientListener() {
    return this._lenientListener;
  }

  /**
   * Get the PerformanceAnalyzer instance
   * @returns {PerformanceAnalyzer}
   */
  get performanceAnalyzer() {
    return this._performanceAnalyzer;
  }

  /**
   * Get the InstrumentContext singleton
   * @returns {InstrumentContext}
   */
  get instrumentContext() {
    return instrumentContext;
  }

  /**
   * Check if audio is initialized
   * @returns {boolean}
   */
  get isInitialized() {
    return this._isInitialized;
  }

  /**
   * Check if audio is running
   * @returns {boolean}
   */
  get isRunning() {
    return this._isRunning;
  }

  /**
   * Get the AudioContext (for timing reference)
   * @returns {AudioContext|null}
   */
  get audioContext() {
    return this._audioContext;
  }

  // --- Lifecycle ---

  /**
   * Initialize audio system (request mic permission, load worklet)
   * Must be called before start()
   * @returns {Promise<boolean>} Success
   */
  async init() {
    if (this._isInitialized) {
      console.warn('[AudioInputManager] Already initialized');
      return true;
    }

    try {
      // Create audio context
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[AudioInputManager] Sample rate:', this._audioContext.sampleRate);

      // Fetch WASM bytes - path relative to the HTML page loading this module
      const wasmResponse = await fetch('./lib/microdsp/main_bg.wasm');
      if (!wasmResponse.ok) {
        throw new Error(`Failed to fetch WASM: ${wasmResponse.status}`);
      }
      const wasmBytes = await wasmResponse.arrayBuffer();

      // Register worklet - path relative to the HTML page
      await this._audioContext.audioWorklet.addModule('./audio-worklet-processor.js');

      // Create worklet node
      this._workletNode = new AudioWorkletNode(this._audioContext, 'audio-processor', {
        processorOptions: { wasmBytes },
      });

      // Set up message handling
      this._workletNode.port.onmessage = (event) => this._handleWorkletMessage(event.data);

      this._isInitialized = true;
      console.log('[AudioInputManager] Initialized successfully');
      return true;

    } catch (error) {
      console.error('[AudioInputManager] Init failed:', error);
      this._cleanup();
      return false;
    }
  }

  /**
   * Start audio capture
   * Requires init() to have been called first
   * @returns {Promise<boolean>} Success
   */
  async start() {
    if (!this._isInitialized) {
      console.error('[AudioInputManager] Not initialized - call init() first');
      return false;
    }

    if (this._isRunning) {
      console.warn('[AudioInputManager] Already running');
      return true;
    }

    try {
      // Resume audio context if suspended
      if (this._audioContext.state === 'suspended') {
        await this._audioContext.resume();
      }

      // Get microphone access
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Connect microphone to worklet
      this._source = this._audioContext.createMediaStreamSource(this._mediaStream);
      this._source.connect(this._workletNode);

      this._isRunning = true;
      console.log('[AudioInputManager] Started');
      return true;

    } catch (error) {
      console.error('[AudioInputManager] Start failed:', error);
      return false;
    }
  }

  /**
   * Stop audio capture (but keep worklet loaded)
   */
  stop() {
    if (!this._isRunning) return;

    // Disconnect source
    if (this._source) {
      this._source.disconnect();
      this._source = null;
    }

    // Stop media stream
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach(track => track.stop());
      this._mediaStream = null;
    }

    this._isRunning = false;
    console.log('[AudioInputManager] Stopped');
  }

  /**
   * Clean up all resources
   * Call when completely done with audio
   */
  destroy() {
    this.stop();
    this._cleanup();
  }

  _cleanup() {
    if (this._workletNode) {
      this._workletNode.disconnect();
      this._workletNode = null;
    }

    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }

    this._isInitialized = false;
    console.log('[AudioInputManager] Cleaned up');
  }

  // --- Message routing ---

  _handleWorkletMessage(data) {
    // Notify raw event callback
    if (this._onRawEvent) {
      this._onRawEvent(data);
    }

    switch (data.type) {
      case 'pitch':
        this._lenientListener.handlePitch(data);
        this._performanceAnalyzer.handlePitch(data);
        break;

      case 'onset':
        // Only PerformanceAnalyzer needs onset events (for precise timing)
        // LenientNoteListener just uses pitch stability
        this._performanceAnalyzer.handleOnset(data);
        break;

      case 'level':
        this._lenientListener.handleLevel(data);
        if (this._onLevel) {
          this._onLevel(data);
        }
        break;
    }
  }

  // --- Callbacks ---

  /**
   * Set callback for raw worklet events (for debugging/visualization)
   * @param {function} callback - Receives { type, ...data }
   */
  onRawEvent(callback) {
    this._onRawEvent = callback;
  }

  /**
   * Set callback for level events (separate since high-frequency)
   * @param {function} callback - Receives { rms, audioTime }
   */
  onLevel(callback) {
    this._onLevel = callback;
  }

  // --- Utility ---

  /**
   * Reset all listeners and clear state
   */
  reset() {
    this._lenientListener.reset();
    this._performanceAnalyzer.reset();
  }
}

// Singleton instance
const audioManager = new AudioInputManager();

export default audioManager;
export { AudioInputManager };
