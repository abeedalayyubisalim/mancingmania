// Fish "catalog". Weight = relative chance of appearing (higher = more common).
// depthBonus makes rarer fish more likely on longer/stronger casts.
export const FISH_TYPES = [
  { id: 'sardine', name: 'Sarden', points: 10, weight: 45, color: 0xb9c7d1, size: 0.5, depthBonus: 0 },
  { id: 'mackerel', name: 'Kembung', points: 20, weight: 30, color: 0x5c7ea3, size: 0.65, depthBonus: 0.1 },
  { id: 'snapper', name: 'Kakap', points: 35, weight: 16, color: 0xe0654a, size: 0.8, depthBonus: 0.2 },
  { id: 'tuna', name: 'Tuna', points: 60, weight: 7, color: 0x2b4a6b, size: 1.05, depthBonus: 0.35 },
  { id: 'golden', name: 'Ikan Emas Legendaris', points: 150, weight: 2, color: 0xf2c14e, size: 0.9, depthBonus: 0.5 },
  { id: 'boot', name: 'Sepatu Bot Tua', points: 0, weight: 20, color: 0x4a4038, size: 0.6, depthBonus: -0.3, junk: true },
]

// Picks a random fish, boosting rare-fish weight based on cast power (0..1).
export function rollFish(castPower) {
  const weighted = FISH_TYPES.map((f) => {
    const bonus = 1 + castPower * f.depthBonus * 4
    return { fish: f, w: Math.max(0.001, f.weight * bonus) }
  })
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const { fish, w } of weighted) {
    if (r < w) return fish
    r -= w
  }
  return FISH_TYPES[0]
}
