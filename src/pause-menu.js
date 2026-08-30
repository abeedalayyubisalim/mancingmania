import { settings, saveSettings, isTouchDevice } from './settings.js'
import { signOut, fetchLeaderboard } from './supabase-client.js'

export class PauseMenu {
  constructor(root, { username, onResume, onSensitivityChange }) {
    this.onResume = onResume
    this.username = username

    this.el = document.createElement('div')
    this.el.id = 'pause-menu'
    this.el.className = 'hidden'
    this.el.innerHTML = `
      <div id="pause-card">
        <h2>🎣 Fishing FPS</h2>
        <div id="pause-view-main" class="pause-view">
          <p id="pause-hint">${
            isTouchDevice()
              ? 'Joystick kiri buat jalan, geser layar kanan buat lihat sekitar, tombol 🎣 buat mancing.'
              : 'WASD buat jalan, mouse buat lihat sekitar, klik tahan-lepas buat mancing.'
          }</p>
          <button id="pause-resume" class="pause-btn primary">▶ Main</button>
          <button id="pause-leaderboard" class="pause-btn">🏆 Papan Skor</button>
          <button id="pause-settings" class="pause-btn">⚙️ Pengaturan</button>
          <button id="pause-logout" class="pause-btn danger">🚪 Keluar</button>
        </div>
        <div id="pause-view-leaderboard" class="pause-view hidden">
          <h3>Papan Skor Teratas</h3>
          <ol id="pause-leaderboard-list"></ol>
          <button class="pause-btn back-btn" data-back>← Kembali</button>
        </div>
        <div id="pause-view-settings" class="pause-view hidden">
          <h3>Pengaturan</h3>
          <label id="pause-sensitivity-label">Sensitivitas lihat sekitar: <span id="sensitivity-value"></span></label>
          <input type="range" id="pause-sensitivity" min="0.3" max="2" step="0.1" />
          <button class="pause-btn back-btn" data-back>← Kembali</button>
        </div>
      </div>
    `
    root.appendChild(this.el)

    this.views = {
      main: this.el.querySelector('#pause-view-main'),
      leaderboard: this.el.querySelector('#pause-view-leaderboard'),
      settings: this.el.querySelector('#pause-view-settings'),
    }

    this.el.querySelector('#pause-resume').addEventListener('click', () => this.onResume?.())
    this.el.querySelector('#pause-leaderboard').addEventListener('click', () => this._showLeaderboard())
    this.el.querySelector('#pause-settings').addEventListener('click', () => this._showView('settings'))
    this.el.querySelector('#pause-logout').addEventListener('click', () => this._logout())
    this.el.querySelectorAll('[data-back]').forEach((btn) =>
      btn.addEventListener('click', () => this._showView('main'))
    )

    const slider = this.el.querySelector('#pause-sensitivity')
    const valueLabel = this.el.querySelector('#sensitivity-value')
    slider.value = settings.lookSensitivity
    valueLabel.textContent = settings.lookSensitivity.toFixed(1) + 'x'
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value)
      settings.lookSensitivity = v
      valueLabel.textContent = v.toFixed(1) + 'x'
      saveSettings()
      onSensitivityChange?.(v)
    })
  }

  _showView(name) {
    Object.entries(this.views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name))
  }

  async _showLeaderboard() {
    this._showView('leaderboard')
    const list = this.el.querySelector('#pause-leaderboard-list')
    list.innerHTML = '<li>Memuat...</li>'
    const rows = await fetchLeaderboard(10)
    list.innerHTML =
      rows
        .map(
          (r, i) =>
            `<li class="${r.username === this.username ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.username)}</span><span>${r.score}</span></li>`
        )
        .join('') || '<li>Belum ada skor.</li>'
  }

  async _logout() {
    await signOut()
    location.reload()
  }

  open() {
    this._showView('main')
    this.el.classList.remove('hidden')
  }

  close() {
    this.el.classList.add('hidden')
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
