// Tab switching
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;

        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// ============ METRONOME ============
let metronomeInterval = null;
let bpm = 120;
let audioContext = null;

const bpmDisplay = document.getElementById('bpmDisplay');
const bpmSlider = document.getElementById('bpmSlider');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const beatIndicator = document.getElementById('beatIndicator');

bpmSlider.addEventListener('input', (e) => {
    bpm = parseInt(e.target.value);
    bpmDisplay.textContent = bpm;

    if (metronomeInterval) {
        stopMetronome();
        startMetronome();
    }
});

startButton.addEventListener('click', startMetronome);
stopButton.addEventListener('click', stopMetronome);

function startMetronome() {
    if (metronomeInterval) return;

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const interval = 60000 / bpm;

    playClick();

    metronomeInterval = setInterval(() => {
        playClick();
    }, interval);
}

function stopMetronome() {
    if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
    }
}

function playClick() {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);

    beatIndicator.classList.add('active');
    setTimeout(() => {
        beatIndicator.classList.remove('active');
    }, 100);
}

// ============ TUNER ============
let analyserNode = null;
let microphone = null;
let tunerInterval = null;
let tunerAudioContext = null;
let mediaRecorder = null;
let audioChunks = [];
let recordedAudioBuffer = null;
let recordedMimeType = 'audio/webm';

const noteDisplay = document.getElementById('noteDisplay');
const frequencyDisplay = document.getElementById('frequencyDisplay');
const centsIndicator = document.getElementById('centsIndicator');
const startTuner = document.getElementById('startTuner');
const stopTuner = document.getElementById('stopTuner');
const statusMessage = document.getElementById('statusMessage');
const playbackButton = document.getElementById('playbackButton');
const logDisplay = document.getElementById('logDisplay');
const logStats = document.getElementById('logStats');
const clearLog = document.getElementById('clearLog');
const exportStats = document.getElementById('exportStats');

const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Logging data
let detectionLog = [];
let detectionStats = {};

startTuner.addEventListener('click', async () => {
    try {
        statusMessage.textContent = 'Requesting microphone access...';

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false
            }
        });

        tunerAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = tunerAudioContext.createAnalyser();
        analyserNode.fftSize = 8192; // Increased for better resolution

        microphone = tunerAudioContext.createMediaStreamSource(stream);
        microphone.connect(analyserNode);

        // Set up audio recording (last 5 seconds)
        audioChunks = [];

        // Try to find a supported mime type
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                mimeType = 'audio/ogg;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else {
                mimeType = ''; // Let browser choose
            }
        }

        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recordedMimeType = mediaRecorder.mimeType;
        console.log('Recording with mime type:', recordedMimeType);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                console.log('[Recording] Chunk received - size:', event.data.size, 'total chunks:', audioChunks.length + 1);
                audioChunks.push(event.data);
                // Keep only last 5 seconds worth of chunks (approximate)
                // Each chunk is ~1 second with timeslice of 1000ms
                if (audioChunks.length > 5) {
                    audioChunks.shift();
                }
            } else {
                console.log('[Recording] Received empty chunk');
            }
        };

        mediaRecorder.start(1000); // Capture in 1-second chunks

        statusMessage.textContent = 'Tuner active - Recording last 5s';

        tunerInterval = setInterval(updatePitch, 100);
    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusMessage.textContent = 'Error: ' + error.message;
    }
});

stopTuner.addEventListener('click', () => {
    if (tunerInterval) {
        clearInterval(tunerInterval);
        tunerInterval = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (microphone && microphone.mediaStream) {
        microphone.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (tunerAudioContext) {
        tunerAudioContext.close();
        tunerAudioContext = null;
    }

    noteDisplay.textContent = '-';
    frequencyDisplay.textContent = '--- Hz';
    centsIndicator.style.left = '50%';
    statusMessage.textContent = 'Tuner stopped';
});

// Playback functionality
playbackButton.addEventListener('click', async () => {
    if (audioChunks.length === 0) {
        statusMessage.textContent = 'No audio recorded yet - start tuner first';
        console.log('[Playback] No audio chunks available');
        return;
    }

    try {
        // Use the same mime type that was used for recording
        const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
        console.log('[Playback] Blob created - size:', audioBlob.size, 'type:', recordedMimeType, 'chunks:', audioChunks.length);

        if (audioBlob.size === 0) {
            statusMessage.textContent = 'No audio data available';
            console.log('[Playback] Blob size is zero');
            return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        console.log('[Playback] Audio element created, attempting play...');

        // Resume AudioContext if suspended (required for mobile)
        if (tunerAudioContext && tunerAudioContext.state === 'suspended') {
            await tunerAudioContext.resume();
            console.log('[Playback] AudioContext resumed');
        }

        audio.play().then(() => {
            console.log('[Playback] Play started successfully');
            statusMessage.textContent = 'Playing back last 5s...';
        }).catch(err => {
            console.error('[Playback] Play error:', err);
            console.error('[Playback] Error name:', err.name, 'message:', err.message);
            statusMessage.textContent = 'Playback error: ' + err.message;
            URL.revokeObjectURL(audioUrl);
        });

        audio.onended = () => {
            console.log('[Playback] Playback complete');
            statusMessage.textContent = 'Playback complete';
            URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = (e) => {
            console.error('[Playback] Audio element error:', e);
            console.error('[Playback] Error details:', audio.error);
            statusMessage.textContent = 'Audio error: ' + (audio.error ? audio.error.message : 'unknown');
            URL.revokeObjectURL(audioUrl);
        };
    } catch (error) {
        console.error('[Playback] Exception:', error);
        console.error('[Playback] Stack:', error.stack);
        statusMessage.textContent = 'Error: ' + error.message;
    }
});

function autoCorrelate(buffer, sampleRate) {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
        const val = buffer[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    // Lower threshold for quieter sounds
    if (rms < 0.005) {
        if (Math.random() < 0.01) { // Log occasionally to avoid spam
            console.log('[Detection] RMS too low:', rms.toFixed(5), 'threshold: 0.005');
        }
        return -1;
    }

    let lastCorrelation = 1;
    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
        let correlation = 0;

        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
        }

        correlation = 1 - (correlation / MAX_SAMPLES);

        if (correlation > 0.9 && correlation > lastCorrelation) {
            const foundGoodCorrelation = true;
            if (foundGoodCorrelation) {
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            }
        }

        lastCorrelation = correlation;
    }

    if (best_correlation > 0.01 && best_offset > 0) {
        // Parabolic interpolation for sub-sample accuracy
        let shift = 0;
        if (best_offset > 0 && best_offset < MAX_SAMPLES - 1) {
            // Get correlation values around the peak
            let prev_correlation = 0;
            let next_correlation = 0;

            for (let i = 0; i < MAX_SAMPLES; i++) {
                prev_correlation += Math.abs((buffer[i]) - (buffer[i + best_offset - 1]));
                next_correlation += Math.abs((buffer[i]) - (buffer[i + best_offset + 1]));
            }
            prev_correlation = 1 - (prev_correlation / MAX_SAMPLES);
            next_correlation = 1 - (next_correlation / MAX_SAMPLES);

            // Parabolic interpolation
            const alpha = prev_correlation;
            const beta = best_correlation;
            const gamma = next_correlation;
            const divisor = alpha - 2 * beta + gamma;

            if (divisor !== 0) {
                shift = 0.5 * (alpha - gamma) / divisor;
            }
        }

        const frequency = sampleRate / (best_offset + shift);

        if (Math.random() < 0.05) { // Log occasionally
            console.log('[Detection] Success - RMS:', rms.toFixed(5), 'Corr:', best_correlation.toFixed(3), 'Freq:', frequency.toFixed(1), 'Shift:', shift.toFixed(3));
        }
        return frequency;
    }

    if (Math.random() < 0.01) { // Log occasionally
        console.log('[Detection] Low correlation:', best_correlation.toFixed(3), 'RMS:', rms.toFixed(5));
    }

    return -1;
}

function frequencyToNote(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const noteIndex = Math.round(noteNum) + 69;
    const noteName = noteStrings[noteIndex % 12];
    const octave = Math.floor(noteIndex / 12) - 1;
    return noteName + octave;
}

function getCents(frequency) {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const rounded = Math.round(noteNum);
    const cents = Math.floor((noteNum - rounded) * 100);
    return cents;
}

function updatePitch() {
    if (!analyserNode) return;

    const buffer = new Float32Array(analyserNode.fftSize);
    analyserNode.getFloatTimeDomainData(buffer);

    const frequency = autoCorrelate(buffer, tunerAudioContext.sampleRate);

    // Log detection result
    const timestamp = new Date().toLocaleTimeString();
    let logEntry;

    if (frequency > -1 && frequency > 50 && frequency < 2000) {
        const note = frequencyToNote(frequency);
        const cents = getCents(frequency);

        // Update display
        noteDisplay.textContent = note;
        frequencyDisplay.textContent = frequency.toFixed(1) + ' Hz';

        const centsPercent = 50 + (cents / 2);
        centsIndicator.style.left = centsPercent + '%';

        if (Math.abs(cents) < 5) {
            centsIndicator.style.background = '#4CAF50';
        } else if (Math.abs(cents) < 20) {
            centsIndicator.style.background = '#FFC107';
        } else {
            centsIndicator.style.background = '#f44336';
        }

        // Log successful detection
        logEntry = {
            timestamp,
            frequency: frequency.toFixed(2),
            note,
            cents,
            detected: true
        };

        // Update stats
        if (!detectionStats[note]) {
            detectionStats[note] = { count: 0, frequencies: [] };
        }
        detectionStats[note].count++;
        detectionStats[note].frequencies.push(parseFloat(frequency.toFixed(2)));
    } else {
        // Log no detection
        logEntry = {
            timestamp,
            frequency: 'N/A',
            note: '-',
            cents: 0,
            detected: false
        };
    }

    // Add to log
    detectionLog.push(logEntry);

    // Keep log limited to last 100 entries
    if (detectionLog.length > 100) {
        detectionLog.shift();
    }

    // Update log display (throttle on mobile for performance)
    try {
        updateLogDisplay();
    } catch (error) {
        console.error('[Log] Display update error:', error);
    }
}

function updateLogDisplay() {
    // Display last 20 entries
    const recentEntries = detectionLog.slice(-20).reverse();
    logDisplay.innerHTML = recentEntries.map(entry => {
        const color = entry.detected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        const freqStr = typeof entry.frequency === 'string' ? entry.frequency : entry.frequency.toString();
        const noteStr = entry.note.toString();
        return `<div class="log-entry" style="background: ${color}; padding: 5px; border-radius: 3px;">
            ${entry.timestamp} | ${noteStr.padEnd(4)} | ${freqStr.padStart(8)} Hz | ${entry.cents > 0 ? '+' : ''}${entry.cents} cents
        </div>`;
    }).join('');

    // Update stats display
    updateStatsDisplay();
}

function updateStatsDisplay() {
    const totalDetections = detectionLog.filter(e => e.detected).length;
    const totalAttempts = detectionLog.length;
    const detectionRate = totalAttempts > 0 ? ((totalDetections / totalAttempts) * 100).toFixed(1) : 0;

    const sortedNotes = Object.entries(detectionStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

    let statsHTML = `<div style="margin-bottom: 10px;">
        <strong>Detection Rate:</strong> ${detectionRate}% (${totalDetections}/${totalAttempts})
    </div>`;

    if (sortedNotes.length > 0) {
        statsHTML += '<div><strong>Top Detected Notes:</strong></div>';
        sortedNotes.forEach(([note, data]) => {
            const avgFreq = (data.frequencies.reduce((a, b) => a + b, 0) / data.frequencies.length).toFixed(2);
            statsHTML += `<div>${note}: ${data.count} times (avg: ${avgFreq} Hz)</div>`;
        });
    }

    logStats.innerHTML = statsHTML;
}

// Clear log button
clearLog.addEventListener('click', () => {
    detectionLog = [];
    detectionStats = {};
    logDisplay.innerHTML = '<div class="log-entry">Log cleared</div>';
    logStats.innerHTML = '<div>No data yet</div>';
});

// Export stats button
exportStats.addEventListener('click', () => {
    const exportData = {
        timestamp: new Date().toISOString(),
        totalDetections: detectionLog.filter(e => e.detected).length,
        totalAttempts: detectionLog.length,
        detectionRate: (detectionLog.filter(e => e.detected).length / detectionLog.length * 100).toFixed(2) + '%',
        stats: detectionStats,
        recentLog: detectionLog.slice(-50)
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `tuner-stats-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    statusMessage.textContent = 'Stats exported to JSON file';
});
