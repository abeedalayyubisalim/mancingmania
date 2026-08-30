export class Hud {
  constructor(root) {
    this.root = root
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="top-bar">
        <div id="score-box">Skor: <span id="score-value">0</span></div>
        <div id="user-box"><span id="username-value"></span></div>
      </div>
      <div id="status-box">
        <div id="status-text">Klik untuk mulai memancing</div>
        <div id="power-bar"><div id="power-fill"></div></div>
        <div id="reel-bar"><div id="reel-fill"></div></div>
      </div>
      <div id="catch-popup" class="hidden">
        <div id="catch-title"></div>
        <div id="catch-points"></div>
      </div>
      <button id="leaderboard-toggle" title="Papan Skor">🏆</button>
      <div id="leaderboard-panel" class="hidden">
        <h3>Papan Skor Teratas</h3>
        <ol id="leaderboard-list"></ol>
        <button id="leaderboard-close">Tutup</button>
      </div>
      <div id="controls-hint">
        WASD gerak &nbsp;•&nbsp; Mouse lihat sekitar &nbsp;•&nbsp; Klik tahan-lepas untuk memancing &nbsp;•&nbsp; Esc keluar kunci mouse
      </div>
    `

    this.scoreEl = root.querySelector('#score-value')
    this.usernameEl = root.querySelector('#username-value')
    this.statusText = root.querySelector('#status-text')
    this.powerBar = root.querySelector('#power-bar')
    this.powerFill = root.querySelector('#power-fill')
    this.reelBar = root.querySelector('#reel-bar')
    this.reelFill = root.querySelector('#reel-fill')
    this.catchPopup = root.querySelector('#catch-popup')
    this.catchTitle = root.querySelector('#catch-title')
    this.catchPoints = root.querySelector('#catch-points')
    this.leaderboardPanel = root.querySelector('#leaderboard-panel')
    this.leaderboardList = root.querySelector('#leaderboard-list')

    root.querySelector('#leaderboard-toggle').addEventListener('click', () => this.toggleLeaderboard())
    root.querySelector('#leaderboard-close').addEventListener('click', () => this.toggleLeaderboard(false))
  }

  setUsername(name) {
    this.usernameEl.textContent = name ?? ''
  }

  setScore(score) {
    this.scoreEl.textContent = score
  }

  setStatus(text, opts = {}) {
    this.statusText.textContent = text
    this.statusText.classList.toggle('alert', !!opts.alert)

    if (typeof opts.power === 'number') {
      this.powerBar.classList.remove('hidden')
      this.powerFill.style.width = `${Math.round(opts.power * 100)}%`
    } else if (opts.reset) {
      this.powerBar.classList.add('hidden')
    }

    if (opts.reeling) {
      this.reelBar.classList.remove('hidden')
      this.reelFill.style.width = `${Math.round((opts.progress ?? 0) * 100)}%`
    } else if (opts.reset) {
      this.reelBar.classList.add('hidden')
    }
  }

  showCatch(fish) {
    this.catchTitle.textContent = fish.junk ? fish.name : `🐟 ${fish.name}`
    this.catchPoints.textContent = fish.junk ? 'Bukan ikan...' : `+${fish.points} poin`
    this.catchPopup.classList.remove('hidden')
    clearTimeout(this._catchTimer)
    this._catchTimer = setTimeout(() => this.catchPopup.classList.add('hidden'), 2200)
  }

  toggleLeaderboard(force) {
    const show = force ?? this.leaderboardPanel.classList.contains('hidden')
    this.leaderboardPanel.classList.toggle('hidden', !show)
    if (show) this.onOpenLeaderboard?.()
  }

  renderLeaderboard(rows, myUsername) {
    this.leaderboardList.innerHTML = rows
      .map(
        (r, i) =>
          `<li class="${r.username === myUsername ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.username)}</span><span>${r.score}</span></li>`
      )
      .join('') || '<li>Belum ada skor.</li>'
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
