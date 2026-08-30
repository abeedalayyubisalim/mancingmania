// Player level is derived from LIFETIME total points earned (never drops
// even after spending points in the store) — a simple triangular-number
// curve, so each level takes a bit more than the last.
const BASE = 150

export function levelThreshold(level) {
  if (level <= 1) return 0
  return Math.round((BASE * (level - 1) * level) / 2)
}

export function getLevelInfo(totalPoints) {
  const points = Math.max(0, totalPoints || 0)
  let level = 1
  while (levelThreshold(level + 1) <= points && level < 200) level++
  const current = levelThreshold(level)
  const next = levelThreshold(level + 1)
  const span = next - current
  return {
    level,
    pointsIntoLevel: points - current,
    pointsForNext: span,
    progress: span > 0 ? Math.min(1, (points - current) / span) : 1,
    nextLevelAt: next,
  }
}
