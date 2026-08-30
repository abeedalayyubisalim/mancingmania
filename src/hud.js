import { isTouchDevice } from './settings.js'
import { openShareCard } from './share-card.js'
import { playUIClick } from './audio.js'

export class Hud {
  constructor(root) {
    this.root = root
    this.username = ''
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="top-bar">
        <div id="score-box">🪙 <span id="score-value">0</span></div>
        <div id="level-box">⭐ Lv.<span id="level-value">1</span></div>
        <div id="user-box"><span id="username-value"></span><span id="user-badge"></span></div>
        <div id="sync-status" class="hidden"></div>
      </div>
      <div id="levelup-toast" class="hidden"></div>
      <div id="achievement-toast" class="hidden"></div>
      <div id="status-box">
        <div id="status-text">Klik untuk mulai memancing</div>
        <div id="power-bar"><div id="power-fill"></div></div>
        <div id="reel-bar"><div id="reel-fill"></div></div>
        <div id="pattern-box" class="hidden">
          <div id="pattern-track">
            <div id="pattern-zone"></div>
            <div id="pattern-marker"></div>
          </div>
          <div id="pattern-info"></div>
        </div>
      </div>
      <div id="catch-popup" class="hidden">
        <div id="catch-title"></div>
        <div id="catch-points"></div>
        <button id="catch-share-btn" class="hidden">📤 Bagikan</button>
      </div>
      <button id="leaderboard-toggle" title="Papan Skor">🏆</button>
      <div id="leaderboard-panel" class="hidden">
        <h3>Papan Skor Teratas</h3>
        <ol id="leaderboard-list"></ol>
        <button id="leaderboard-close">Tutup</button>
      </div>
      <div id="controls-hint">
        ${
          isTouchDevice()
            ? 'Joystick jalan &nbsp;•&nbsp; Geser layar lihat sekitar &nbsp;•&nbsp; 🎣 mancing &nbsp;•&nbsp; ☰ menu'
            : 'WASD gerak &nbsp;•&nbsp; Mouse lihat sekitar &nbsp;•&nbsp; Klik tahan-lepas memancing &nbsp;•&nbsp; Esc buka menu'
        }
      </div>
    `

    this.scoreEl = root.querySelector('#score-value')
    this.levelEl = root.querySelector('#level-value')
    this.levelupToast = root.querySelector('#levelup-toast')
    this.usernameEl = root.querySelector('#username-value')
    this.badgeEl = root.querySelector('#user-badge')
    this.statusText = root.querySelector('#status-text')
    this.powerBar = root.querySelector('#power-bar')
    this.powerFill = root.querySelector('#power-fill')
    this.reelBar = root.querySelector('#reel-bar')
    this.reelFill = root.querySelector('#reel-fill')
    this.patternBox = root.querySelector('#pattern-box')
    this.patternZone = root.querySelector('#pattern-zone')
    this.patternMarker = root.querySelector('#pattern-marker')
    this.patternInfo = root.querySelector('#pattern-info')
    this.catchPopup = root.querySelector('#catch-popup')
    this.catchTitle = root.querySelector('#catch-title')
    this.catchPoints = root.querySelector('#catch-points')
    this.shareBtn = root.querySelector('#catch-share-btn')
    this.leaderboardPanel = root.querySelector('#leaderboard-panel')
    this.leaderboardList = root.querySelector('#leaderboard-list')
    this.syncStatusEl = root.querySelector('#sync-status')
    this.achievementToast = root.querySelector('#achievement-toast')

    root.querySelector('#leaderboard-toggle').addEventListener('click', () => {
      playUIClick()
      this.toggleLeaderboard()
    })
    root.querySelector('#leaderboard-close').addEventListener('click', () => {
      playUIClick()
      this.toggleLeaderboard(false)
    })
    this.shareBtn.addEventListener('click', () => {
      playUIClick()
      if (this._lastCatch) openShareCard(this._lastCatch, this.username)
    })
  }

  setUsername(name) {
    this.username = name ?? ''
    this.usernameEl.textContent = this.username
  }

  setBadge(badge) {
    this.badgeEl.textContent = badge ? ` · ${badge}` : ''
  }

  setScore(score) {
    this.scoreEl.textContent = score
  }

  setLevel(level) {
    this.levelEl.textContent = level
  }

  showLevelUp(level) {
    this.levelupToast.textContent = `⭐ Naik ke Level ${level}!`
    this.levelupToast.classList.remove('hidden')
    clearTimeout(this._levelupTimer)
    this._levelupTimer = setTimeout(() => this.levelupToast.classList.add('hidden'), 2600)
  }

  showAchievementToast(achievement) {
    this.achievementToast.innerHTML = `<span class="achievement-toast-icon">${achievement.emoji}</span><div><b>Pencapaian Terbuka!</b><br>${escapeHtml(achievement.name)} · +${achievement.reward} 🪙</div>`
    this.achievementToast.classList.remove('hidden')
    clearTimeout(this._achievementTimer)
    this._achievementTimer = setTimeout(() => this.achievementToast.classList.add('hidden'), 3600)
  }

  // state: 'saving' | 'saved' | 'error' | null (null hides it immediately)
  setSyncStatus(state) {
    clearTimeout(this._syncTimer)
    if (!state) {
      this.syncStatusEl.classList.add('hidden')
      return
    }
    const labels = { saving: '💾 Menyimpan...', saved: '✓ Tersimpan', error: '⚠️ Gagal simpan' }
    this.syncStatusEl.textContent = labels[state] ?? ''
    this.syncStatusEl.className = state
    this.syncStatusEl.classList.remove('hidden')
    if (state !== 'saving') {
      this._syncTimer = setTimeout(() => this.syncStatusEl.classList.add('hidden'), 1800)
    }
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

    if (opts.pattern) {
      const p = opts.pattern
      this.patternBox.classList.remove('hidden')
      this.patternMarker.style.left = `${p.marker * 100}%`
      this.patternZone.style.left = `${p.zoneStart * 100}%`
      this.patternZone.style.width = `${p.zoneWidth * 100}%`
      this.patternInfo.textContent = `Pola ${p.beat}/${p.totalBeats} · Meleset ${p.misses}/${p.maxMisses}`
    } else if (opts.reset) {
      this.patternBox.classList.add('hidden')
    }
  }

  showCatch(fish) {
    this._lastCatch = fish
    this.catchTitle.textContent = fish.junk ? fish.name : `🐟 ${fish.name}`
    this.catchPoints.textContent = fish.junk
      ? 'Bukan ikan...'
      : `${fish.weight.toFixed(2)} kg · +${fish.points} poin`
    this.catchPopup.classList.remove('hidden')
    this.shareBtn.classList.remove('hidden')
    clearTimeout(this._catchTimer)
    this._catchTimer = setTimeout(() => this.catchPopup.classList.add('hidden'), 4000)
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
