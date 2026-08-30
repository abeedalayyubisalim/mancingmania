// Standalone full-screen overlays for Survival mode — the sleep fade/fast-
// forward transition and the win/lose end screen. Same lightweight pattern
// as multiplayer-ui.js: built straight against document.body since they
// need to show up during live gameplay, not from inside a pause-menu view.

let sleepEl = null

export function showSleepTransition(subtitle) {
  if (sleepEl) return
  sleepEl = document.createElement('div')
  sleepEl.className = 'survival-sleep-overlay'
  sleepEl.innerHTML = `<div class="survival-sleep-text">💤 Tidur...<br><small>${subtitle}</small></div>`
  document.body.appendChild(sleepEl)
}

export function hideSleepTransition() {
  sleepEl?.remove()
  sleepEl = null
}

const LOSE_REASON_TEXT = {
  lapar: 'Kamu kelaparan di pulau itu...',
  haus: 'Kamu kehausan di pulau itu...',
  stamina: 'Kamu kehabisan tenaga karena begadang terus...',
  diserang: 'Kamu diterkam gerombolan ikan buas...',
}

// `result` = { outcome: 'win' | 'lose', reason?, day, totalDays, bestDay,
//   isNewRecord, difficulty?, difficultyLabel?, justWon? }
export function showSurvivalEnd(result, { onClose }) {
  hideSleepTransition()
  const overlay = document.createElement('div')
  overlay.className = 'survival-end-overlay'

  const won = result.outcome === 'win'
  const title = won ? '🏝️ Kamu Selamat!' : '☠️ Tidak Selamat'
  const desc = won
    ? `Kamu bertahan hidup penuh ${result.totalDays} hari di pulau itu.`
    : `${LOSE_REASON_TEXT[result.reason] ?? 'Perjalananmu berakhir di pulau itu...'} (Hari ${result.day})`

  overlay.innerHTML = `
    <div class="survival-end-modal">
      <div class="survival-end-icon">${won ? '🏆' : '💀'}</div>
      <h3>${title}</h3>
      ${result.difficultyLabel ? `<p class="survival-end-diff">Tingkat: ${result.difficultyLabel}</p>` : ''}
      <p class="survival-end-desc">${desc}</p>
      <div class="survival-end-stats">
        <div class="survival-end-stat"><span>📅 Hari Bertahan</span><b>${won ? result.totalDays : result.day} / ${result.totalDays}</b></div>
        <div class="survival-end-stat"><span>🥇 Rekor Terbaik</span><b>${result.bestDay}</b></div>
      </div>
      ${result.isNewRecord ? '<p class="survival-end-record">✨ Rekor baru!</p>' : ''}
      ${result.justWon ? '<p class="survival-end-record">🏅 Lencana baru masuk ke profilmu!</p>' : ''}
      <button class="pause-btn primary survival-end-close">Kembali ke Menu</button>
    </div>
  `
  overlay.querySelector('.survival-end-close').addEventListener('click', () => {
    overlay.remove()
    onClose?.()
  })
  document.body.appendChild(overlay)
}
