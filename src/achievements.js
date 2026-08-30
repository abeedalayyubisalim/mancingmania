// Achievement/badge definitions. Unlocking is computed live from data the
// game already tracks (collection, level, gear, cosmetics) — there's no
// separate "progress" state to keep in sync or drift out of date. Only
// whether an unlocked achievement has already been *claimed* (its one-time
// coin reward paid out) needs to persist — see claim-tracking helpers below,
// which reuse the same `inventory` table fish catches and store purchases
// already use (jenis = "ach_<id>") for logged-in players, and localStorage
// for guests.
import { FISH_TYPES } from './game/fish-data.js'
import { GEAR_LINES } from './store.js'

const REAL_FISH = FISH_TYPES.filter((f) => !f.junk)
const JUNK_ITEMS = FISH_TYPES.filter((f) => f.junk)
export const TOTAL_SPECIES = REAL_FISH.length

function fishCatchCount(stats) {
  return REAL_FISH.reduce((sum, f) => sum + (stats.grouped[f.id]?.count ?? 0), 0)
}
function junkCatchCount(stats) {
  return JUNK_ITEMS.reduce((sum, f) => sum + (stats.grouped[f.id]?.count ?? 0), 0)
}
function speciesCount(stats) {
  return REAL_FISH.filter((f) => stats.grouped[f.id]).length
}
function caughtTier(stats, tier) {
  return FISH_TYPES.filter((f) => f.tier === tier).some((f) => stats.grouped[f.id])
}
function caughtDeepSea(stats) {
  return FISH_TYPES.filter((f) => f.deepSeaOnly).some((f) => stats.grouped[f.id])
}
function maxGearTier(stats) {
  const tiers = Object.values(stats.gearTiers || {})
  return tiers.length ? Math.max(...tiers) : 0
}
function allGearOwned(stats) {
  return GEAR_LINES.every((l) => (stats.gearTiers?.[l.id] ?? 0) > 0)
}

export const ACHIEVEMENTS = [
  {
    id: 'first_catch',
    name: 'Tangkapan Pertama',
    emoji: '🎣',
    desc: 'Tangkap sesuatu di kailmu — apapun itu.',
    reward: 20,
    check: (s) => fishCatchCount(s) + junkCatchCount(s) >= 1,
  },
  {
    id: 'ten_catches',
    name: 'Pemancing Rajin',
    emoji: '🐟',
    desc: 'Tangkap 10 ikan (bukan sampah).',
    reward: 40,
    check: (s) => fishCatchCount(s) >= 10,
  },
  {
    id: 'fifty_catches',
    name: 'Pemancing Ulung',
    emoji: '🎏',
    desc: 'Tangkap 50 ikan (bukan sampah).',
    reward: 100,
    check: (s) => fishCatchCount(s) >= 50,
  },
  {
    id: 'hundred_catches',
    name: 'Legenda Dermaga',
    emoji: '🏅',
    desc: 'Tangkap 100 ikan (bukan sampah).',
    reward: 250,
    check: (s) => fishCatchCount(s) >= 100,
  },
  {
    id: 'collector_5',
    name: 'Kolektor Pemula',
    emoji: '📖',
    desc: 'Kumpulkan 5 spesies ikan berbeda.',
    reward: 50,
    check: (s) => speciesCount(s) >= 5,
  },
  {
    id: 'collector_10',
    name: 'Kolektor Handal',
    emoji: '📗',
    desc: 'Kumpulkan 10 spesies ikan berbeda.',
    reward: 100,
    check: (s) => speciesCount(s) >= 10,
  },
  {
    id: 'collector_all',
    name: 'Kolektor Sejati',
    emoji: '📚',
    desc: `Kumpulkan semua ${TOTAL_SPECIES} spesies ikan di dermaga ini.`,
    reward: 300,
    check: (s) => speciesCount(s) >= TOTAL_SPECIES,
  },
  {
    id: 'rare_catch',
    name: 'Buruan Langka',
    emoji: '🐠',
    desc: 'Tangkap satu ikan bertingkat "rare".',
    reward: 60,
    check: (s) => caughtTier(s, 'rare'),
  },
  {
    id: 'very_rare_catch',
    name: 'Predator Laut Dalam',
    emoji: '🦈',
    desc: 'Tangkap satu ikan bertingkat "very-rare".',
    reward: 120,
    check: (s) => caughtTier(s, 'very-rare'),
  },
  {
    id: 'legendary_catch',
    name: 'Ikan Emas!',
    emoji: '🌟',
    desc: 'Tangkap Ikan Emas Legendaris.',
    reward: 500,
    check: (s) => caughtTier(s, 'legendary'),
  },
  {
    id: 'deep_sea',
    name: 'Penjelajah Laut Dalam',
    emoji: '🚤',
    desc: 'Berlayar ke laut lepas dan tangkap spesies yang cuma ada di sana.',
    reward: 150,
    check: (s) => caughtDeepSea(s),
  },
  {
    id: 'junk_master',
    name: 'Tukang Sampah',
    emoji: '🥾',
    desc: 'Tangkap 10 barang bukan-ikan di kailmu.',
    reward: 30,
    check: (s) => junkCatchCount(s) >= 10,
  },
  {
    id: 'level_5',
    name: 'Naik Kelas',
    emoji: '⭐',
    desc: 'Capai Level 5.',
    reward: 60,
    check: (s) => s.level >= 5,
  },
  {
    id: 'level_10',
    name: 'Pemancing Berpengalaman',
    emoji: '🌟',
    desc: 'Capai Level 10.',
    reward: 150,
    check: (s) => s.level >= 10,
  },
  {
    id: 'level_20',
    name: 'Master Pemancing',
    emoji: '👑',
    desc: 'Capai Level 20.',
    reward: 400,
    check: (s) => s.level >= 20,
  },
  {
    id: 'gear_up',
    name: 'Perlengkapan Baru',
    emoji: '🪝',
    desc: 'Beli perlengkapan pertamamu di toko.',
    reward: 40,
    check: (s) => maxGearTier(s) >= 1,
  },
  {
    id: 'fully_geared',
    name: 'Lengkap Sudah',
    emoji: '🛠️',
    desc: 'Miliki setidaknya satu tingkat kail, umpan, dan jaring.',
    reward: 200,
    check: (s) => allGearOwned(s),
  },
  {
    id: 'shopper',
    name: 'Kolektor Gaya',
    emoji: '🧢',
    desc: 'Beli satu item kosmetik di toko.',
    reward: 30,
    check: (s) => (s.cosmeticsCount ?? 0) >= 1,
  },
  // Sub-tahap Survival-C+: one badge per Survival difficulty, unlocked by
  // actually surviving all 10 days at that level (see game/survival.js's
  // DIFFICULTIES and survival-storage.js's per-difficulty win flags —
  // `s.survivalWins` is sourced from there in main.js's
  // currentAchievementStats, local-only for now like the rest of Survival).
  {
    id: 'survival_easy',
    name: 'Selamat dari Pulau (Mudah)',
    emoji: '🏝️',
    desc: 'Bertahan penuh 10 hari di Survival tingkat Mudah.',
    reward: 150,
    check: (s) => Boolean(s.survivalWins?.easy),
  },
  {
    id: 'survival_normal',
    name: 'Selamat dari Pulau (Normal)',
    emoji: '⚖️',
    desc: 'Bertahan penuh 10 hari di Survival tingkat Normal.',
    reward: 250,
    check: (s) => Boolean(s.survivalWins?.normal),
  },
  {
    id: 'survival_hard',
    name: 'Selamat dari Pulau (Sulit)',
    emoji: '🔥',
    desc: 'Bertahan penuh 10 hari di Survival tingkat Sulit.',
    reward: 450,
    check: (s) => Boolean(s.survivalWins?.hard),
  },
]

// Returns the subset of ACHIEVEMENTS whose condition is currently met.
export function evaluate(stats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats))
}

// ---- Claim tracking (guests only — logged-in players use the shared
// Supabase inventory table via claimedIdsFromInventory, wired up in
// main.js the same way gear/cosmetic ownership is) ----------------------
const STORAGE_KEY = 'fishing-fps-achievements-claimed'

function loadClaimedLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

const claimedLocal = loadClaimedLocal()

function saveClaimedLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...claimedLocal]))
  } catch {
    // Storage unavailable — claims just won't persist this session.
  }
}

export function isClaimedLocally(id) {
  return claimedLocal.has(id)
}

export function markClaimedLocally(id) {
  claimedLocal.add(id)
  saveClaimedLocal()
}

export function claimedIdsFromInventory(rows) {
  const set = new Set()
  for (const row of rows || []) {
    const m = /^ach_(.+)$/.exec(row.jenis)
    if (m) set.add(m[1])
  }
  return set
}

export function achievementJenisId(id) {
  return `ach_${id}`
}
