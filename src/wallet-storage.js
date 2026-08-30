// Local fallback for guest players (no Supabase account): keeps their
// lifetime points + spendable wallet across reloads in this browser, the
// same way settings/collection/store ownership already do.
const KEY = 'fishing-fps-wallet'

export function loadLocalWallet() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { points: 0, wallet: 0 }
    const parsed = JSON.parse(raw)
    return { points: parsed.points ?? 0, wallet: parsed.wallet ?? 0 }
  } catch {
    return { points: 0, wallet: 0 }
  }
}

export function saveLocalWallet(points, wallet) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ points, wallet }))
  } catch {
    // Storage unavailable — progress just won't persist this session.
  }
}
