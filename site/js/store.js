// Tiny localStorage wrapper. Storage can be missing or throw (private mode, blocked
// site data), so every access is guarded and the app works without it.
const PREFIX = 'ambiance:';

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};
