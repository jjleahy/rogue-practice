/**
 * Instrument configuration for brass instruments
 * Maps detected fundamental frequencies to clef/transposition options
 */

// Instrument definitions with fundamental, transposition, and clef info
export const INSTRUMENTS = {
    // Bb instruments (Bb2 fundamental)
    'Bb2': {
        fundamental: 'Bb2',
        name: 'Low Bb',
        options: [
            {
                id: 'c-bass',
                label: 'C Bass Clef',
                transposition: 0, // No transposition
                clef: 'bass',
                description: 'Trombone, Euphonium/Baritone (BC)'
            },
            {
                id: 'bb-treble',
                label: 'Bb Treble Clef',
                transposition: -14, // Transpose down major 9th (octave + major 2nd): written C sounds Bb below
                clef: 'treble',
                description: 'Euphonium/Baritone (TC), Bass Clarinet, Tenor Sax'
            }
        ]
    },

    // Eb instruments (Eb3 fundamental)
    'Eb3': {
        fundamental: 'Eb3',
        name: 'Eb',
        options: [
            {
                id: 'eb-treble',
                label: 'Eb Treble Clef',
                transposition: -9, // Transpose down major 6th: written C sounds Eb below
                clef: 'treble',
                description: 'Eb Tenor (Alto) Horn, Alto Sax'
            }
        ]
    },

    // F instruments (F3 fundamental)
    'F3': {
        fundamental: 'F3',
        name: 'F',
        options: [
            {
                id: 'f-treble',
                label: 'F Treble Clef',
                transposition: -7, // Transpose down perfect 5th: written C sounds F below
                clef: 'treble',
                description: 'F Horn'
            }
        ]
    }
};

/**
 * Get instrument config by fundamental note
 * @param {string} fundamental - Note name (e.g., 'Bb2', 'Eb3', 'F3')
 * @returns {object|null} Instrument config or null if not found
 */
export function getInstrumentByFundamental(fundamental) {
    return INSTRUMENTS[fundamental] || null;
}

/**
 * Get all supported fundamentals
 * @returns {string[]} Array of fundamental note names
 */
export function getSupportedFundamentals() {
    return Object.keys(INSTRUMENTS);
}

/**
 * Find closest matching fundamental from a detected note
 * @param {string} detectedNote - Detected note name
 * @returns {string|null} Closest fundamental or null
 */
export function findClosestFundamental(detectedNote) {
    const fundamentals = getSupportedFundamentals();

    // Check for exact match first
    if (fundamentals.includes(detectedNote)) {
        return detectedNote;
    }

    // Check for same pitch class (different octave)
    const noteName = detectedNote.replace(/\d+$/, '');
    for (const fund of fundamentals) {
        if (fund.startsWith(noteName)) {
            return fund;
        }
    }

    return null;
}
