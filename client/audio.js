/**
 * Audio module for pitch detection and note tracking
 * Adapted from metronome-test prototype
 */

const Audio = (function() {
    // Constants
    const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FFT_SIZE = 8192;
    const RMS_THRESHOLD = 0.005;
    const CORRELATION_THRESHOLD = 0.9;
    const MIN_FREQUENCY = 50;
    const MAX_FREQUENCY = 2000;

    // Note onset/offset detection settings
    const NOTE_HOLD_TIME = 80; // ms - minimum time to consider a note "held"
    const NOTE_CHANGE_THRESHOLD = 1.5; // semitones - how much pitch change triggers new note
    const SILENCE_THRESHOLD = 150; // ms - silence duration to consider note ended

    // State
    let audioContext = null;
    let analyserNode = null;
    let microphone = null;
    let isListening = false;
    let animationFrameId = null;

    // Note tracking state
    let currentNote = null;
    let currentNoteStartTime = null;
    let currentNoteFrequencies = [];
    let lastSoundTime = null;
    let noteHistory = [];

    // Callbacks
    let onPitchDetected = null;
    let onNoteStart = null;
    let onNoteEnd = null;
    let onSilence = null;

    // Calibration
    let calibrationRoot = null; // The player's fundamental note (e.g., "Bb3")
    let calibrationFrequency = null;

    /**
     * Initialize audio context and request microphone access
     */
    async function init() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            });

            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = FFT_SIZE;

            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyserNode);

            return true;
        } catch (error) {
            console.error('[Audio] Init error:', error);
            return false;
        }
    }

    /**
     * Start listening for audio input
     */
    function startListening() {
        if (!audioContext || isListening) return;

        isListening = true;
        currentNote = null;
        currentNoteStartTime = null;
        currentNoteFrequencies = [];
        lastSoundTime = null;

        processAudio();
    }

    /**
     * Stop listening for audio input
     */
    function stopListening() {
        isListening = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    /**
     * Main audio processing loop
     */
    function processAudio() {
        if (!isListening) return;

        const buffer = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(buffer);

        const frequency = autoCorrelate(buffer, audioContext.sampleRate);
        const now = performance.now();

        if (frequency > MIN_FREQUENCY && frequency < MAX_FREQUENCY) {
            // Valid pitch detected
            const noteInfo = frequencyToNoteInfo(frequency);
            lastSoundTime = now;

            // Notify of raw pitch
            if (onPitchDetected) {
                onPitchDetected(noteInfo);
            }

            // Note tracking logic
            if (currentNote === null) {
                // Starting a new note
                currentNote = noteInfo.note;
                currentNoteStartTime = now;
                currentNoteFrequencies = [frequency];
            } else {
                // Check if this is the same note or a new one
                const semitonesDiff = Math.abs(12 * Math.log2(frequency / getAverageFrequency()));

                if (semitonesDiff > NOTE_CHANGE_THRESHOLD) {
                    // Note changed - end previous and start new
                    finalizeNote(now);
                    currentNote = noteInfo.note;
                    currentNoteStartTime = now;
                    currentNoteFrequencies = [frequency];
                } else {
                    // Same note - accumulate frequency data
                    currentNoteFrequencies.push(frequency);

                    // Check if note has been held long enough to trigger
                    const holdDuration = now - currentNoteStartTime;
                    if (holdDuration >= NOTE_HOLD_TIME && currentNoteFrequencies.length === Math.ceil(NOTE_HOLD_TIME / 16)) {
                        // First time crossing hold threshold
                        if (onNoteStart) {
                            onNoteStart({
                                note: currentNote,
                                frequency: getAverageFrequency(),
                                startTime: currentNoteStartTime,
                                cents: getCentsFromFrequency(getAverageFrequency())
                            });
                        }
                    }
                }
            }
        } else {
            // No valid pitch detected (silence or noise)
            if (currentNote !== null && lastSoundTime !== null) {
                const silenceDuration = now - lastSoundTime;
                if (silenceDuration > SILENCE_THRESHOLD) {
                    // Note ended due to silence
                    finalizeNote(now);

                    if (onSilence) {
                        onSilence(silenceDuration);
                    }
                }
            }
        }

        animationFrameId = requestAnimationFrame(processAudio);
    }

    /**
     * Finalize the current note (called when note ends)
     */
    function finalizeNote(endTime) {
        if (currentNote === null || currentNoteStartTime === null) return;

        const duration = endTime - currentNoteStartTime;

        // Only count notes held long enough
        if (duration >= NOTE_HOLD_TIME) {
            const noteData = {
                note: currentNote,
                frequency: getAverageFrequency(),
                startTime: currentNoteStartTime,
                endTime: endTime,
                duration: duration,
                cents: getCentsFromFrequency(getAverageFrequency())
            };

            noteHistory.push(noteData);

            // Keep history limited
            if (noteHistory.length > 50) {
                noteHistory.shift();
            }

            if (onNoteEnd) {
                onNoteEnd(noteData);
            }
        }

        currentNote = null;
        currentNoteStartTime = null;
        currentNoteFrequencies = [];
    }

    /**
     * Get average frequency of current note
     */
    function getAverageFrequency() {
        if (currentNoteFrequencies.length === 0) return 0;
        return currentNoteFrequencies.reduce((a, b) => a + b, 0) / currentNoteFrequencies.length;
    }

    /**
     * Autocorrelation pitch detection
     * Adapted from prototype with parabolic interpolation
     */
    function autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let best_offset = -1;
        let best_correlation = 0;
        let rms = 0;

        // Calculate RMS
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);

        // Check if signal is loud enough
        if (rms < RMS_THRESHOLD) {
            return -1;
        }

        let lastCorrelation = 1;
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;

            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }

            correlation = 1 - (correlation / MAX_SAMPLES);

            if (correlation > CORRELATION_THRESHOLD && correlation > lastCorrelation) {
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            }

            lastCorrelation = correlation;
        }

        if (best_correlation > 0.01 && best_offset > 0) {
            // Parabolic interpolation for sub-sample accuracy
            let shift = 0;
            if (best_offset > 0 && best_offset < MAX_SAMPLES - 1) {
                let prev_correlation = 0;
                let next_correlation = 0;

                for (let i = 0; i < MAX_SAMPLES; i++) {
                    prev_correlation += Math.abs((buffer[i]) - (buffer[i + best_offset - 1]));
                    next_correlation += Math.abs((buffer[i]) - (buffer[i + best_offset + 1]));
                }
                prev_correlation = 1 - (prev_correlation / MAX_SAMPLES);
                next_correlation = 1 - (next_correlation / MAX_SAMPLES);

                const alpha = prev_correlation;
                const beta = best_correlation;
                const gamma = next_correlation;
                const divisor = alpha - 2 * beta + gamma;

                if (divisor !== 0) {
                    shift = 0.5 * (alpha - gamma) / divisor;
                }
            }

            return sampleRate / (best_offset + shift);
        }

        return -1;
    }

    /**
     * Convert frequency to detailed note info
     */
    function frequencyToNoteInfo(frequency) {
        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        const noteIndex = Math.round(noteNum) + 69;
        const noteName = NOTE_STRINGS[((noteIndex % 12) + 12) % 12];
        const octave = Math.floor(noteIndex / 12) - 1;
        const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);

        return {
            note: noteName + octave,
            noteName: noteName,
            octave: octave,
            frequency: frequency,
            cents: cents,
            midiNumber: noteIndex
        };
    }

    /**
     * Get cents deviation for a frequency
     */
    function getCentsFromFrequency(frequency) {
        const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        return Math.floor((noteNum - Math.round(noteNum)) * 100);
    }

    /**
     * Convert note name to frequency (A4 = 440Hz)
     */
    function noteToFrequency(noteName) {
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) return null;

        const note = match[1];
        const octave = parseInt(match[2]);
        const noteIndex = NOTE_STRINGS.indexOf(note);
        if (noteIndex === -1) return null;

        const midiNumber = (octave + 1) * 12 + noteIndex;
        return 440 * Math.pow(2, (midiNumber - 69) / 12);
    }

    /**
     * Check if two notes are the same pitch class (ignoring octave)
     */
    function sameNoteClass(note1, note2) {
        const name1 = note1.replace(/\d+$/, '');
        const name2 = note2.replace(/\d+$/, '');
        return name1 === name2;
    }

    /**
     * Set calibration root note
     */
    function setCalibrationRoot(note, frequency) {
        calibrationRoot = note;
        calibrationFrequency = frequency;
    }

    /**
     * Get interval from root (in semitones)
     */
    function getIntervalFromRoot(note) {
        if (!calibrationRoot) return null;

        const rootFreq = calibrationFrequency || noteToFrequency(calibrationRoot);
        const noteFreq = noteToFrequency(note);
        if (!rootFreq || !noteFreq) return null;

        return Math.round(12 * Math.log2(noteFreq / rootFreq));
    }

    /**
     * Check if note sequence matches a command
     * Returns: 'confirm' | 'back' | null
     */
    function checkCommand(noteSequence) {
        if (noteSequence.length < 2) return null;

        const last = noteSequence[noteSequence.length - 1];
        const prev = noteSequence[noteSequence.length - 2];

        const lastInterval = getIntervalFromRoot(last.note);
        const prevInterval = getIntervalFromRoot(prev.note);

        if (lastInterval === null || prevInterval === null) return null;

        // Sol-Do (5th to root) = confirm (intervals: 7 to 0)
        if (prevInterval % 12 === 7 && lastInterval % 12 === 0) {
            return 'confirm';
        }

        // Do-Sol (root to 5th) = back (intervals: 0 to 7)
        if (prevInterval % 12 === 0 && lastInterval % 12 === 7) {
            return 'back';
        }

        return null;
    }

    /**
     * Get recent note history
     */
    function getNoteHistory(count = 10) {
        return noteHistory.slice(-count);
    }

    /**
     * Clear note history
     */
    function clearNoteHistory() {
        noteHistory = [];
    }

    /**
     * Set callback functions
     */
    function setCallbacks(callbacks) {
        if (callbacks.onPitchDetected) onPitchDetected = callbacks.onPitchDetected;
        if (callbacks.onNoteStart) onNoteStart = callbacks.onNoteStart;
        if (callbacks.onNoteEnd) onNoteEnd = callbacks.onNoteEnd;
        if (callbacks.onSilence) onSilence = callbacks.onSilence;
    }

    /**
     * Clean up resources
     */
    function destroy() {
        stopListening();
        if (microphone && microphone.mediaStream) {
            microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
    }

    // Public API
    return {
        init,
        startListening,
        stopListening,
        setCallbacks,
        setCalibrationRoot,
        getIntervalFromRoot,
        checkCommand,
        getNoteHistory,
        clearNoteHistory,
        noteToFrequency,
        frequencyToNoteInfo,
        sameNoteClass,
        destroy,

        // Expose for debugging
        get isListening() { return isListening; },
        get currentNote() { return currentNote; },
        get calibrationRoot() { return calibrationRoot; }
    };
})();
