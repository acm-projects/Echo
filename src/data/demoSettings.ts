// Presentation settings. Change the numbers here; the app picks them up on the next reload (no .env, no restart).

/**
 * Narrator failsafe: when making a voice in Voice Studio takes longer than this many seconds (counted from tapping
 * Create), the ready-made "Narrator" voice (British, male, confident) appears in the list. Only while it's hidden; see
 * data/tucked.ts and the "Running the demo" section of README 2.md.
 */
export const NARRATOR_FAILSAFE_SECONDS = 32;
