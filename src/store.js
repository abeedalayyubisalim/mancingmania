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
  // ---- Rod skins (skin: 'rod') — recolor the joran (rod) you see in
  // first-person view. Buying one equips it immediately; owned skins can
  // be switched back to anytime from the item's detail page in your
  // profile.
  {
    id: 'rod_skin_sakura',
    name: 'Joran Sakura',
    emoji: '🎣',
    price: 90,
    minLevel: 1,
    skin: 'rod',
    color: 0xe888ab,
    desc: 'Ganti warna joran kamu jadi pink sakura. Gaya doang, gak ada efek ke gameplay.',
  },
  {
    id: 'rod_skin_karbon',
    name: 'Joran Karbon Hitam',
    emoji: '🎣',
    price: 180,
    minLevel: 4,
    skin: 'rod',
    color: 0x24262b,
    desc: 'Tampilan joran serat karbon hitam matte.',
  },
  {
    id: 'rod_skin_emas',
    name: 'Joran Emas Berkilau',
    emoji: '🎣',
    price: 350,
    minLevel: 8,
    skin: 'rod',
    color: 0xe8c04a,
    desc: 'Joran emas kinclong buat pamer di dermaga.',
  },
  // ---- Boat skins (skin: 'boat') — recolor the rowboat's hull.
  {
    id: 'boat_skin_biru',
    name: 'Perahu Biru Laut',
    emoji: '🚤',
    price: 120,
    minLevel: 1,
    skin: 'boat',
    color: 0x2f6fa8,
    desc: 'Cat ulang lambung perahu jadi biru laut.',
  },
  {
    id: 'boat_skin_hijau',
    name: 'Perahu Hijau Safari',
    emoji: '🚤',
    price: 200,
    minLevel: 5,
    skin: 'boat',
    color: 0x3f8a4d,
    desc: 'Cat ulang lambung perahu jadi hijau safari.',
  },
  {
    id: 'boat_skin_emas',
    name: 'Perahu Emas Juara',
    emoji: '🚤',
    price: 420,
    minLevel: 9,
    skin: 'boat',
    color: 0xd9ac3d,
    desc: 'Lambung perahu emas — buat yang udah jadi juara papan skor.',
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
    return {
      owned: parsed.owned ?? [],
      tiers: parsed.tiers ?? {},
      // Which skin is currently worn per category ('rod'/'boat') — this is
      // a per-device display preference, not synced to Supabase, same as
      // e.g. look sensitivity. Defaults to null (the game's default look).
      equipped: parsed.equipped ?? { rod: null, boat: null },
    }
  } catch {
    return { owned: [], tiers: {}, equipped: { rod: null, boat: null } }
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

// ---- Rod/boat skins ---------------------------------------------------
// Buying a skin equips it right away (see pause-menu.js _buyCosmetic); an
// already-owned skin can be switched back to from its item detail page.

export function getEquippedSkin(category) {
  return state.equipped[category] ?? null
}

export function equipSkin(itemId) {
  const item = COSMETIC_ITEMS.find((i) => i.id === itemId && i.skin)
  if (!item || !isOwned(itemId)) return
  state.equipped[item.skin] = itemId
  save()
}

// Resolves the color a skin category should currently render as — the
// equipped skin's color, or `fallback` (the game's built-in default look)
// if nothing's equipped (or the equipped item somehow isn't owned/found).
export function getSkinColor(category, fallback) {
  const id = getEquippedSkin(category)
  const item = id && COSMETIC_ITEMS.find((i) => i.id === id)
  return item ? item.color : fallback
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
  // Skins (rod/boat) show up in the 3D world itself, not as a HUD name
  // badge — only accessory-style cosmetics (hat, vest, ...) qualify here.
  const cosmetic = COSMETIC_ITEMS.find((i) => !i.skin && isOwned(i.id))
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
  // Tracks the most-recently-synced owned skin per category (rows arrive
  // oldest-first) so a fresh device can show *something* worn instead of
  // the bare default, even before the player picks explicitly.
  const lastSkinByCategory = {}
  for (const row of rows) {
    const jenis = row.jenis
    const cosmetic = COSMETIC_ITEMS.find((i) => i.id === jenis)
    if (cosmetic) {
      markOwned(jenis)
      if (cosmetic.skin) lastSkinByCategory[cosmetic.skin] = cosmetic.id
      continue
    }
    const parsed = parseGearJenis(jenis)
    if (parsed) maxTierByLine[parsed.lineId] = Math.max(maxTierByLine[parsed.lineId] ?? 0, parsed.tier)
  }
  for (const [lineId, tier] of Object.entries(maxTierByLine)) {
    setGearTier(lineId, tier)
  }
  for (const [category, itemId] of Object.entries(lastSkinByCategory)) {
    if (!getEquippedSkin(category)) equipSkin(itemId)
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
