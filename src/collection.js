// Tracks which fish the player has caught (their "Fish Dex"), persisted
// per-browser via localStorage — separate from the online leaderboard
// score, this is just local collection progress.
const STORAGE_KEY = 'fishing-fps-collection'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// { [fishId]: { count, firstCaughtAt } }
const state = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — collection just won't persist this session.
  }
}

export function recordCatch(fishId) {
  const entry = state[fishId]
  state[fishId] = {
    count: (entry?.count ?? 0) + 1,
    firstCaughtAt: entry?.firstCaughtAt ?? Date.now(),
  }
  save()
  return state[fishId]
}

export function isCaught(fishId) {
  return Boolean(state[fishId])
}

export function getEntry(fishId) {
  return state[fishId] ?? null
}

export function totalCaughtSpecies() {
  return Object.keys(state).length
}

// Turns raw Supabase inventory rows ({jenis, created_at}, oldest first)
// into the same { [jenis]: { count, firstCaughtAt } } shape as local
// storage uses, so the gallery UI doesn't need to care which source it
// came from.
export function groupInventoryRows(rows) {
  const grouped = {}
  for (const row of rows) {
    const entry = grouped[row.jenis]
    const t = new Date(row.created_at).getTime()
    grouped[row.jenis] = {
      count: (entry?.count ?? 0) + 1,
      firstCaughtAt: entry?.firstCaughtAt ?? t,
    }
  }
  return grouped
}
