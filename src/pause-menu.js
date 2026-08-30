import { settings, saveSettings, isTouchDevice } from './settings.js'
import {
  signOut,
  fetchLeaderboard,
  fetchInventory,
  fetchPublicProfileById,
  fetchPublicProfileByName,
  searchPlayers,
  addInventoryItem,
} from './supabase-client.js'
import { FISH_TYPES } from './game/fish-data.js'
import { fishIconSVG } from './fish-icon.js'
import { getEntry, totalCaughtSpecies, groupInventoryRows } from './collection.js'
import {
  COSMETIC_ITEMS,
  GEAR_LINES,
  isOwned,
  markOwned,
  getOwned,
  getGearTier,
  setGearTier,
  gearJenisId,
  summarizeGearRows,
} from './store.js'
import { getLevelInfo } from './leveling.js'
import { DEFAULT_AVATAR, AVATAR_OPTIONS } from './avatar.js'
import { ACHIEVEMENTS, evaluate as evaluateAchievements } from './achievements.js'
import { playUIClick, playPurchase, setSfxVolume, setMusicVolume, setMusicMuted } from './audio.js'

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
    {
      username,
      userId,
      avatar,
      onResume,
      onSensitivityChange,
      getScore,
      spendScore,
      getTotalPoints,
      onStoreChange,
      onAvatarChange,
      getAchievementsState,
    }
  ) {
    this.onResume = onResume
    this.username = username
    this.avatar = avatar || DEFAULT_AVATAR
    this.onAvatarChange = onAvatarChange
    this.getScore = getScore ?? (() => 0)
    this.spendScore = spendScore ?? (() => false)
    this.getTotalPoints = getTotalPoints ?? (() => 0)
    this.onStoreChange = onStoreChange
    this.getAchievementsState = getAchievementsState ?? (() => ({ stats: null, claimedIds: new Set() }))
    // Signed-in players get their collection from Supabase (synced across
    // devices); guests fall back to the local browser copy.
    this.userId = userId ?? null
    this.galleryData = null
    // Which view the fish/item detail popup's back button returns to —
    // it can be opened from the Koleksi Ikan gallery OR from a profile.
    this._detailBackView = 'gallery'
    this.profileGearItems = []

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
          <button id="pause-achievements" class="pause-btn">🏅 Pencapaian</button>
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
          <label id="pause-sfx-label">Volume efek suara: <span id="sfx-value"></span></label>
          <input type="range" id="pause-sfx" min="0" max="1" step="0.05" />
          <label id="pause-music-label">Volume musik: <span id="music-value"></span></label>
          <input type="range" id="pause-music" min="0" max="1" step="0.05" />
          <label class="pause-checkbox-label"><input type="checkbox" id="pause-music-mute" /> Matikan musik latar</label>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-achievements" class="pause-view hidden">
          <h3>Pencapaian <span id="achievements-progress"></span></h3>
          <div id="achievements-list"></div>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-gallery" class="pause-view hidden">
          <h3>Koleksi Ikan <span id="gallery-progress"></span></h3>
          <div id="gallery-grid"></div>
          <button class="pause-btn back-btn" data-back="main">← Kembali</button>
        </div>
        <div id="pause-view-gallery-detail" class="pause-view hidden">
          <div id="gallery-detail-body"></div>
          <button id="gallery-detail-back" class="pause-btn back-btn">← Kembali</button>
        </div>
        <div id="pause-view-item-detail" class="pause-view hidden">
          <div id="item-detail-body"></div>
          <button class="pause-btn back-btn" data-back="profile">← Kembali ke Profil</button>
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
        <div id="pause-view-avatar-picker" class="pause-view hidden">
          <h3>Pilih Foto Profil</h3>
          <div id="avatar-picker-grid"></div>
          <button class="pause-btn back-btn" data-back="profile">← Kembali</button>
        </div>
      </div>
    `
    root.appendChild(this.el)

    this.views = {
      main: this.el.querySelector('#pause-view-main'),
      leaderboard: this.el.querySelector('#pause-view-leaderboard'),
      settings: this.el.querySelector('#pause-view-settings'),
      achievements: this.el.querySelector('#pause-view-achievements'),
      gallery: this.el.querySelector('#pause-view-gallery'),
      'gallery-detail': this.el.querySelector('#pause-view-gallery-detail'),
      'item-detail': this.el.querySelector('#pause-view-item-detail'),
      store: this.el.querySelector('#pause-view-store'),
      profile: this.el.querySelector('#pause-view-profile'),
      'avatar-picker': this.el.querySelector('#pause-view-avatar-picker'),
    }

    this.el.querySelector('#pause-resume').addEventListener('click', () => this.onResume?.())
    this.el.querySelector('#pause-leaderboard').addEventListener('click', () => this._showLeaderboard())
    this.el.querySelector('#pause-settings').addEventListener('click', () => this._showView('settings'))
    this.el.querySelector('#pause-gallery').addEventListener('click', () => this._showGallery())
    this.el.querySelector('#pause-store').addEventListener('click', () => this._showStore())
    this.el.querySelector('#pause-profile').addEventListener('click', () => this._showProfile())
    this.el.querySelector('#pause-logout').addEventListener('click', () => this._logout())
    this.el.querySelector('#pause-achievements').addEventListener('click', () => this._showAchievements())
    // A light click sound on literally any button inside this menu (buy
    // buttons, back buttons, avatar picker, everything) — cheaper than
    // wiring it individually everywhere.
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('button')) playUIClick()
    })
    this.el.querySelectorAll('[data-back]').forEach((btn) =>
      btn.addEventListener('click', () => this._showView(btn.dataset.back))
    )
    // The fish/item detail popup can be opened from the gallery or from a
    // profile, so its back button returns wherever it was opened from.
    this.el
      .querySelector('#gallery-detail-back')
      .addEventListener('click', () => this._showView(this._detailBackView))

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

    const sfxSlider = this.el.querySelector('#pause-sfx')
    const sfxLabel = this.el.querySelector('#sfx-value')
    sfxSlider.value = settings.sfxVolume
    sfxLabel.textContent = Math.round(settings.sfxVolume * 100) + '%'
    sfxSlider.addEventListener('input', () => {
      const v = parseFloat(sfxSlider.value)
      sfxLabel.textContent = Math.round(v * 100) + '%'
      setSfxVolume(v)
    })

    const musicSlider = this.el.querySelector('#pause-music')
    const musicLabel = this.el.querySelector('#music-value')
    musicSlider.value = settings.musicVolume
    musicLabel.textContent = Math.round(settings.musicVolume * 100) + '%'
    musicSlider.addEventListener('input', () => {
      const v = parseFloat(musicSlider.value)
      musicLabel.textContent = Math.round(v * 100) + '%'
      setMusicVolume(v)
    })

    const muteCheckbox = this.el.querySelector('#pause-music-mute')
    muteCheckbox.checked = !!settings.musicMuted
    muteCheckbox.addEventListener('change', () => {
      setMusicMuted(muteCheckbox.checked)
    })
  }

  _showAchievements() {
    this._showView('achievements')
    const { stats, claimedIds } = this.getAchievementsState()
    const list = this.el.querySelector('#achievements-list')
    if (!stats) {
      list.innerHTML = '<p class="gallery-status">Tidak tersedia.</p>'
      return
    }
    const unlockedIds = new Set(evaluateAchievements(stats).map((a) => a.id))
    const claimedCount = ACHIEVEMENTS.filter((a) => claimedIds.has(a.id)).length
    this.el.querySelector('#achievements-progress').textContent = `(${claimedCount}/${ACHIEVEMENTS.length})`
    list.innerHTML = ACHIEVEMENTS.map((a) => {
      const claimed = claimedIds.has(a.id)
      const unlocked = unlockedIds.has(a.id)
      const cls = claimed ? 'claimed' : unlocked ? 'unlocked' : 'locked'
      return `
        <div class="achievement-card ${cls}">
          <div class="achievement-card-icon">${claimed || unlocked ? a.emoji : '🔒'}</div>
          <div class="achievement-card-body">
            <div class="achievement-card-name">${escapeHtml(a.name)}</div>
            <div class="achievement-card-desc">${escapeHtml(a.desc)}</div>
          </div>
          <div class="achievement-card-reward">${claimed ? '✅' : `+${a.reward} 🪙`}</div>
        </div>
      `
    }).join('')
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
      card.addEventListener('click', () => {
        this._detailBackView = 'gallery'
        this._showFishDetail(card.dataset.fish)
      })
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

    // Upgradeable gear lines (kail/umpan/jaring) — each card shows the
    // currently-owned tier and, if there's a next tier, an upgrade button.
    const gearCards = GEAR_LINES.map((line) => {
      const ownedTier = getGearTier(line.id)
      const nextTier = line.tiers[ownedTier] // 0-based index === next tier to buy
      const currentName = ownedTier > 0 ? line.tiers[ownedTier - 1].name : null
      if (!nextTier) {
        // Maxed out.
        return `
          <div class="store-card owned">
            <div class="store-card-icon">${line.emoji}</div>
            <div class="store-card-name">${escapeHtml(currentName)}</div>
            <div class="store-card-desc">Level tertinggi tercapai!</div>
            <div class="store-card-owned">✅ Maksimal</div>
          </div>
        `
      }
      const minLevel = nextTier.minLevel ?? 1
      const levelOk = level >= minLevel
      const affordable = balance >= nextTier.price
      return `
        <div class="store-card ${!levelOk ? 'locked' : ''}">
          <div class="store-card-icon">${line.emoji}</div>
          <div class="store-card-name">${escapeHtml(nextTier.name)}</div>
          <div class="store-card-desc">${escapeHtml(nextTier.desc)}</div>
          ${currentName ? `<div class="store-card-current">Sekarang: ${escapeHtml(currentName)}</div>` : ''}
          ${
            levelOk
              ? `<button class="store-buy-btn" data-gear="${line.id}" ${affordable ? '' : 'disabled'}>${ownedTier > 0 ? 'Upgrade' : 'Beli'} — 🪙 ${nextTier.price}</button>`
              : `<div class="store-card-locked">🔒 Perlu Level ${minLevel}</div>`
          }
        </div>
      `
    }).join('')

    // One-off cosmetic items.
    const cosmeticCards = COSMETIC_ITEMS.map((item) => {
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

    grid.innerHTML = gearCards + cosmeticCards

    grid.querySelectorAll('.store-buy-btn[data-gear]').forEach((btn) => {
      btn.addEventListener('click', () => this._buyGearTier(btn.dataset.gear))
    })
    grid.querySelectorAll('.store-buy-btn[data-item]').forEach((btn) => {
      btn.addEventListener('click', () => this._buyCosmetic(btn.dataset.item))
    })
  }

  _buyGearTier(lineId) {
    const line = GEAR_LINES.find((l) => l.id === lineId)
    if (!line) return
    const ownedTier = getGearTier(lineId)
    const nextTier = line.tiers[ownedTier]
    if (!nextTier) return // already maxed
    const level = getLevelInfo(this.getTotalPoints()).level
    if (level < (nextTier.minLevel ?? 1)) return
    if (!this.spendScore(nextTier.price)) return
    const newTier = ownedTier + 1
    setGearTier(lineId, newTier)
    if (this.userId) addInventoryItem(this.userId, gearJenisId(lineId, newTier)).catch(() => {})
    playPurchase()
    this.onStoreChange?.()
    this._renderStore()
  }

  _buyCosmetic(itemId) {
    const item = COSMETIC_ITEMS.find((i) => i.id === itemId)
    if (!item || isOwned(itemId)) return
    const level = getLevelInfo(this.getTotalPoints()).level
    if (level < (item.minLevel ?? 1)) return
    if (!this.spendScore(item.price)) return
    markOwned(itemId)
    if (this.userId) addInventoryItem(this.userId, itemId).catch(() => {})
    playPurchase()
    this.onStoreChange?.()
    this._renderStore()
  }

  // targetId/targetName omitted => shows the current player's own profile.
  async _showProfile(targetId = null, targetName = null) {
    this._showView('profile')
    const isSelf = !targetId && !targetName
    const body = this.el.querySelector('#profile-body')
    body.innerHTML = '<p class="gallery-status">Memuat profil...</p>'

    let username, totalPoints, wallet, targetUserId, avatarForDisplay

    if (isSelf) {
      username = this.username
      totalPoints = this.getTotalPoints()
      wallet = this.getScore()
      targetUserId = this.userId
      avatarForDisplay = this.avatar
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
      targetUserId = profile.id
      avatarForDisplay = profile.avatar || DEFAULT_AVATAR
    }

    const inventoryRows = targetUserId ? await fetchInventory(targetUserId) : null
    const fishIds = new Set(FISH_TYPES.map((f) => f.id))
    const fishRows = inventoryRows ? inventoryRows.filter((r) => fishIds.has(r.jenis)) : null
    const grouped = fishRows ? groupInventoryRows(fishRows) : null
    // Reuse the same cache _showFishDetail reads from, so clicking a fish
    // in the profile grid opens the right owner's catch data.
    this.galleryData = grouped
    const caughtCount = grouped ? Object.keys(grouped).length : isSelf ? totalCaughtSpecies() : 0
    const totalSpecies = FISH_TYPES.length
    const info = getLevelInfo(totalPoints)

    const caughtFish = FISH_TYPES.filter((f) => {
      const entry = grouped ? grouped[f.id] : isSelf ? getEntry(f.id) : null
      return Boolean(entry)
    })
    const speciesGrid = caughtFish.length
      ? caughtFish
          .map((f) => `<button class="profile-mini-item" data-fish="${f.id}" title="${escapeHtml(f.name)}">${fishIconSVG(f, 30)}</button>`)
          .join('')
      : '<p class="gallery-status">Belum ada koleksi ikan.</p>'

    // Gear/cosmetics: for the logged-in owner, use the live local cache
    // (kept in sync with Supabase on login + every purchase); otherwise
    // derive it straight from that player's public inventory rows.
    let cosmeticIds, gearTiers
    if (inventoryRows) {
      const summary = summarizeGearRows(inventoryRows)
      cosmeticIds = summary.cosmetics
      gearTiers = summary.gearTiers
    } else if (isSelf) {
      cosmeticIds = getOwned()
      gearTiers = Object.fromEntries(GEAR_LINES.map((l) => [l.id, getGearTier(l.id)]))
    } else {
      cosmeticIds = []
      gearTiers = {}
    }

    this.profileGearItems = [
      ...GEAR_LINES.filter((l) => (gearTiers[l.id] ?? 0) > 0).map((l) => {
        const tier = gearTiers[l.id]
        const tierData = l.tiers[tier - 1]
        return {
          key: `gear:${l.id}`,
          kind: 'gear',
          emoji: l.emoji,
          name: tierData?.name ?? l.name,
          desc: tierData?.desc ?? '',
          tierLabel: `Tingkat ${tier} dari ${l.tiers.length}`,
          price: tierData?.price,
        }
      }),
      ...cosmeticIds
        .map((id) => COSMETIC_ITEMS.find((i) => i.id === id))
        .filter(Boolean)
        .map((i) => ({
          key: `cosmetic:${i.id}`,
          kind: 'cosmetic',
          emoji: i.emoji,
          name: i.name,
          desc: i.desc,
          tierLabel: null,
          price: i.price,
        })),
    ]
    const gearHtml = this.profileGearItems.length
      ? this.profileGearItems
          .map((i) => `<button class="profile-mini-item" data-gearkey="${i.key}" title="${escapeHtml(i.name)}">${i.emoji}</button>`)
          .join('')
      : '<p class="gallery-status">Belum ada item toko.</p>'

    body.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar">${escapeHtml(avatarForDisplay)}</div>
          ${isSelf ? '<button id="profile-avatar-edit" class="avatar-edit-btn" title="Ganti foto profil">✏️</button>' : ''}
        </div>
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
      <h4>Inventaris</h4>
      <div class="profile-mini-grid">${gearHtml}</div>
    `

    body.querySelectorAll('.profile-mini-item[data-fish]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._detailBackView = 'profile'
        this._showFishDetail(btn.dataset.fish)
      })
    })
    body.querySelectorAll('.profile-mini-item[data-gearkey]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.profileGearItems.find((g) => g.key === btn.dataset.gearkey)
        if (item) this._showItemDetail(item)
      })
    })
    const editBtn = body.querySelector('#profile-avatar-edit')
    if (editBtn) editBtn.addEventListener('click', () => this._showAvatarPicker())
  }

  _showItemDetail(item) {
    this._showView('item-detail')
    this.el.querySelector('#item-detail-body').innerHTML = `
      <div class="detail-icon"><span class="detail-emoji">${item.emoji}</span></div>
      <h3>${escapeHtml(item.name)}</h3>
      ${item.tierLabel ? `<p class="detail-latin">${escapeHtml(item.tierLabel)}</p>` : ''}
      <div class="detail-rows">
        <div class="detail-row"><span>📋 Deskripsi</span><p>${escapeHtml(item.desc || '—')}</p></div>
      </div>
      <div class="detail-footer">
        <span>${item.kind === 'gear' ? '🛠️ Perlengkapan' : '✨ Kosmetik'}</span>
        ${item.price != null ? `<span>🪙 ${item.price} poin</span>` : ''}
      </div>
    `
  }

  _showAvatarPicker() {
    this._showView('avatar-picker')
    const grid = this.el.querySelector('#avatar-picker-grid')
    grid.innerHTML = AVATAR_OPTIONS.map(
      (a) => `<button class="avatar-option ${a === this.avatar ? 'selected' : ''}" data-avatar="${a}">${a}</button>`
    ).join('')
    grid.querySelectorAll('.avatar-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.avatar = btn.dataset.avatar
        this.onAvatarChange?.(this.avatar)
        this._showProfile()
      })
    })
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
