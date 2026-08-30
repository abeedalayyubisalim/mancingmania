// Shared markup builders for the "Dota 2 style" match-result roster (avatar
// on the left, stats on the right) and the per-player fish-catch drill-down.
// Used by BOTH the live end-of-match popup (multiplayer-ui.js) and the
// Profile's match-history detail view (pause-menu.js), so the two stay
// visually identical and can't drift apart.
import { DEFAULT_AVATAR } from './avatar.js'
import { FISH_TYPES } from './game/fish-data.js'
import { fishIconSVG } from './fish-icon.js'

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// One row per player: avatar circle left, name + rank/catch-count middle,
// big point total right. Rows with a real (array-shaped) catch list are
// clickable to drill down into that player's individual fish.
export function renderResultRoster(results, { winnerId, localId } = {}) {
  if (!results?.length) return '<p class="gallery-status">Belum ada yang menangkap apa-apa.</p>'
  return results
    .map((r, i) => {
      const isMe = r.id === localId
      const isWinner = winnerId && r.id === winnerId
      const catchCount = Array.isArray(r.catches) ? r.catches.length : Number(r.catches) || 0
      const canDrill = Array.isArray(r.catches) && r.catches.length > 0
      return `
        <button class="mp-result-row-wide ${isWinner ? 'winner' : ''} ${isMe ? 'me' : ''} ${canDrill ? 'clickable' : ''}" data-player="${escapeHtml(r.id)}" ${canDrill ? '' : 'disabled'}>
          <span class="mp-result-avatar">${escapeHtml(r.avatar || DEFAULT_AVATAR)}</span>
          <span class="mp-result-main">
            <span class="mp-result-name-row">
              <span class="mp-result-rank">${isWinner ? '🏆' : `#${i + 1}`}</span>
              <span class="mp-result-name">${escapeHtml(r.name)}${isMe ? ' (Kamu)' : ''}</span>
            </span>
            <span class="mp-result-sub">🐟 ${catchCount} ikan${canDrill ? ' · lihat detail ›' : ''}</span>
          </span>
          <span class="mp-result-points-big">${r.points}<small> poin</small></span>
        </button>
      `
    })
    .join('')
}

// The list of individual fish a single player caught during the match,
// newest first isn't tracked — shown in catch order as recorded.
export function renderPlayerCatchList(player) {
  if (!Array.isArray(player.catches) || !player.catches.length) {
    return '<p class="gallery-status">Detail tangkapan tidak tersedia untuk pertandingan ini.</p>'
  }
  return player.catches
    .map((c) => {
      const fish = FISH_TYPES.find((f) => f.id === c.fishId)
      const icon = fish ? fishIconSVG(fish, 36) : ''
      return `
        <div class="mp-catch-row">
          <span class="mp-catch-icon">${icon}</span>
          <span class="mp-catch-name">${escapeHtml(c.fishName)}</span>
          <span class="mp-catch-weight">${Number(c.weight ?? 0).toFixed(2)} kg</span>
          <span class="mp-catch-points">+${c.points} poin</span>
        </div>
      `
    })
    .join('')
}
