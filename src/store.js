// Simple gear store — players spend their fishing points on equipment that
// gives small gameplay bonuses, plus a couple of cosmetic items. Ownership
// is stored per-browser in localStorage (like settings), since the points
// "wallet" itself is already tracked client-side too.
const STORAGE_KEY = 'fishing-fps-store'

export const STORE_ITEMS = [
  {
    id: 'hook_silver',
    name: 'Kail Perak',
    emoji: '🪝',
    price: 150,
    desc: 'Ikan tingkat uncommon/rare sedikit lebih sering muncul.',
    effect: { rareBonus: 0.12 },
  },
  {
    id: 'hook_gold',
    name: 'Kail Emas',
    emoji: '🎣',
    price: 500,
    desc: 'Ikan langka jauh lebih sering muncul dibanding kail biasa.',
    effect: { rareBonus: 0.28 },
  },
  {
    id: 'bait_super',
    name: 'Umpan Super',
    emoji: '🪱',
    price: 120,
    desc: 'Ikan menggigit lebih cepat setelah kail dilempar.',
    effect: { biteSpeed: 0.3 },
  },
  {
    id: 'net_lucky',
    name: 'Jaring Keberuntungan',
    emoji: '🍀',
    price: 350,
    desc: 'Peluang mendapat Ikan Emas Legendaris meningkat.',
    effect: { legendaryBonus: 0.6 },
  },
  {
    id: 'hat_nelayan',
    name: 'Topi Nelayan',
    emoji: '🧢',
    price: 80,
    desc: 'Aksesori gaya — dipajang di sebelah nama kamu di HUD.',
    effect: { cosmetic: true },
  },
  {
    id: 'vest_pro',
    name: 'Rompi Pemancing Pro',
    emoji: '🦺',
    price: 220,
    desc: 'Aksesori gaya lain buat pemancing berpengalaman.',
    effect: { cosmetic: true },
  },
]

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { owned: [] }
  } catch {
    return { owned: [] }
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

function sumEffect(key) {
  return STORE_ITEMS.filter((i) => isOwned(i.id)).reduce((sum, i) => sum + (i.effect[key] || 0), 0)
}

export function getRareBonus() {
  return sumEffect('rareBonus')
}

export function getLegendaryBonus() {
  return sumEffect('legendaryBonus')
}

// Fraction (0..~0.7) shaved off the fish's bite-wait time.
export function getBiteSpeedBonus() {
  return Math.min(0.7, sumEffect('biteSpeed'))
}

// First owned cosmetic item's name, for a small HUD badge — purely for
// flavor, doesn't affect gameplay.
export function getCosmeticBadge() {
  const cosmetic = STORE_ITEMS.find((i) => i.effect.cosmetic && isOwned(i.id))
  return cosmetic ? `${cosmetic.emoji} ${cosmetic.name}` : null
}
