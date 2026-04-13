/* ============================================================
   STORAGE.JS — localStorage fallback helpers
   Called after every successful Supabase fetch so the app
   has cached data to fall back on if connectivity fails.
   ============================================================ */

const PREFIX = 'cth_'; // china-travel-hub namespace

export function saveToStorage(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('[storage] write failed:', e);
  }
}

export function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[storage] read failed:', e);
    return null;
  }
}

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    console.warn('[storage] remove failed:', e);
  }
}
