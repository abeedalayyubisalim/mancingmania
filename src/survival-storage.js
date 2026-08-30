// Local-only "Rekor Survival" — best day reached AND whether the player has
// ever WON (survived all 10 days), tracked separately per difficulty
// (easy/normal/hard — see game/survival.js's DIFFICULTIES). The win flags
// double as this device's Survival badge unlocks, read by
// achievements.js/pause-menu.js's profile view. Same per-browser
// persistence pattern as wallet-storage.js — deliberately not synced to
// Supabase yet (unlike points/wallet/match_history): Survival is still
// self-contained. A later sub-tahap can add a proper Supabase record +
// cross-device badges the same way match_history followed multiplayer.
//
// v2 (this file) replaces the old flat `{ bestDay: <number> }` shape from
// before difficulty levels existed with a per-difficulty one — bumping the
// storage key rather than migrating, since a single lost "best day so far"
// number is low-stakes.
const KEY = 'fishingfps_survival_record_v2'
export const DIFFICULTY_IDS = ['easy', 'normal', 'hard']

function emptyRecord() {
  return {
    bestDay: { easy: 0, normal: 0, hard: 0 },
    wins: { easy: false, normal: false, hard: false },
  }
}

export function loadSurvivalRecord() {
  const record = emptyRecord()
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : null
    for (const d of DIFFICULTY_IDS) {
      record.bestDay[d] = Number(parsed?.bestDay?.[d]) || 0
      record.wins[d] = Boolean(parsed?.wins?.[d])
    }
  } catch {
    // Fall through with the empty record — storage unavailable/corrupt.
  }
  return record
}

export function saveSurvivalRecord(record) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Best-effort — private browsing / storage disabled shouldn't crash the game.
  }
}

// Called once a run ends (win or lose) — updates that difficulty's best day
// and, on a win, permanently flips its badge on. Returns the merged record
// plus whether this particular result was noteworthy, so the caller (see
// SurvivalSession._lose/_win) can pass that along to the end-screen/HUD.
export function recordSurvivalResult(difficulty, dayReached, won) {
  const record = loadSurvivalRecord()
  const d = DIFFICULTY_IDS.includes(difficulty) ? difficulty : 'normal'
  const isNewRecord = dayReached > record.bestDay[d]
  if (isNewRecord) record.bestDay[d] = dayReached
  const justWon = won && !record.wins[d]
  if (won) record.wins[d] = true
  saveSurvivalRecord(record)
  return { record, isNewRecord, justWon }
}
