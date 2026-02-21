/**
 * UI module for DOM manipulation and visual feedback
 */

// DOM element references (cached on init)
let elements = {};

// Metronome state
let metronomeInterval = null;
let currentBeat = 0;
let bpm = 60;

// Debug log
let debugEntries = [];
const MAX_DEBUG_ENTRIES = 20;

/**
 * Initialize UI - cache DOM references
 */
export function init() {
    elements = {
        // Status bar
        hpValue: document.querySelector('#hp-display .hp-value'),
        currentState: document.getElementById('current-state'),

        // Game states
        start: document.getElementById('start'),
        'instrument-setup': document.getElementById('instrument-setup'),
        menu: document.getElementById('menu'),
        gameplay: document.getElementById('gameplay'),
        results: document.getElementById('results'),
        gameover: document.getElementById('gameover'),

        // Calibration
        detectedPitch: document.getElementById('detected-pitch'),
        pitchStabilityFill: document.getElementById('pitch-stability-fill'),
        calibrationStatus: document.getElementById('calibration-status'),
        skipCalibration: document.getElementById('skip-calibration'),

        // Menu
        menuOptions: document.querySelectorAll('.menu-option'),

        // Gameplay
        tempoDisplay: document.getElementById('tempo-display'),
        beatDots: document.querySelectorAll('.beat-dot'),
        excerptDisplay: document.getElementById('excerpt-display'),
        playedNotes: document.getElementById('played-notes'),
        gameplayInstruction: document.getElementById('gameplay-instruction'),

        // Results
        resultSummary: document.getElementById('result-summary'),
        notesCorrect: document.getElementById('notes-correct'),
        notesTotal: document.getElementById('notes-total'),
        timingScore: document.getElementById('timing-score'),
        hpChange: document.getElementById('hp-change'),

        // Game over
        excerptsCompleted: document.getElementById('excerpts-completed'),
        totalNotes: document.getElementById('total-notes'),
        bestStreak: document.getElementById('best-streak'),

        // Debug
        debugLog: document.getElementById('debug-log')
    };
}

/**
 * Switch visible game state/screen
 */
export function showScreen(screenName) {
    // Map screen IDs to DOM element IDs
    const screenToElement = {
        'start': 'start',
        'instrument-setup': 'instrument-setup',
        'menu': 'menu',
        'countdown': 'gameplay',
        'performance': 'gameplay',
        'results': 'results',
        'game-over': 'gameover',
    };

    const elementId = screenToElement[screenName] || screenName;
    const allIds = [...new Set(Object.values(screenToElement))];

    allIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === elementId);
    });
    updateStateLabel(screenName);
}

// Keep old name as alias for compatibility
export function showState(stateName) {
    showScreen(stateName);
}

/**
 * Update the state label in status bar
 */
function updateStateLabel(stateName) {
    const labels = {
        'start': 'Welcome',
        'instrument-setup': 'Instrument Setup',
        'menu': 'Main Menu',
        'countdown': 'Get Ready...',
        'performance': 'Playing',
        'results': 'Results',
        'game-over': 'Game Over',
    };
    if (elements.currentState) {
        elements.currentState.textContent = labels[stateName] || stateName;
    }
}

/**
 * Update HP display
 */
export function updateHP(hp, maxHp = 100) {
    if (elements.hpValue) {
        elements.hpValue.textContent = hp;
        // Color based on HP level
        if (hp <= 20) {
            elements.hpValue.style.color = '#f87171';
        } else if (hp <= 50) {
            elements.hpValue.style.color = '#fbbf24';
        } else {
            elements.hpValue.style.color = '#4ade80';
        }
    }
}

// === Calibration UI ===

/**
 * Update detected pitch display during calibration
 */
export function updateCalibrationPitch(note) {
    if (elements.detectedPitch) {
        elements.detectedPitch.textContent = note || '-';
    }
}

/**
 * Update pitch stability indicator (0-100)
 */
export function updateCalibrationStability(percent) {
    if (elements.pitchStabilityFill) {
        elements.pitchStabilityFill.style.width = percent + '%';
    }
}

/**
 * Update calibration status message
 */
export function updateCalibrationStatus(message) {
    if (elements.calibrationStatus) {
        elements.calibrationStatus.textContent = message;
    }
}

// === Menu UI ===

/**
 * Highlight a menu option by index
 */
export function highlightMenuOption(index) {
    elements.menuOptions.forEach((option, i) => {
        option.classList.toggle('highlighted', i === index);
    });
}

/**
 * Clear menu highlighting
 */
export function clearMenuHighlight() {
    elements.menuOptions.forEach(option => {
        option.classList.remove('highlighted');
    });
}

// === Gameplay UI ===

/**
 * Set tempo display
 */
export function setTempo(newBpm) {
    bpm = newBpm;
    if (elements.tempoDisplay) {
        elements.tempoDisplay.textContent = bpm + ' BPM';
    }
}

/**
 * Start visual metronome
 */
export function startMetronome(onBeat) {
    stopMetronome();
    currentBeat = 0;
    const interval = 60000 / bpm;

    // Flash first beat immediately
    flashBeat(currentBeat);
    if (onBeat) onBeat(currentBeat);

    metronomeInterval = setInterval(() => {
        currentBeat = (currentBeat + 1) % 4;
        flashBeat(currentBeat);
        if (onBeat) onBeat(currentBeat);
    }, interval);
}

/**
 * Stop visual metronome
 */
export function stopMetronome() {
    if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
    }
    // Clear all beat indicators
    elements.beatDots.forEach(dot => {
        dot.classList.remove('active', 'current');
    });
}

/**
 * Flash beat indicator
 */
function flashBeat(beatIndex) {
    elements.beatDots.forEach((dot, i) => {
        dot.classList.remove('active', 'current');
        if (i === beatIndex) {
            dot.classList.add('active', 'current');
        }
    });

    // Remove active after brief moment
    setTimeout(() => {
        elements.beatDots[beatIndex]?.classList.remove('active');
    }, 100);
}

/**
 * Display excerpt notes
 */
export function displayExcerpt(notes) {
    if (elements.excerptDisplay) {
        if (Array.isArray(notes)) {
            elements.excerptDisplay.innerHTML = notes.map(n => `<span>${n}</span>`).join(' - ');
        } else {
            elements.excerptDisplay.textContent = notes;
        }
    }
}

/**
 * Update played notes display
 */
export function updatePlayedNotes(played, expected) {
    if (!elements.playedNotes) return;

    const html = expected.map((note, i) => {
        let className = 'pending';
        let display = '?';

        if (i < played.length) {
            const playedNote = played[i];
            const isCorrect = playedNote.correct;
            className = isCorrect ? 'correct' : 'incorrect';
            display = playedNote.note;
        }

        return `<span class="played-note ${className}">${display}</span>`;
    }).join('');

    elements.playedNotes.innerHTML = html;
}

/**
 * Clear played notes display
 */
export function clearPlayedNotes() {
    if (elements.playedNotes) {
        elements.playedNotes.innerHTML = '';
    }
}

/**
 * Update gameplay instruction text
 */
export function updateGameplayInstruction(text) {
    if (elements.gameplayInstruction) {
        elements.gameplayInstruction.textContent = text;
    }
}

// === Results UI ===

/**
 * Show results screen with data
 */
export function showResults(data) {
    showState('results');

    if (elements.resultSummary) {
        elements.resultSummary.textContent = data.success ? 'Well Done!' : 'Keep Practicing!';
        elements.resultSummary.className = 'result-summary ' + (data.success ? 'success' : 'failure');
    }

    if (elements.notesCorrect) elements.notesCorrect.textContent = data.notesCorrect;
    if (elements.notesTotal) elements.notesTotal.textContent = data.notesTotal;
    if (elements.timingScore) elements.timingScore.textContent = data.timingScore;
    if (elements.hpChange) {
        const sign = data.hpChange >= 0 ? '+' : '';
        elements.hpChange.textContent = sign + data.hpChange;
        elements.hpChange.style.color = data.hpChange >= 0 ? '#4ade80' : '#f87171';
    }
}

// === Game Over UI ===

/**
 * Show game over screen with stats
 */
export function showGameOver(stats) {
    showState('gameover');

    if (elements.excerptsCompleted) elements.excerptsCompleted.textContent = stats.excerptsCompleted;
    if (elements.totalNotes) elements.totalNotes.textContent = stats.totalNotes;
    if (elements.bestStreak) elements.bestStreak.textContent = stats.bestStreak;
}

// === Debug UI ===

/**
 * Add debug log entry
 */
export function debugLog(message) {
    const timestamp = new Date().toLocaleTimeString();
    debugEntries.push({ timestamp, message });

    if (debugEntries.length > MAX_DEBUG_ENTRIES) {
        debugEntries.shift();
    }

    if (elements.debugLog) {
        elements.debugLog.innerHTML = debugEntries
            .slice(-MAX_DEBUG_ENTRIES)
            .reverse()
            .map(e => `<div class="debug-entry">${e.timestamp} | ${e.message}</div>`)
            .join('');
    }

    console.log(`[Debug] ${message}`);
}

/**
 * Clear debug log
 */
export function clearDebugLog() {
    debugEntries = [];
    if (elements.debugLog) {
        elements.debugLog.innerHTML = '';
    }
}

/**
 * Get elements object (for event binding)
 */
export function getElements() {
    return elements;
}
