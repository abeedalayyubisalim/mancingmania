// Shared, lightweight game settings — persisted per-browser via localStorage
// so a player's sensitivity preference sticks around between visits.
const STORAGE_KEY = 'fishing-fps-settings'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export const settings = {
  lookSensitivity: 1,
  ...load(),
}

export function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lookSensitivity: settings.lookSensitivity }))
  } catch {
    // Storage unavailable (private browsing, etc.) — not critical.
  }
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}
