// Standalone full-screen overlays for the multiplayer countdown and match
// results — built straight against document.body, same lightweight pattern
// as tutorial.js/daily-reward.js, since both need to show up *during* live
// gameplay (pause menu closed), not from inside a menu view.
import { renderResultRoster, renderPlayerCatchList, escapeHtml } from './match-ui-shared.js'

let countdownEl = null

export function showCountdown(secondsLeft) {
  if (!countdownEl) {
    countdownEl = document.createElement('div')
    countdownEl.className = 'mp-countdown-overlay'
    document.body.appendChild(countdownEl)
  }
  countdownEl.textContent = secondsLeft > 0 ? String(secondsLeft) : 'MULAI!'
}

export function hideCountdown() {
  countdownEl?.remove()
  countdownEl = null
}

// `results` = { results: [{id,name,avatar,points,catches}], winnerId, mode }.
// `localId` picks out "you" in the list; `onClose` fires when the player
// dismisses the popup (main.js uses it to leave the room and land back on
// the pause menu's main view).
//
// Wider "Dota 2 style" layout: a roster panel (avatar left, stats right per
// row) that you can drill into per-player to see their individual catches,
// with a back button to return to the roster — all inside the same modal.
export function showMatchResults({ results, winnerId, mode }, { localId, onClose }) {
  hideCountdown()
  const overlay = document.createElement('div')
  overlay.className = 'mp-results-overlay'

  const iWon = winnerId && winnerId === localId
  overlay.innerHTML = `
    <div class="mp-results-modal mp-results-modal-wide">
      <div class="mp-results-roster-view">
        <div class="mp-results-icon">${iWon ? '🏆' : '🎣'}</div>
        <h3>${iWon ? 'Kamu Menang!' : 'Pertandingan Selesai'}</h3>
        <p class="mp-results-sub">${mode === 'time' ? '⏱️ Mode Waktu' : '🎯 Mode Jenis Ikan'}</p>
        <div class="mp-results-list">${renderResultRoster(results, { winnerId, localId })}</div>
        <button class="pause-btn primary mp-results-close">Kembali ke Menu</button>
      </div>
      <div class="mp-results-detail-view hidden">
        <button class="mp-player-back">‹ Kembali ke Hasil</button>
        <div class="mp-player-detail-header"></div>
        <div class="mp-player-catch-list"></div>
      </div>
    </div>
  `

  const rosterView = overlay.querySelector('.mp-results-roster-view')
  const detailView = overlay.querySelector('.mp-results-detail-view')
  const detailHeader = overlay.querySelector('.mp-player-detail-header')
  const detailList = overlay.querySelector('.mp-player-catch-list')

  overlay.querySelectorAll('.mp-result-row-wide[data-player]').forEach((btn) => {
    if (btn.disabled) return
    btn.addEventListener('click', () => {
      const player = results.find((r) => r.id === btn.dataset.player)
      if (!player) return
      detailHeader.innerHTML = `
        <span class="mp-result-avatar">${escapeHtml(player.avatar || '🎣')}</span>
        <span class="mp-result-name">${escapeHtml(player.name)}${player.id === localId ? ' (Kamu)' : ''}</span>
        <span class="mp-result-points-big">${player.points}<small> poin</small></span>
      `
      detailList.innerHTML = renderPlayerCatchList(player)
      rosterView.classList.add('hidden')
      detailView.classList.remove('hidden')
    })
  })

  overlay.querySelector('.mp-player-back').addEventListener('click', () => {
    detailView.classList.add('hidden')
    rosterView.classList.remove('hidden')
  })

  overlay.querySelector('.mp-results-close').addEventListener('click', () => {
    overlay.remove()
    onClose?.()
  })
  document.body.appendChild(overlay)
}
