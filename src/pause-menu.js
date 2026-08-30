import { settings, saveSettings, isTouchDevice } from './settings.js'
import {
  signOut,
  fetchLeaderboard,
  fetchInventory,
  fetchPublicProfileById,
  fetchPublicProfileByName,
  searchPlayers,
} from './supabase-client.js'
import { FISH_TYPES } from './game/fish-data.js'
import { fishIconSVG } from './fish-icon.js'
import { getEntry, totalCaughtSpecies, groupInventoryRows } from './collection.js'
import { STORE_ITEMS, isOwned, markOwned, getOwned } from './store.js'
import { getLevelInfo } from './leveling.js'

const CAT_LINES = [
  'Meong! Mau beli apa hari ini?',
  'Kail emas lagi laris nih~',
  'Naikin level dulu biar bisa beli semuanya!',
  'Terima kasih udah mampir ke toko ikan~',
  'Psst, umpan super bikin ikan gigit lebih cepat lho.',
  'Jaring keberuntungan cocok buat mburu ikan emas legendaris!',
]

export class PauseMenu {
  constructor(
    root,
    { username, userId, onResume, onSensitivityChange, getScore, spendScore, getTotalPoints, onStoreChange }
  ) {
    this.onResume = onResume
    this.username = username
    this.getScore = getScore ?? (() => 0)
    this.spendScore = spendScore ?? (() => false)
    this.getTotalPoints = getTotalPoints ?? (() => 0)
    this.onStoreChange = onStoreChange
    // Signed-in players get their collection from Supabase (synced across
    // devices); guests fall back to the local browser copy.
    this.userId = userId ?? null
    this.galleryData = null

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
          <button id="pause-profile" class="pause-btn">👤 Profil</button>
          <button id="pause-gallery" class="pause-btn">🐟 Koleksi Ikan</button>
          <button id="pause-store" class="pause-btn">🛒 Toko</button>
          <button id="pause-leaderboard" class="pause-btn">🏆 Papan Skor</button>
          <button id="pause-settings" class="pause-btn">⚙️ Pengaturan</button>
          <button id="pause-logout" class="pause-btn danger">🚪 Keluar</button>
        </div>
        <div id="pause-view-leaderboard" class="pause-view hidden">
          <h3>Papan Skor Teratas</h3>
          <ol id="pause-leaderboard-list"></ol>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-store" class="pause-view hidden">
          <h3>Toko <span id="store-balance"></span></h3>
          <div id="shopkeeper">
            <div id="shopkeeper-cat">🐱</div>
            <div id="shopkeeper-bubble">Meong!</div>
          </div>
          <div id="store-grid"></div>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-settings" class="pause-view hidden">
          <h3>Pengaturan</h3>
          <label id="pause-sensitivity-label">Sensitivitas lihat sekitar: <span id="sensitivity-value"></span></label>
          <input type="range" id="pause-sensitivity" min="0.3" max="2" step="0.1" />
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-gallery" class="pause-view hidden">
          <h3>Koleksi Ikan <span id="gallery-progress"></span></h3>
          <div id="gallery-grid"></div>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-gallery-detail" class="pause-view hidden">
          <div id="gallery-detail-body"></div>
          <button class="pause-btn back-btn" data-back="gallery">← Kembali ke Koleksi</button>
        </div>
        <div id="pause-view-profile" class="pause-view hidden">
          <div id="profile-search">
            <input type="text" id="profile-search-input" placeholder="Cari nama pemain..." />
            <button id="profile-search-btn">🔍</button>
          </div>
          <div id="profile-search-results"></div>
          <div id="profile-body"></div>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
      </div>
    `
    root.appendChild(this.el)

    this.views = {
      main: this.el.querySelector('#pause-view-main'),
      leaderboard: this.el.querySelector('#pause-view-leaderboard'),
      settings: this.el.querySelector('#pause-view-settings'),
      gallery: this.el.querySelector('#pause-view-gallery'),
      'gallery-detail': this.el.querySelector('#pause-view-gallery-detail'),
      store: this.el.querySelector('#pause-view-store'),
      profile: this.el.querySelector('#pause-view-profile'),
    }

    this.el.querySelector('#pause-resume').addEventListener('click', () => this.onResume?.())
    this.el.querySelector('#pause-leaderboard').addEventListener('click', () => this._showLeaderboard())
    this.el.querySelector('#pause-settings').addEventListener('click', () => this._showView('settings'))
    this.el.querySelector('#pause-gallery').addEventListener('click', () => this._showGallery())
    this.el.querySelector('#pause-store').addEventListener('click', () => this._showStore())
    this.el.querySelector('#pause-profile').addEventListener('click', () => this._showProfile())
    this.el.querySelector('#pause-logout').addEventListener('click', () => this._logout())
    this.el.querySelectorAll('[data-back]').forEach((btn) =>
      btn.addEventListener('click', () => this._showView(btn.dataset.back))
    )

    this.el.querySelector('#profile-search-btn').addEventListener('click', () => this._searchPlayers())
    this.el.querySelector('#profile-search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._searchPlayers()
    })

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
            `<li class="${r.username === this.username ? 'me' : ''} clickable" data-id="${r.id ?? ''}" data-name="${escapeHtml(r.username)}"><span>${i + 1}. ${escapeHtml(r.username)}</span><span>${r.score}</span></li>`
        )
        .join('') || '<li>Belum ada skor.</li>'
    list.querySelectorAll('li[data-name]').forEach((li) => {
      li.addEventListener('click', () => this._showProfile(li.dataset.id || null, li.dataset.name))
    })
  }

  async _showGallery() {
    this._showView('gallery')
    const grid = this.el.querySelector('#gallery-grid')
    grid.innerHTML = '<p class="gallery-status">Memuat koleksi...</p>'

    // Signed-in: pull the authoritative list from Supabase (synced across
    // devices). Guest: use whatever's cached in this browser.
    this.galleryData = this.userId ? groupInventoryRows(await fetchInventory(this.userId)) : null

    const total = FISH_TYPES.length
    const caughtCount = this.galleryData ? Object.keys(this.galleryData).length : totalCaughtSpecies()
    this.el.querySelector('#gallery-progress').textContent = `(${caughtCount}/${total})`

    grid.innerHTML = FISH_TYPES.map((fish) => {
      const entry = this.galleryData ? this.galleryData[fish.id] : getEntry(fish.id)
      const caught = Boolean(entry)
      return `
        <button class="gallery-card ${caught ? '' : 'locked'}" data-fish="${fish.id}" ${caught ? '' : 'disabled'}>
          <div class="gallery-card-icon">${caught ? fishIconSVG(fish, 44) : '❔'}</div>
          <div class="gallery-card-name">${caught ? escapeHtml(fish.name) : '???'}</div>
          ${caught ? `<div class="gallery-card-count">x${entry.count}</div>` : ''}
        </button>
      `
    }).join('')

    grid.querySelectorAll('.gallery-card:not(.locked)').forEach((card) => {
      card.addEventListener('click', () => this._showFishDetail(card.dataset.fish))
    })
  }

  _showFishDetail(fishId) {
    const fish = FISH_TYPES.find((f) => f.id === fishId)
    const entry = this.galleryData ? this.galleryData[fishId] : getEntry(fishId)
    if (!fish || !entry) return
    this._showView('gallery-detail')

    const first = new Date(entry.firstCaughtAt)
    const heaviest = entry.maxWeight ? `${entry.maxWeight.toFixed(2)} kg` : '—'
    this.el.querySelector('#gallery-detail-body').innerHTML = `
      <div class="detail-icon">${fishIconSVG(fish, 84)}</div>
      <h3>${escapeHtml(fish.name)}</h3>
      <p class="detail-latin">${escapeHtml(fish.latin)}</p>
      <div class="detail-rows">
        <div class="detail-row"><span>📍 Sebaran</span><p>${escapeHtml(fish.habitat)}</p></div>
        <div class="detail-row"><span>📏 Ukuran</span><p>${escapeHtml(fish.sizeInfo)}</p></div>
        <div class="detail-row"><span>⏳ Umur</span><p>${escapeHtml(fish.lifespan)}</p></div>
        <div class="detail-row"><span>💡 Fakta</span><p>${escapeHtml(fish.fact)}</p></div>
        <div class="detail-row"><span>🏋️ Tangkapan Terberat</span><p>${heaviest}</p></div>
      </div>
      <div class="detail-footer">
        <span>${fish.junk ? 'Bukan tangkapan bernilai' : `~${fish.pointsPerKg} poin/kg`}</span>
        <span>Ditangkap ${entry.count}x · pertama ${first.toLocaleDateString('id-ID')}</span>
      </div>
    `
  }

  _showStore() {
    this._showView('store')
    this.el.querySelector('#shopkeeper-bubble').textContent = CAT_LINES[Math.floor(Math.random() * CAT_LINES.length)]
    this._renderStore()
  }

  _renderStore() {
    const balance = this.getScore()
    const level = getLevelInfo(this.getTotalPoints()).level
    this.el.querySelector('#store-balance').textContent = `🪙 ${balance} · ⭐ Lv.${level}`
    const grid = this.el.querySelector('#store-grid')
    grid.innerHTML = STORE_ITEMS.map((item) => {
      const owned = isOwned(item.id)
      const minLevel = item.minLevel ?? 1
      const levelOk = level >= minLevel
      const affordable = balance >= item.price
      return `
        <div class="store-card ${owned ? 'owned' : ''} ${!levelOk ? 'locked' : ''}">
          <div class="store-card-icon">${item.emoji}</div>
          <div class="store-card-name">${escapeHtml(item.name)}</div>
          <div class="store-card-desc">${escapeHtml(item.desc)}</div>
          ${
            owned
              ? '<div class="store-card-owned">✅ Dimiliki</div>'
              : levelOk
                ? `<button class="store-buy-btn" data-item="${item.id}" ${affordable ? '' : 'disabled'}>Beli — 🪙 ${item.price}</button>`
                : `<div class="store-card-locked">🔒 Perlu Level ${minLevel}</div>`
          }
        </div>
      `
    }).join('')

    grid.querySelectorAll('.store-buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._buyItem(btn.dataset.item))
    })
  }

  _buyItem(itemId) {
    const item = STORE_ITEMS.find((i) => i.id === itemId)
    if (!item || isOwned(itemId)) return
    const level = getLevelInfo(this.getTotalPoints()).level
    if (level < (item.minLevel ?? 1)) return
    if (!this.spendScore(item.price)) return
    markOwned(itemId)
    this.onStoreChange?.()
    this._renderStore()
  }

  // targetId/targetName omitted => shows the current player's own profile.
  async _showProfile(targetId = null, targetName = null) {
    this._showView('profile')
    const isSelf = !targetId && !targetName
    const body = this.el.querySelector('#profile-body')
    body.innerHTML = '<p class="gallery-status">Memuat profil...</p>'

    let username, totalPoints, wallet, inventoryRows, gearOwned

    if (isSelf) {
      username = this.username
      totalPoints = this.getTotalPoints()
      wallet = this.getScore()
      inventoryRows = this.userId ? await fetchInventory(this.userId) : null
      gearOwned = getOwned()
    } else {
      const profile = targetId
        ? await fetchPublicProfileById(targetId)
        : await fetchPublicProfileByName(targetName)
      if (!profile) {
        body.innerHTML = '<p class="gallery-status">Pemain tidak ditemukan (atau kamu belum login ke Supabase).</p>'
        return
      }
      username = profile.name
      totalPoints = profile.points ?? 0
      wallet = null
      inventoryRows = await fetchInventory(profile.id)
      gearOwned = null
    }

    const grouped = inventoryRows ? groupInventoryRows(inventoryRows) : null
    const caughtCount = grouped ? Object.keys(grouped).length : isSelf ? totalCaughtSpecies() : 0
    const totalSpecies = FISH_TYPES.length
    const info = getLevelInfo(totalPoints)

    const caughtFish = FISH_TYPES.filter((f) => {
      const entry = grouped ? grouped[f.id] : isSelf ? getEntry(f.id) : null
      return Boolean(entry)
    })
    const speciesGrid = caughtFish.length
      ? caughtFish.map((f) => `<div class="profile-mini-item" title="${escapeHtml(f.name)}">${fishIconSVG(f, 30)}</div>`).join('')
      : '<p class="gallery-status">Belum ada koleksi ikan.</p>'

    const gearHtml =
      gearOwned !== null
        ? gearOwned.length
          ? gearOwned
              .map((id) => {
                const item = STORE_ITEMS.find((i) => i.id === id)
                return item
                  ? `<div class="profile-mini-item" title="${escapeHtml(item.name)}">${item.emoji}</div>`
                  : ''
              })
              .join('')
          : '<p class="gallery-status">Belum ada item toko.</p>'
        : null

    body.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">🎣</div>
        <div>
          <h3>${escapeHtml(username)}</h3>
          <div class="profile-level">⭐ Level ${info.level}</div>
        </div>
      </div>
      <div class="profile-levelbar"><div class="profile-levelbar-fill" style="width:${Math.round(info.progress * 100)}%"></div></div>
      <div class="profile-levelbar-label">${info.pointsIntoLevel}/${info.pointsForNext} poin ke Level ${info.level + 1}</div>
      <div class="profile-stats">
        <div class="profile-stat"><span>🏆 Total Poin</span><b>${totalPoints}</b></div>
        ${wallet !== null ? `<div class="profile-stat"><span>🪙 Dompet</span><b>${wallet}</b></div>` : ''}
        <div class="profile-stat"><span>🐟 Koleksi</span><b>${caughtCount}/${totalSpecies}</b></div>
      </div>
      <h4>Koleksi Ikan</h4>
      <div class="profile-mini-grid">${speciesGrid}</div>
      ${gearHtml !== null ? `<h4>Inventaris</h4><div class="profile-mini-grid">${gearHtml}</div>` : ''}
      ${!isSelf ? '<p class="profile-note">Item toko pemain lain belum tersinkron online, jadi belum bisa ditampilkan di sini.</p>' : ''}
    `
  }

  async _searchPlayers() {
    const input = this.el.querySelector('#profile-search-input')
    const q = input.value.trim()
    const results = this.el.querySelector('#profile-search-results')
    if (!q) {
      results.innerHTML = ''
      return
    }
    results.innerHTML = '<p class="gallery-status">Mencari...</p>'
    const rows = await searchPlayers(q)
    results.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<button class="profile-result-btn" data-id="${r.id}" data-name="${escapeHtml(r.name)}">${escapeHtml(r.name)} · ${r.points} poin</button>`
          )
          .join('')
      : '<p class="gallery-status">Tidak ditemukan.</p>'
    results.querySelectorAll('.profile-result-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._showProfile(btn.dataset.id, btn.dataset.name))
    })
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
