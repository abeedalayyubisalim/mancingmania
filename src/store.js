// Gear store. Two kinds of items:
//  - COSMETIC_ITEMS: bought once, flavor only (shown as a HUD badge).
//  - GEAR_LINES: upgradeable equipment (kail/umpan/jaring) — each line has
//    several tiers; buying a tier replaces the previous one and grants
//    that tier's (higher) bonus, it doesn't stack with earlier tiers.
//
// Ownership is cached in this browser's localStorage for instant access
// during gameplay (bonus lookups happen every cast), but is also written
// to the shared Supabase `inventory` table (same table fish catches use,
// jenis = "<line>_t<tier>" for gear or the item id for cosmetics) so a
// player's gear shows up again after logging in elsewhere, and so other
// players can see it on that player's public profile. applySyncedInventory
// below reconciles the local cache with whatever Supabase returns.
const STORAGE_KEY = 'fishing-fps-store'

export const COSMETIC_ITEMS = [
  {
    id: 'hat_nelayan',
    name: 'Topi Nelayan',
    emoji: '🧢',
    price: 80,
    minLevel: 1,
    desc: 'Aksesori gaya — dipajang di sebelah nama kamu di HUD.',
  },
  {
    id: 'vest_pro',
    name: 'Rompi Pemancing Pro',
    emoji: '🦺',
    price: 220,
    minLevel: 3,
    desc: 'Aksesori gaya lain buat pemancing berpengalaman.',
  },
]

export const GEAR_LINES = [
  {
    id: 'hook',
    name: 'Kail',
    emoji: '🪝',
    tiers: [
      { name: 'Kail Perak', price: 150, minLevel: 1, effect: { rareBonus: 0.12 }, desc: 'Ikan uncommon/rare sedikit lebih sering muncul.' },
      { name: 'Kail Emas', price: 400, minLevel: 5, effect: { rareBonus: 0.28 }, desc: 'Ikan langka jauh lebih sering muncul.' },
      { name: 'Kail Berlian', price: 900, minLevel: 10, effect: { rareBonus: 0.45 }, desc: 'Peluang ikan langka di titik maksimal.' },
    ],
  },
  {
    id: 'bait',
    name: 'Umpan',
    emoji: '🪱',
    tiers: [
      { name: 'Umpan Super', price: 120, minLevel: 2, effect: { biteSpeed: 0.3 }, desc: 'Ikan menggigit lebih cepat setelah kail dilempar.' },
      { name: 'Umpan Ajaib', price: 350, minLevel: 7, effect: { biteSpeed: 0.5 }, desc: 'Ikan menggigit jauh lebih cepat.' },
    ],
  },
  {
    id: 'net',
    name: 'Jaring',
    emoji: '🍀',
    tiers: [
      { name: 'Jaring Keberuntungan', price: 350, minLevel: 6, effect: { legendaryBonus: 0.6 }, desc: 'Peluang Ikan Emas Legendaris meningkat.' },
      { name: 'Jaring Dewa Laut', price: 800, minLevel: 12, effect: { legendaryBonus: 1.2 }, desc: 'Peluang Ikan Emas Legendaris meningkat drastis.' },
    ],
  },
]

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { owned: parsed.owned ?? [], tiers: parsed.tiers ?? {} }
  } catch {
    return { owned: [], tiers: {} }
  }
}

const state = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — purchases just won't persist this session.
  }
}

// ---- Cosmetics ------------------------------------------------------------

export function isOwned(id) {
  return state.owned.includes(id)
}

export function getOwned() {
  return [...state.owned]
}

export function markOwned(id) {
  if (!state.owned.includes(id)) {
    state.owned.push(id)
    save()
  }
}

// ---- Upgradeable gear -------------------------------------------------

// 0 = no tier owned yet; 1 = first tier owned; 2 = second tier owned; etc.
export function getGearTier(lineId) {
  return state.tiers[lineId] ?? 0
}

export function setGearTier(lineId, tier) {
  if (tier > getGearTier(lineId)) {
    state.tiers[lineId] = tier
    save()
  }
}

function currentTierEffect(line) {
  const tier = getGearTier(line.id)
  if (tier <= 0) return {}
  return line.tiers[tier - 1]?.effect ?? {}
}

export function getRareBonus() {
  return GEAR_LINES.reduce((sum, line) => sum + (currentTierEffect(line).rareBonus || 0), 0)
}

export function getLegendaryBonus() {
  return GEAR_LINES.reduce((sum, line) => sum + (currentTierEffect(line).legendaryBonus || 0), 0)
}

// Fraction (0..~0.7) shaved off the fish's bite-wait time.
export function getBiteSpeedBonus() {
  const v = GEAR_LINES.reduce((sum, line) => sum + (currentTierEffect(line).biteSpeed || 0), 0)
  return Math.min(0.7, v)
}

// First owned cosmetic item's name, for a small HUD badge — purely for
// flavor, doesn't affect gameplay.
export function getCosmeticBadge() {
  const cosmetic = COSMETIC_ITEMS.find((i) => isOwned(i.id))
  return cosmetic ? `${cosmetic.emoji} ${cosmetic.name}` : null
}

// ---- Supabase `inventory` row encoding for gear tiers ----------------

export function gearJenisId(lineId, tier) {
  return `${lineId}_t${tier}`
}

export function parseGearJenis(jenis) {
  const m = /^(.+)_t(\d+)$/.exec(jenis)
  if (!m) return null
  const line = GEAR_LINES.find((l) => l.id === m[1])
  if (!line) return null
  return { lineId: m[1], tier: parseInt(m[2], 10) }
}

// Reconciles this browser's local gear/cosmetic cache with rows fetched
// from Supabase (only ever raises tiers/adds ownership, never removes —
// Supabase is the source of truth once you're logged in, but we don't
// want a slow/failed fetch to wipe local progress).
export function applySyncedInventory(rows) {
  if (!rows || !rows.length) return
  const maxTierByLine = {}
  for (const row of rows) {
    const jenis = row.jenis
    if (COSMETIC_ITEMS.some((i) => i.id === jenis)) {
      markOwned(jenis)
      continue
    }
    const parsed = parseGearJenis(jenis)
    if (parsed) maxTierByLine[parsed.lineId] = Math.max(maxTierByLine[parsed.lineId] ?? 0, parsed.tier)
  }
  for (const [lineId, tier] of Object.entries(maxTierByLine)) {
    setGearTier(lineId, tier)
  }
}

// Splits arbitrary inventory rows (any player's) into { cosmetics, gearTiers }
// without touching this browser's own local cache — used to render another
// player's public profile.
export function summarizeGearRows(rows) {
  const cosmetics = new Set()
  const gearTiers = {}
  for (const row of rows || []) {
    const jenis = row.jenis
    if (COSMETIC_ITEMS.some((i) => i.id === jenis)) {
      cosmetics.add(jenis)
      continue
    }
    const parsed = parseGearJenis(jenis)
    if (parsed) gearTiers[parsed.lineId] = Math.max(gearTiers[parsed.lineId] ?? 0, parsed.tier)
  }
  return { cosmetics: [...cosmetics], gearTiers }
}
