// Profile picture = one emoji from a curated fishing-themed set (keeps the
// game fully self-contained — no image upload/hosting needed). Synced to
// Supabase for logged-in players (leaderboard.avatar) so it shows up on
// their public profile everywhere; cached locally for guests.
export const DEFAULT_AVATAR = '🎣'

export const AVATAR_OPTIONS = [
  '🎣', '🐟', '🐠', '🐡', '🦈', '🐬', '🐙', '🦀',
  '🦐', '🦞', '🐢', '🦭', '🐳', '🌊', '⛵', '🛶',
  '⚓', '🎏', '🧜', '🏝️',
]

const KEY = 'fishing-fps-avatar'

export function loadLocalAvatar() {
  try {
    return localStorage.getItem(KEY) || DEFAULT_AVATAR
  } catch {
    return DEFAULT_AVATAR
  }
}

export function saveLocalAvatar(avatar) {
  try {
    localStorage.setItem(KEY, avatar)
  } catch {
    // Storage unavailable — the new avatar just won't persist.
  }
}
