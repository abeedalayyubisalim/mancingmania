import { isTouchDevice } from './settings.js'
import { openShareCard } from './share-card.js'
import { playUIClick } from './audio.js'
import { EMOTES, isOnline } from './social.js'

// Temporarily disabled — a player reported the share flow being buggy.
// Keeping the code path intact (just gated off) so it's a one-line flip to
// re-enable once it's fixed instead of having to rebuild the feature.
const SHARE_ENABLED = false

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
        <div id="time-weather-box"></div>
        <div id="sync-status" class="hidden"></div>
      </div>
      <div id="levelup-toast" class="hidden"></div>
      <div id="achievement-toast" class="hidden"></div>
      <div id="interact-prompt" class="hidden"></div>
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
      <button id="chat-toggle" title="Chat">💬</button>
      <div id="chat-panel" class="hidden">
        <div id="chat-header">
          <div id="chat-tabs">
            <button class="chat-tab active" data-tab="global">🌐 Global</button>
            <button class="chat-tab" data-tab="friends">🧑‍🤝‍🧑 Teman</button>
          </div>
          <button id="chat-close" title="Tutup">✕</button>
        </div>
        <div id="chat-friend-list" class="hidden"></div>
        <div id="chat-thread">
          <div id="chat-thread-header" class="hidden">
            <button id="chat-thread-back">← Teman</button>
            <span id="chat-thread-name"></span>
          </div>
          <div id="chat-messages"></div>
          <div id="chat-quick-row">
            ${EMOTES.map((e) => `<button class="chat-quick-emote" data-emoji="${e.emoji}" title="${escapeHtml(e.label)}">${e.emoji}</button>`).join('')}
          </div>
          <form id="chat-form">
            <input id="chat-input" type="text" maxlength="140" placeholder="Ketik pesan..." autocomplete="off" />
            <button type="submit">Kirim</button>
          </form>
        </div>
      </div>
      <div id="controls-hint">
        ${
          isTouchDevice()
            ? 'Joystick jalan &nbsp;•&nbsp; Geser layar lihat sekitar &nbsp;•&nbsp; 🎣 mancing &nbsp;•&nbsp; ☰ menu &nbsp;•&nbsp; Ketuk prompt buat naik/turun perahu'
            : 'WASD gerak &nbsp;•&nbsp; Mouse lihat sekitar &nbsp;•&nbsp; Klik tahan-lepas memancing &nbsp;•&nbsp; E naik/turun perahu &nbsp;•&nbsp; Esc buka menu'
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
    this.syncStatusEl = root.querySelector('#sync-status')
    this.achievementToast = root.querySelector('#achievement-toast')
    this.timeWeatherEl = root.querySelector('#time-weather-box')
    this.interactPrompt = root.querySelector('#interact-prompt')

    // ---- Chat --------------------------------------------------------
    this.chatPanel = root.querySelector('#chat-panel')
    this.chatFriendList = root.querySelector('#chat-friend-list')
    this.chatThread = root.querySelector('#chat-thread')
    this.chatThreadHeader = root.querySelector('#chat-thread-header')
    this.chatThreadName = root.querySelector('#chat-thread-name')
    this.chatMessagesEl = root.querySelector('#chat-messages')
    this.chatInput = root.querySelector('#chat-input')
    // Ephemeral only — chat rides the same live/no-history realtime
    // channel as presence, so nothing here survives a reload. {global:[],
    // dm: { [friendId]: [] }}
    this._chatLog = { global: [], dm: {} }
    this._chatTab = 'global' // 'global' | 'friends'
    this._chatFriendId = null
    this._chatFriendName = null
    this._identity = null // { id, username, avatar } — set via setIdentity()

    this.interactPrompt.addEventListener('click', () => {
      playUIClick()
      this._interactHandler?.()
    })
    root.querySelector('#chat-toggle').addEventListener('click', () => {
      playUIClick()
      this.toggleChat()
    })
    root.querySelector('#chat-close').addEventListener('click', () => {
      playUIClick()
      this.toggleChat(false)
    })
    root.querySelectorAll('.chat-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        playUIClick()
        this._chatTab = tab.dataset.tab
        this._chatFriendId = null
        root.querySelectorAll('.chat-tab').forEach((t) => t.classList.toggle('active', t === tab))
        this._renderChatTab()
      })
    })
    root.querySelector('#chat-thread-back').addEventListener('click', () => {
      playUIClick()
      this._chatFriendId = null
      this._renderChatTab()
    })
    root.querySelectorAll('.chat-quick-emote').forEach((btn) => {
      btn.addEventListener('click', () => {
        playUIClick()
        this._sendChatText(btn.dataset.emoji)
      })
    })
    root.querySelector('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault()
      const text = this.chatInput.value.trim()
      if (!text) return
      this._sendChatText(text)
      this.chatInput.value = ''
    })

    if (SHARE_ENABLED) {
      this.shareBtn.addEventListener('click', () => {
        playUIClick()
        if (this._lastCatch) openShareCard(this._lastCatch, this.username)
      })
    }
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
    if (SHARE_ENABLED) this.shareBtn.classList.remove('hidden')
    clearTimeout(this._catchTimer)
    this._catchTimer = setTimeout(() => this.catchPopup.classList.add('hidden'), 4000)
  }

  setTimeWeather(label) {
    if (this.timeWeatherEl.textContent !== label) this.timeWeatherEl.textContent = label
  }

  // `onInteract` fires when the prompt is tapped/clicked (for touch
  // players — desktop players use the E key instead, wired in main.js).
  showInteractPrompt(text, onInteract) {
    this.interactPrompt.textContent = text
    this._interactHandler = onInteract
    this.interactPrompt.classList.remove('hidden')
  }

  hideInteractPrompt() {
    this.interactPrompt.classList.add('hidden')
    this._interactHandler = null
  }

  // ---- Chat ----------------------------------------------------------
  // `identity` = { id, username, avatar } for the local player — needed to
  // tell "sent by me" apart from incoming messages, and as the `fromId`
  // main.js's onSendChat wiring stamps outgoing messages with.
  setIdentity(identity) {
    this._identity = identity
  }

  // Toggles the chat panel — used by both the 💬 button (touch/click) and
  // the Q keyboard shortcut wired in main.js (desktop can't reliably click
  // this button at all while the mouse is pointer-locked for gameplay, so
  // main.js also releases/re-acquires the lock around this). `onChatOpen`/
  // `onChatClose` let main.js hook that pointer-lock dance in without hud.js
  // needing to know anything about Three.js or PointerLockControls.
  toggleChat(forceOpen) {
    const show = forceOpen ?? this.chatPanel.classList.contains('hidden')
    this.chatPanel.classList.toggle('hidden', !show)
    if (show) {
      this._renderChatTab()
      this.onChatOpen?.()
    } else {
      this.onChatClose?.()
    }
  }

  _sendChatText(text) {
    if (!text.trim()) return
    if (this._chatTab === 'friends' && !this._chatFriendId) return // no one picked yet
    this.onSendChat?.({
      toId: this._chatTab === 'friends' ? this._chatFriendId : null,
      text: text.trim(),
    })
  }

  // Called for every chat broadcast that comes back over the lobby channel
  // (including our own — the channel is configured to echo to the sender
  // too, so this is the single path that renders sent AND received
  // messages, avoiding double-appending).
  receiveChatMessage(payload) {
    const mine = payload.fromId === this._identity?.id
    const msg = { ...payload, mine }
    if (!payload.toId) {
      this._chatLog.global.push(msg)
      // Full re-render (not just appending this one message) so the
      // "belum ada pesan" placeholder gets cleared out on the very first
      // message instead of lingering alongside real ones.
      if (this._chatTab === 'global') this._renderMessageList(this._chatLog.global)
    } else {
      // The DM thread is keyed by "the other participant" regardless of
      // who sent it, so both sides of a conversation land in the same list.
      const otherId = mine ? payload.toId : payload.fromId
      if (!this._chatLog.dm[otherId]) this._chatLog.dm[otherId] = []
      this._chatLog.dm[otherId].push(msg)
      if (this._chatTab === 'friends' && this._chatFriendId === otherId) {
        this._renderMessageList(this._chatLog.dm[otherId])
      }
    }
  }

  _appendMessage(msg) {
    const el = document.createElement('div')
    el.className = `chat-msg ${msg.mine ? 'mine' : ''}`
    el.innerHTML = `<span class="chat-msg-name">${escapeHtml(msg.mine ? 'Kamu' : msg.fromName || 'Pemain')}</span><span class="chat-msg-text">${escapeHtml(msg.text)}</span>`
    this.chatMessagesEl.appendChild(el)
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight
  }

  async _renderChatTab() {
    if (this._chatTab === 'global') {
      this.chatFriendList.classList.add('hidden')
      this.chatThread.classList.remove('hidden')
      this.chatThreadHeader.classList.add('hidden')
      this._renderMessageList(this._chatLog.global)
      return
    }
    // Friends tab.
    if (this._chatFriendId) {
      this.chatFriendList.classList.add('hidden')
      this.chatThread.classList.remove('hidden')
      this.chatThreadHeader.classList.remove('hidden')
      this.chatThreadName.textContent = this._chatFriendName ?? ''
      this._renderMessageList(this._chatLog.dm[this._chatFriendId] ?? [])
      return
    }
    // No friend picked yet — show the friend picker instead of a thread.
    this.chatThread.classList.add('hidden')
    this.chatFriendList.classList.remove('hidden')
    if (!this._identity?.loggedIn) {
      this.chatFriendList.innerHTML = '<p class="gallery-status">Main sebagai tamu gak punya daftar teman. Login dulu ya.</p>'
      return
    }
    this.chatFriendList.innerHTML = '<p class="gallery-status">Memuat...</p>'
    const friends = (await this.getFriends?.()) ?? []
    this.chatFriendList.innerHTML = friends.length
      ? friends
          .map(
            (f) =>
              `<button class="chat-friend-row" data-id="${f.friend_id}" data-name="${escapeHtml(f.friend_name)}">
                <span class="friend-online-dot ${isOnline(f.friend_id) ? 'online' : ''}"></span>
                <span>${escapeHtml(f.friend_name)}</span>
              </button>`
          )
          .join('')
      : '<p class="gallery-status">Belum ada teman buat diajak chat. Tambahkan dari menu Teman dulu.</p>'
    this.chatFriendList.querySelectorAll('.chat-friend-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        playUIClick()
        this._chatFriendId = btn.dataset.id
        this._chatFriendName = btn.dataset.name
        this._renderChatTab()
      })
    })
  }

  _renderMessageList(list) {
    this.chatMessagesEl.innerHTML = ''
    if (!list.length) {
      this.chatMessagesEl.innerHTML = '<p class="gallery-status">Belum ada pesan. Cuma kelihatan pemain yang online bareng kamu.</p>'
      return
    }
    list.forEach((msg) => this._appendMessage(msg))
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
