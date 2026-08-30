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

// { [fishId]: { count, firstCaughtAt, maxWeight } }
const state = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — collection just won't persist this session.
  }
}

export function recordCatch(fishId, weight = 0) {
  const entry = state[fishId]
  state[fishId] = {
    count: (entry?.count ?? 0) + 1,
    firstCaughtAt: entry?.firstCaughtAt ?? Date.now(),
    maxWeight: Math.max(entry?.maxWeight ?? 0, weight ?? 0),
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

// The full local { [jenis]: { count, firstCaughtAt, maxWeight } } map —
// used by achievements to compute unlock progress for guests, in the same
// shape groupInventoryRows() produces for logged-in players.
export function allEntries() {
  return { ...state }
}

// Turns raw Supabase inventory rows ({jenis, created_at, berat}, oldest
// first) into the same { [jenis]: { count, firstCaughtAt, maxWeight } }
// shape as local storage uses, so the gallery UI doesn't need to care which
// source it came from. `berat` may be missing on older rows/tables — those
// just don't count toward maxWeight.
export function groupInventoryRows(rows) {
  const grouped = {}
  for (const row of rows) {
    const entry = grouped[row.jenis]
    const t = new Date(row.created_at).getTime()
    const w = typeof row.berat === 'number' ? row.berat : 0
    grouped[row.jenis] = {
      count: (entry?.count ?? 0) + 1,
      firstCaughtAt: entry?.firstCaughtAt ?? t,
      maxWeight: Math.max(entry?.maxWeight ?? 0, w),
    }
  }
  return grouped
}
