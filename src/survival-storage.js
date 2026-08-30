// Local-only "Rekor Survival" (best day reached) — same per-browser
// persistence pattern as wallet-storage.js. Deliberately not synced to
// Supabase yet (unlike points/wallet/match_history): Survival is brand new
// and this keeps Sub-tahap Survival-A self-contained. A later sub-tahap can
// add a proper Supabase record + Profile section once the mode is fleshed
// out, the same way match_history followed multiplayer.
const KEY = 'fishingfps_survival_record_v1'

export function loadSurvivalRecord() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return { bestDay: parsed?.bestDay ?? 0 }
  } catch {
    return { bestDay: 0 }
  }
}

export function saveSurvivalRecord(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Best-effort — private browsing / storage disabled shouldn't crash the game.
  }
}
