// Standalone full-screen overlays for the multiplayer countdown and match
// results — built straight against document.body, same lightweight pattern
// as tutorial.js/daily-reward.js, since both need to show up *during* live
// gameplay (pause menu closed), not from inside a menu view.

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

// `results` = { results: [{id,name,points,catches}], winnerId, mode }.
// `localId` picks out "you" in the list; `onClose` fires when the player
// dismisses the popup (main.js uses it to leave the room and land back on
// the pause menu's main view).
export function showMatchResults({ results, winnerId, mode }, { localId, onClose }) {
  hideCountdown()
  const overlay = document.createElement('div')
  overlay.className = 'mp-results-overlay'

  const rows = results.length
    ? results
        .map((r, i) => {
          const isMe = r.id === localId
          const isWinner = r.id === winnerId
          return `
            <div class="mp-result-row ${isWinner ? 'winner' : ''} ${isMe ? 'me' : ''}">
              <span class="mp-result-rank">${isWinner ? '🏆' : `#${i + 1}`}</span>
              <span class="mp-result-name">${escapeHtml(r.name)}${isMe ? ' (Kamu)' : ''}</span>
              <span class="mp-result-catches">🐟 ${r.catches}</span>
              <span class="mp-result-points">${r.points} poin</span>
            </div>
          `
        })
        .join('')
    : '<p class="gallery-status">Belum ada yang menangkap apa-apa.</p>'

  const iWon = winnerId && winnerId === localId
  overlay.innerHTML = `
    <div class="mp-results-modal">
      <div class="mp-results-icon">${iWon ? '🏆' : '🎣'}</div>
      <h3>${iWon ? 'Kamu Menang!' : 'Pertandingan Selesai'}</h3>
      <p class="mp-results-sub">${mode === 'time' ? '⏱️ Mode Waktu' : '🎯 Mode Jenis Ikan'}</p>
      <div class="mp-results-list">${rows}</div>
      <p class="mp-results-note">Catatan: hasil multiplayer belum tersimpan ke riwayat profil — menyusul di update berikutnya.</p>
      <button class="pause-btn primary mp-results-close">Kembali ke Menu</button>
    </div>
  `
  overlay.querySelector('.mp-results-close').addEventListener('click', () => {
    overlay.remove()
    onClose?.()
  })
  document.body.appendChild(overlay)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
