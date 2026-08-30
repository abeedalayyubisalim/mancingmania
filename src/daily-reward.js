// A small daily login bonus. Claim state is tracked the same way store
// purchases/achievements are: a row in the shared Supabase `inventory`
// table (jenis = "daily_YYYY-MM-DD") for logged-in players so it survives
// across devices, and localStorage for guests.
function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC — fine for a casual daily reset)
}

export function dailyJenisId(dateKey) {
  return `daily_${dateKey}`
}

const LOCAL_CLAIMS_KEY = 'fishing-fps-daily-claims'

function loadLocalClaims() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LOCAL_CLAIMS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveLocalClaims(set) {
  try {
    localStorage.setItem(LOCAL_CLAIMS_KEY, JSON.stringify([...set]))
  } catch {
    // Storage unavailable — the claim just won't persist this session.
  }
}

function claimedDateSet(inventoryRows) {
  if (inventoryRows) {
    const set = new Set()
    for (const row of inventoryRows) {
      const m = /^daily_(\d{4}-\d{2}-\d{2})$/.exec(row.jenis)
      if (m) set.add(m[1])
    }
    return set
  }
  return loadLocalClaims()
}

export function isClaimedToday(inventoryRows) {
  return claimedDateSet(inventoryRows).has(todayKey())
}

// Consecutive days claimed *before* today. Claiming today extends it by one.
export function computeStreak(inventoryRows) {
  const claimed = claimedDateSet(inventoryRows)
  let streak = 0
  const d = new Date()
  d.setDate(d.getDate() - 1)
  while (claimed.has(todayKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function rewardForStreak(streakAfterClaim) {
  return Math.min(150, 20 + (streakAfterClaim - 1) * 8)
}

export function markClaimedLocally(dateKey = todayKey()) {
  const set = loadLocalClaims()
  set.add(dateKey)
  saveLocalClaims(set)
}

export function todayDailyKey() {
  return todayKey()
}

// Builds and shows the "hadiah harian" claim modal. `onClaim` is called
// synchronously from the button's own click handler (so any sound-unlock /
// user-gesture-gated work triggered by it still counts as "from a click").
export function showDailyRewardModal({ streak, reward, onClaim }) {
  const overlay = document.createElement('div')
  overlay.className = 'daily-overlay'
  overlay.innerHTML = `
    <div class="daily-modal">
      <div class="daily-modal-icon">🎁</div>
      <h3>Hadiah Harian!</h3>
      <p class="daily-modal-streak">${
        streak > 1 ? `Beruntun ${streak} hari 🔥` : 'Selamat datang kembali!'
      }</p>
      <div class="daily-modal-reward">+${reward} 🪙</div>
      <button class="pause-btn primary daily-claim-btn">Klaim Hadiah</button>
    </div>
  `
  const close = () => overlay.remove()
  overlay.querySelector('.daily-claim-btn').addEventListener('click', () => {
    onClaim?.()
    close()
  })
  document.body.appendChild(overlay)
}
