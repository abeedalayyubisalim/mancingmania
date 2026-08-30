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
