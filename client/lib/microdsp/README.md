# microdsp-web

WASM-based audio analysis: pitch detection (MPM algorithm) and onset detection (spectral flux).

**Source:** https://github.com/rfwatson/microdsp-web

**Note:** This is a vendored copy with onset detection added by Claude Code (Opus). The changes have not been reviewed and the fork has not been published. TODO: publish fork and install via npm.

## Files

- `main.js` - WASM bindings (ES module)
- `main_bg.wasm` - WASM binary

## Usage

### In an AudioWorklet (recommended for real-time audio)

The WASM must be initialized synchronously in the worklet since worklets can't use async/await in the constructor.

**Main thread (fetch WASM and set up worklet):**

```js
// Fetch WASM bytes before creating the worklet
const wasmResponse = await fetch('/client/lib/microdsp/main_bg.wasm');
const wasmBytes = await wasmResponse.arrayBuffer();

// Register the worklet
await audioContext.audioWorklet.addModule('/client/audio-worklet.js');

// Create worklet node, passing WASM bytes
const workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
  processorOptions: { wasmBytes }
});

// Listen for messages from worklet
workletNode.port.onmessage = (event) => {
  if (event.data.type === 'pitch') {
    const { frequencyHz, clarity, midiNoteNumber, isTone } = event.data;
    // frequencyHz: detected frequency in Hz
    // clarity: confidence score (0-1, higher is better)
    // midiNoteNumber: MIDI note number
    // isTone: boolean, true if a clear tone was detected
  } else if (event.data.type === 'onset') {
    const { novelty, audioTime } = event.data;
    // novelty: onset strength (typically 0.1+ indicates an onset)
    // audioTime: precise audio context time of the onset
  }
};

// Connect microphone to worklet
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(stream);
source.connect(workletNode);
```

**AudioWorklet processor (`audio-worklet.js`):**

```js
import { initSync, MpmPitchDetector, OnsetDetector } from './lib/microdsp/main.js';

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
  }

  process(inputs) {
    if (inputs.length === 0 || inputs[0].length === 0) {
      return true;
    }

    const audioData = inputs[0][0]; // First input, first channel (Float32Array)

    // Pitch detection - callback fires when analysis completes
    this.pitchDetector.process(audioData, (frequencyHz, clarity, midiNoteNumber, isTone) => {
      this.port.postMessage({
        type: 'pitch',
        frequencyHz,
        clarity,
        midiNoteNumber,
        isTone
      });
    });

    // Onset detection - callback fires when onset detected
    this.onsetDetector.process(audioData, (novelty) => {
      this.port.postMessage({
        type: 'onset',
        novelty,
        audioTime: currentTime  // AudioWorklet global for precise timing
      });
    });

    return true; // Keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
```

## API Reference

### MpmPitchDetector

```js
const detector = new MpmPitchDetector(sampleRate, windowSize, hopSize);
detector.process(float32Array, callback);
detector.free(); // Clean up when done
```

**Constructor parameters:**
- `sampleRate`: Audio sample rate (e.g., 48000)
- `windowSize`: Analysis window in samples (2048 recommended)
- `hopSize`: Samples between each analysis (512 recommended)

**Callback parameters:**
- `frequencyHz`: Detected frequency in Hz
- `clarity`: Confidence score 0-1 (values above 0.9 are high confidence)
- `midiNoteNumber`: MIDI note number (69 = A4 = 440Hz)
- `isTone`: Boolean indicating if a clear tonal signal was detected

### OnsetDetector

```js
const detector = new OnsetDetector(windowSize);
detector.process(float32Array, callback);
detector.free(); // Clean up when done
```

**Constructor parameters:**
- `windowSize`: Analysis window in samples (should match pitch detector)

**Callback parameters:**
- `novelty`: Onset strength. Values above ~0.1 typically indicate note onset. Higher values = stronger onset.

## Notes

- Both detectors use internal buffering, so you feed them small chunks (128 samples from AudioWorklet) and they handle windowing internally.
- The `audioTime` from `currentTime` in the worklet gives you precise timing for onset events (~10ms accuracy in testing).
- The pitch detector uses the MPM (McLeod Pitch Method) algorithm which is more accurate than simple autocorrelation.
- The onset detector uses spectral flux which detects changes in the frequency spectrum.
