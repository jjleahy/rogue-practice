/**
 * Game state machine and core logic
 */

const Game = (function() {
    // Game states
    const STATES = {
        INIT: 'init',
        CALIBRATION: 'calibration',
        MENU: 'menu',
        COUNTDOWN: 'countdown',
        PLAYING: 'playing',
        RESULTS: 'results',
        GAMEOVER: 'gameover'
    };

    // Current state
    let currentState = STATES.INIT;

    // Run state
    let hp = 100;
    let maxHp = 100;
    let excerptsCompleted = 0;
    let totalNotesHit = 0;
    let bestStreak = 0;
    let currentStreak = 0;

    // Calibration state
    let calibrationPitches = [];
    let calibrationStartTime = null;
    const CALIBRATION_HOLD_TIME = 1500; // ms to hold note for calibration
    const CALIBRATION_STABILITY_THRESHOLD = 2; // semitones

    // Current excerpt state
    let currentExcerpt = null;
    let playedNotes = [];
    let excerptStartTime = null;
    let currentBeat = 0;
    let expectedNoteIndex = 0;

    // Hardcoded test excerpts
    const TEST_EXCERPTS = [
        {
            name: 'Simple Scale Up',
            notes: ['C4', 'D4', 'E4', 'F4'],
            bpm: 60,
            difficulty: 1
        },
        {
            name: 'Alternating Notes',
            notes: ['C4', 'E4', 'C4', 'E4', 'C4', 'E4'],
            bpm: 60,
            difficulty: 1
        },
        {
            name: 'Scale Down',
            notes: ['G4', 'F4', 'E4', 'D4', 'C4'],
            bpm: 72,
            difficulty: 2
        },
        {
            name: 'Arpeggio',
            notes: ['C4', 'E4', 'G4', 'C5'],
            bpm: 80,
            difficulty: 2
        }
    ];

    /**
     * Initialize the game
     */
    async function init() {
        UI.init();
        UI.debugLog('Game initializing...');

        // Initialize audio
        const audioReady = await Audio.init();
        if (!audioReady) {
            UI.debugLog('ERROR: Could not initialize audio');
            UI.updateCalibrationStatus('Microphone access denied');
            return;
        }

        // Set up audio callbacks
        Audio.setCallbacks({
            onPitchDetected: handlePitchDetected,
            onNoteStart: handleNoteStart,
            onNoteEnd: handleNoteEnd,
            onSilence: handleSilence
        });

        // Set up skip calibration button (debug)
        UI.elements.skipCalibration?.addEventListener('click', () => {
            skipCalibration();
        });

        // Start listening and enter calibration
        Audio.startListening();
        enterState(STATES.CALIBRATION);

        UI.debugLog('Game initialized');
    }

    /**
     * Enter a new state
     */
    function enterState(newState) {
        UI.debugLog(`State: ${currentState} -> ${newState}`);
        currentState = newState;

        switch (newState) {
            case STATES.CALIBRATION:
                enterCalibration();
                break;
            case STATES.MENU:
                enterMenu();
                break;
            case STATES.COUNTDOWN:
                enterCountdown();
                break;
            case STATES.PLAYING:
                enterPlaying();
                break;
            case STATES.RESULTS:
                enterResults();
                break;
            case STATES.GAMEOVER:
                enterGameOver();
                break;
        }
    }

    // === State Enter Functions ===

    function enterCalibration() {
        UI.showState('calibration');
        UI.updateCalibrationStatus('Play and hold your fundamental note...');
        UI.updateCalibrationStability(0);
        calibrationPitches = [];
        calibrationStartTime = null;
    }

    function enterMenu() {
        UI.showState('menu');
        UI.clearMenuHighlight();
    }

    function enterCountdown() {
        UI.showState('gameplay');
        UI.updateGameplayInstruction('Get ready...');
        UI.clearPlayedNotes();

        // Display the excerpt
        if (currentExcerpt) {
            UI.displayExcerpt(currentExcerpt.notes.map(n => n.replace(/\d+$/, '')));
            UI.setTempo(currentExcerpt.bpm);
        }

        // 4-beat countdown
        let countdown = 4;
        UI.updateGameplayInstruction(`Starting in ${countdown}...`);

        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                UI.updateGameplayInstruction(`Starting in ${countdown}...`);
            } else {
                clearInterval(countdownInterval);
                enterState(STATES.PLAYING);
            }
        }, 60000 / (currentExcerpt?.bpm || 60));
    }

    function enterPlaying() {
        playedNotes = [];
        excerptStartTime = performance.now();
        expectedNoteIndex = 0;
        currentBeat = 0;

        UI.updateGameplayInstruction('Play!');
        Audio.clearNoteHistory();

        // Start metronome
        UI.startMetronome((beat) => {
            currentBeat = beat;
            // Could trigger timing checks here
        });
    }

    function enterResults() {
        UI.stopMetronome();

        // Calculate results
        const notesCorrect = playedNotes.filter(n => n.correct).length;
        const notesTotal = currentExcerpt?.notes.length || 0;
        const accuracy = notesTotal > 0 ? notesCorrect / notesTotal : 0;

        // Determine success and HP change
        let success = accuracy >= 0.5;
        let hpChange = 0;

        if (accuracy >= 0.9) {
            hpChange = 20;
        } else if (accuracy >= 0.7) {
            hpChange = 10;
        } else if (accuracy >= 0.5) {
            hpChange = 0;
        } else if (accuracy >= 0.3) {
            hpChange = -10;
        } else {
            hpChange = -25;
        }

        // Apply HP change
        hp = Math.max(0, Math.min(maxHp, hp + hpChange));
        UI.updateHP(hp, maxHp);

        // Update stats
        if (success) {
            excerptsCompleted++;
            totalNotesHit += notesCorrect;
            currentStreak += notesCorrect;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }

        // Show results
        UI.showResults({
            success,
            notesCorrect,
            notesTotal,
            timingScore: accuracy >= 0.7 ? 'Good' : accuracy >= 0.5 ? 'OK' : 'Needs Work',
            hpChange
        });

        UI.debugLog(`Result: ${notesCorrect}/${notesTotal} (${Math.round(accuracy * 100)}%), HP: ${hpChange >= 0 ? '+' : ''}${hpChange}`);

        // Check for game over
        if (hp <= 0) {
            setTimeout(() => enterState(STATES.GAMEOVER), 2000);
        }
    }

    function enterGameOver() {
        UI.showGameOver({
            excerptsCompleted,
            totalNotes: totalNotesHit,
            bestStreak
        });
        resetRun();
    }

    // === Audio Callbacks ===

    function handlePitchDetected(noteInfo) {
        // Update UI with real-time pitch during calibration
        if (currentState === STATES.CALIBRATION) {
            UI.updateCalibrationPitch(noteInfo.note);
        }
    }

    function handleNoteStart(noteData) {
        UI.debugLog(`Note start: ${noteData.note} (${noteData.cents >= 0 ? '+' : ''}${noteData.cents}c)`);

        switch (currentState) {
            case STATES.CALIBRATION:
                handleCalibrationNote(noteData);
                break;
            case STATES.MENU:
                handleMenuNote(noteData);
                break;
            case STATES.PLAYING:
                handlePlayingNote(noteData);
                break;
            case STATES.RESULTS:
            case STATES.GAMEOVER:
                handleNavigationNote(noteData);
                break;
        }
    }

    function handleNoteEnd(noteData) {
        UI.debugLog(`Note end: ${noteData.note} (${Math.round(noteData.duration)}ms)`);

        // Check for commands after note ends
        if (currentState !== STATES.PLAYING) {
            checkForCommand();
        }
    }

    function handleSilence(duration) {
        // Could use this to detect pauses between phrases
    }

    // === State-specific Note Handling ===

    function handleCalibrationNote(noteData) {
        const now = performance.now();

        // Check if this is consistent with previous pitches
        if (calibrationPitches.length > 0) {
            const lastPitch = calibrationPitches[calibrationPitches.length - 1];
            const semitonesDiff = Math.abs(12 * Math.log2(noteData.frequency / lastPitch.frequency));

            if (semitonesDiff > CALIBRATION_STABILITY_THRESHOLD) {
                // Pitch changed too much, reset
                calibrationPitches = [];
                calibrationStartTime = null;
                UI.updateCalibrationStability(0);
                UI.updateCalibrationStatus('Hold the note steady...');
            }
        }

        calibrationPitches.push(noteData);

        if (calibrationStartTime === null) {
            calibrationStartTime = now;
        }

        // Calculate stability progress
        const holdDuration = now - calibrationStartTime;
        const stabilityPercent = Math.min(100, (holdDuration / CALIBRATION_HOLD_TIME) * 100);
        UI.updateCalibrationStability(stabilityPercent);

        if (holdDuration >= CALIBRATION_HOLD_TIME && calibrationPitches.length >= 5) {
            // Calibration complete
            const avgFrequency = calibrationPitches.reduce((sum, p) => sum + p.frequency, 0) / calibrationPitches.length;
            const noteInfo = Audio.frequencyToNoteInfo(avgFrequency);

            Audio.setCalibrationRoot(noteInfo.note, avgFrequency);
            UI.updateCalibrationStatus(`Calibrated to ${noteInfo.note}!`);
            UI.debugLog(`Calibration complete: ${noteInfo.note} @ ${avgFrequency.toFixed(1)}Hz`);

            setTimeout(() => enterState(STATES.MENU), 1000);
        } else {
            UI.updateCalibrationStatus(`Hold ${noteData.note}... ${Math.round(holdDuration)}ms`);
        }
    }

    function handleMenuNote(noteData) {
        // Map notes to menu options based on interval from root
        const interval = Audio.getIntervalFromRoot(noteData.note);
        if (interval === null) return;

        // C = 0, E = 4, G = 7 (assuming C root)
        const normalizedInterval = ((interval % 12) + 12) % 12;

        let menuIndex = -1;
        if (normalizedInterval === 0) menuIndex = 0; // Root -> Start
        else if (normalizedInterval === 4) menuIndex = 1; // Major 3rd -> Practice
        else if (normalizedInterval === 7) menuIndex = 2; // 5th -> Settings

        if (menuIndex >= 0) {
            UI.highlightMenuOption(menuIndex);
        }
    }

    function handlePlayingNote(noteData) {
        if (!currentExcerpt || expectedNoteIndex >= currentExcerpt.notes.length) return;

        const expectedNote = currentExcerpt.notes[expectedNoteIndex];
        const isCorrect = Audio.sameNoteClass(noteData.note, expectedNote);

        playedNotes.push({
            note: noteData.note.replace(/\d+$/, ''),
            expected: expectedNote.replace(/\d+$/, ''),
            correct: isCorrect,
            cents: noteData.cents,
            time: performance.now() - excerptStartTime
        });

        UI.updatePlayedNotes(playedNotes, currentExcerpt.notes);
        UI.debugLog(`Played ${noteData.note}, expected ${expectedNote}: ${isCorrect ? 'CORRECT' : 'WRONG'}`);

        expectedNoteIndex++;

        // Check if excerpt is complete
        if (expectedNoteIndex >= currentExcerpt.notes.length) {
            setTimeout(() => enterState(STATES.RESULTS), 500);
        }
    }

    function handleNavigationNote(noteData) {
        // Just highlight/prepare for command
    }

    function checkForCommand() {
        const history = Audio.getNoteHistory(2);
        if (history.length < 2) return;

        const command = Audio.checkCommand(history);

        if (command === 'confirm') {
            UI.debugLog('Command: CONFIRM (Sol-Do)');
            handleConfirm();
        } else if (command === 'back') {
            UI.debugLog('Command: BACK (Do-Sol)');
            handleBack();
        }
    }

    function handleConfirm() {
        switch (currentState) {
            case STATES.MENU:
                // Start a run with a random excerpt
                startNewExcerpt();
                break;
            case STATES.RESULTS:
                if (hp > 0) {
                    startNewExcerpt();
                } else {
                    enterState(STATES.GAMEOVER);
                }
                break;
            case STATES.GAMEOVER:
                enterState(STATES.CALIBRATION);
                break;
        }
    }

    function handleBack() {
        switch (currentState) {
            case STATES.RESULTS:
                enterState(STATES.MENU);
                break;
            case STATES.MENU:
                // Could go to settings or something
                break;
        }
    }

    // === Game Actions ===

    function startNewExcerpt() {
        // Pick a random excerpt (could be difficulty-weighted later)
        const availableExcerpts = TEST_EXCERPTS.filter(e => e.difficulty <= Math.ceil(excerptsCompleted / 2) + 1);
        currentExcerpt = availableExcerpts[Math.floor(Math.random() * availableExcerpts.length)] || TEST_EXCERPTS[0];

        UI.debugLog(`Starting excerpt: ${currentExcerpt.name}`);
        enterState(STATES.COUNTDOWN);
    }

    function resetRun() {
        hp = 100;
        excerptsCompleted = 0;
        totalNotesHit = 0;
        bestStreak = 0;
        currentStreak = 0;
        UI.updateHP(hp, maxHp);
    }

    function skipCalibration() {
        // Debug function - set C4 as root
        Audio.setCalibrationRoot('C4', 261.63);
        UI.debugLog('Calibration skipped - using C4 as root');
        enterState(STATES.MENU);
    }

    // Public API
    return {
        init,
        get currentState() { return currentState; },
        get hp() { return hp; },

        // Debug/testing
        skipCalibration,
        startNewExcerpt
    };
})();

// Start the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
