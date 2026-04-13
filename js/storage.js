/**
 * storage.js — Thin localStorage wrapper with JSON serialisation.
 * All other modules should use these helpers rather than touching
 * localStorage directly, so we have one place to handle errors.
 */

export const KEYS = {
  PACKING:   'cth_packing',
  EXPENSES:  'cth_expenses',
  REMINDERS: 'cth_reminders',
  STEPS:     'cth_steps',
  SETTINGS:  'cth_settings',
};

/**
 * Read a value from localStorage.
 * Returns null if the key doesn't exist or JSON parsing fails.
 */
export function getItem(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Write a value to localStorage.
 * Silently ignores errors (e.g. private browsing quota exceeded).
 */
export function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — continue without caching
  }
}

/**
 * Remove a value from localStorage.
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
