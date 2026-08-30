// A one-time onboarding card shown before a brand-new player's very first
// game — explains the controls and the reeling minigame up front instead of
// leaving them to guess. Never shown again on this browser after the first
// dismissal (per-browser, like the rest of this game's local prefs).
const STORAGE_KEY = 'fishing-fps-tutorial-seen'

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage unavailable — the tutorial will just show again next time.
  }
}

export function showTutorial({ touch, onDone }) {
  const overlay = document.createElement('div')
  overlay.className = 'tutorial-overlay'
  overlay.innerHTML = `
    <div class="tutorial-modal">
      <h2>🎣 Selamat Datang di Fishing FPS!</h2>
      <div class="tutorial-steps">
        <div class="tutorial-step">
          <span class="tutorial-step-icon">${touch ? '🕹️' : '⌨️'}</span>
          <div><b>Bergerak</b><br>${
            touch
              ? 'Joystick kiri buat jalan, geser di layar kanan buat lihat sekitar.'
              : 'WASD buat jalan, gerakkan mouse buat lihat sekitar.'
          }</div>
        </div>
        <div class="tutorial-step">
          <span class="tutorial-step-icon">🎣</span>
          <div><b>Melempar Kail</b><br>${
            touch ? 'Tahan tombol 🎣, lepas buat melempar.' : 'Klik & tahan tombol mouse, lepas buat melempar.'
          }</div>
        </div>
        <div class="tutorial-step">
          <span class="tutorial-step-icon">⚡</span>
          <div><b>Saat Ikan Menggigit</b><br>Begitu muncul "IKAN MENGGIGIT!", langsung ${touch ? 'ketuk' : 'klik'} secepatnya!</div>
        </div>
        <div class="tutorial-step">
          <span class="tutorial-step-icon">🎯</span>
          <div><b>Menggulung Ikan</b><br>Ikuti penanda yang bergerak bolak-balik — ${touch ? 'ketuk' : 'klik'} tepat saat berada di zona hijau, ulangi sampai ikannya berhasil ditangkap.</div>
        </div>
        <div class="tutorial-step">
          <span class="tutorial-step-icon">🛒</span>
          <div><b>Toko & Level</b><br>Poin dari tangkapan menaikkan level & dompetmu — belanjakan di Toko lewat menu jeda buat perlengkapan yang lebih baik.</div>
        </div>
      </div>
      <button class="pause-btn primary tutorial-start-btn">Ayo Mulai Memancing!</button>
    </div>
  `
  overlay.querySelector('.tutorial-start-btn').addEventListener('click', () => {
    markTutorialSeen()
    overlay.remove()
    onDone?.()
  })
  document.body.appendChild(overlay)
}
