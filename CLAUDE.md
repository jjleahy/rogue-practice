# Metronome & Tuner Web App

A browser-based practice tool combining a metronome and chromatic tuner, optimized for mobile and desktop use.

## Features

### Metronome
- Adjustable BPM (40-240)
- Visual beat indicator
- Audio click using Web Audio API

### Tuner
- Real-time pitch detection using autocorrelation
- Chromatic tuning (detects all notes, 50-2000 Hz range)
- Visual cents indicator showing tuning accuracy
- Color-coded feedback (green: ±5 cents, yellow: ±20 cents, red: beyond)
- Works on both desktop and mobile browsers

### Recording & Analysis
- Records last 5 seconds of audio for playback
- Detection log showing last 20 pitch detections
- Statistics tracking:
  - Detection rate (successful vs failed detections)
  - Most frequently detected notes with average frequencies
- Export stats to JSON for detailed analysis

## Technical Implementation

### Pitch Detection Algorithm
- **FFT Size**: 8192 samples for high frequency resolution
- **Autocorrelation**: Time-domain pitch detection with parabolic interpolation for sub-sample accuracy
- **RMS Threshold**: 0.005 for quiet sound detection
- **Correlation Threshold**: 0.9 for reliable pitch identification

### Mobile Compatibility
- Tested on iOS and Android
- Handles different audio codec support (webm, mp4, ogg)
- Proper AudioContext state management
- Touch-optimized UI

### Audio Configuration
- Microphone access with disabled audio processing:
  - No echo cancellation
  - No auto gain control
  - No noise suppression
- This ensures accurate pitch detection for musical instruments

## Development Notes

### Known Limitations
- Pitch detection requires relatively clear, sustained tones
- Quiet sounds may not be detected (adjust RMS threshold if needed)
- Best results with single-note instruments (voice, horn, etc.)

### Potential Future Enhancements
- Tuning presets (A=440, A=442, etc.)
- Strobe tuner mode
- Practice session recording
- Pitch tracking visualization
- Specific instrument modes
- Drone/reference pitch generator
- Interval trainer

## Usage

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari)
2. For HTTPS (required for mobile):
   ```bash
   # Using http-server with self-signed cert
   http-server -S -C cert.pem -K key.pem
   ```
3. Grant microphone permissions when prompted
4. Use metronome or tuner tabs as needed

## Browser Console Logging

Diagnostic logging is available via browser console:
- `[Recording]` - Audio chunk capture events
- `[Playback]` - Audio playback events and errors
- `[Detection]` - Pitch detection diagnostics (sampled at ~1-5%)
- `[Log]` - Display update errors

## Files

- `index.html` - Main UI and styling
- `main.js` - All application logic (metronome, tuner, recording)
- `cert.pem`, `key.pem` - Self-signed SSL certificates for local HTTPS

## Built With

- Vanilla JavaScript (no frameworks)
- Web Audio API
- MediaRecorder API
- Canvas/DOM for visualization