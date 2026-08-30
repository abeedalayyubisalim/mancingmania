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
  sfxVolume: 0.8,
  musicVolume: 0.35,
  musicMuted: false,
  ...load(),
}

export function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lookSensitivity: settings.lookSensitivity,
        sfxVolume: settings.sfxVolume,
        musicVolume: settings.musicVolume,
        musicMuted: settings.musicMuted,
      })
    )
  } catch {
    // Storage unavailable (private browsing, etc.) — not critical.
  }
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}
