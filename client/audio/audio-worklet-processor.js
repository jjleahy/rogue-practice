import { initSync, MpmPitchDetector, OnsetDetector } from '/audio/lib/microdsp/main.js';

class AudioProcessor extends AudioWorkletProcessor {
  constructor({ processorOptions }) {
    super();

    // Initialize WASM synchronously with the bytes passed from main thread
    initSync(processorOptions.wasmBytes);

    // Create detectors
    // MpmPitchDetector(sampleRate, windowSize, hopSize)
    // - sampleRate: AudioContext sample rate (usually 44100 or 48000)
    // - windowSize: FFT window size (2048 recommended)
    // - hopSize: samples between analyses (512 recommended)
    this.pitchDetector = new MpmPitchDetector(sampleRate, 2048, 512);

    // OnsetDetector(windowSize)
    // - windowSize: should match pitch detector (2048)
    this.onsetDetector = new OnsetDetector(2048);

    // Track RMS for visualization
    this.rmsSmoothed = 0;
  }

  process(inputs) {
    if (inputs.length === 0 || inputs[0].length === 0) {
      return true;
    }

    const audioData = inputs[0][0]; // First input, first channel (Float32Array)

    // Calculate RMS for level metering
    let sumSquares = 0;
    for (let i = 0; i < audioData.length; i++) {
      sumSquares += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sumSquares / audioData.length);
    this.rmsSmoothed = this.rmsSmoothed * 0.8 + rms * 0.2;

    // Send RMS periodically (every ~10ms at 128 sample blocks)
    this.port.postMessage({
      type: 'level',
      rms: this.rmsSmoothed,
      audioTime: currentTime
    });

    // Pitch detection - callback fires when analysis completes
    this.pitchDetector.process(audioData, (frequencyHz, clarity, midiNoteNumber, isTone) => {
      this.port.postMessage({
        type: 'pitch',
        frequencyHz,
        clarity,
        midiNoteNumber,
        isTone,
        audioTime: currentTime
      });
    });

    // Onset detection - callback fires when onset detected
    this.onsetDetector.process(audioData, (novelty) => {
      this.port.postMessage({
        type: 'onset',
        novelty,
        audioTime: currentTime
      });
    });

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
