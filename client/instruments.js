/**
 * Instrument configuration for brass instruments
 * Keyed by instrument name for easy iteration and lookup
 */

export const INSTRUMENTS = {
  // Eb soprano (Eb4 fundamental)
  "Soprano Cornet": {
    fundamental: "Eb4",
    transposition: 3,
    clef: "treble"
  },
  
  // Bb soprano instruments (Bb3 fundamental)
  "Trumpet": {
    fundamental: "Bb3",
    transposition: -2,
    clef: "treble"
  },
  "Cornet": {
    fundamental: "Bb3",
    transposition: -2,
    clef: "treble"
  },
  "Flugelhorn": {
    fundamental: "Bb3",
    transposition: -2,
    clef: "treble"
  },

  // Eb alto (Eb3 fundamental)
  "Tenor (Alto) Horn": {
    fundamental: "Eb3",
    transposition: -9,
    clef: "treble"
  },

  // F instruments (F3 fundamental)
  "F Horn": {
    fundamental: "F3",
    transposition: -7,
    clef: "treble"
  },

  // Bb low brass - treble clef (Bb2 fundamental)
  "Euphonium / Baritone (Treble Clef)": {
    fundamental: "Bb2",
    transposition: -14,
    clef: "treble"
  },
  "Trombone (Brass Band TC)": {
    fundamental: "Bb2",
    transposition: -14,
    clef: "treble"
  },

  // Bb low brass - bass clef (Bb2 fundamental)
  "Euphonium / Baritone (Bass Clef)": {
    fundamental: "Bb2",
    transposition: 0,
    clef: "bass"
  },
  "Trombone": {
    fundamental: "Bb2",
    transposition: 0,
    clef: "bass"
  },
  "Bass Trombone": {
    fundamental: "Bb2",
    transposition: 0,
    clef: "bass"
  },

  // F tuba (F2 fundamental)
  "Tuba (F)": {
    fundamental: "F2",
    transposition: 0,
    clef: "bass"
  },

  // Eb tubas (Eb2 fundamental)
  "Tuba (Eb)": {
    fundamental: "Eb2",
    transposition: 0,
    clef: "bass"
  },
  "Tuba (Brass Band TC)": {
    fundamental: "Eb2",
    transposition: -21,
    clef: "treble"
  },

  // C tuba (C2 fundamental)
  "Tuba (C)": {
    fundamental: "C2",
    transposition: 0,
    clef: "bass"
  },

  // Bb tubas (Bb1 fundamental)
  "Tuba (Bb)": {
    fundamental: "Bb1",
    transposition: 0,
    clef: "bass"
  },
  "Tuba (Brass Band TC)": {
    fundamental: "Bb1",
    transposition: -26,
    clef: "treble"
  }
};

/**
 * Get instrument config by name
 * @param {string} name - Instrument name (e.g., "Trumpet", "Euphonium")
 * @returns {object|null} Instrument config or null if not found
 */
export function getInstrument(name) {
  return INSTRUMENTS[name] || null;
}

/**
 * Get all instrument names
 * @returns {string[]} Array of instrument names
 */
export function getInstrumentNames() {
  return Object.keys(INSTRUMENTS);
}

/**
 * Find instruments matching a fundamental pitch class (octave-agnostic)
 * @param {string} pitchClass - Pitch class (e.g., "Bb", "Eb", "F")
 * @returns {string[]} Array of matching instrument names
 */
export function findInstrumentsByPitchClass(pitchClass) {
  return Object.entries(INSTRUMENTS)
    .filter(([_, config]) => config.fundamental.replace(/\d+$/, '') === pitchClass)
    .map(([name]) => name);
}

/**
 * Find instruments matching an exact fundamental (with octave)
 * @param {string} fundamental - Fundamental note (e.g., "Bb3", "Eb2")
 * @returns {string[]} Array of matching instrument names
 */
export function findInstrumentsByFundamental(fundamental) {
  return Object.entries(INSTRUMENTS)
    .filter(([_, config]) => config.fundamental === fundamental)
    .map(([name]) => name);
}

/**
 * Get unique fundamentals across all instruments
 * @returns {string[]} Array of unique fundamental notes
 */
export function getUniqueFundamentals() {
  const fundamentals = new Set(
    Object.values(INSTRUMENTS).map(config => config.fundamental)
  );
  return [...fundamentals].sort();
}
