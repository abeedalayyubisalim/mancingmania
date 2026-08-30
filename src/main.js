import * as THREE from 'three'
import './style.css'
import { showAuthGate } from './auth-ui.js'
import { Hud } from './hud.js'
import {
  buildEnvironment,
  BOAT_DOCK_POSITION,
  PIER_RETURN_POSITION,
  OPEN_SEA_RADIUS,
  DEFAULT_BOAT_COLOR,
  SURVIVAL_CAVE_POSITION,
  SURVIVAL_SPRING_POSITION,
  SURVIVAL_SPAWN_POSITION,
} from './game/scene.js'
import { Water } from './game/water.js'
import { Player, DEFAULT_ROD_COLOR } from './game/player.js'
import { Fishing } from './game/fishing.js'
import { DayNightCycle } from './game/daynight.js'
import { SurvivalSession, foodValueFor, TOTAL_DAYS as SURVIVAL_TOTAL_DAYS } from './game/survival.js'
import { showSleepTransition, hideSleepTransition, showSurvivalEnd } from './survival-ui.js'
import { fetchProfile, syncPoints, updateAvatar, fetchInventory, addInventoryItem, fetchFriends } from './supabase-client.js'
import { PauseMenu } from './pause-menu.js'
import { TouchControls } from './touch-controls.js'
import { isTouchDevice } from './settings.js'
import { recordCatch, allEntries as allCollectionEntries, groupInventoryRows } from './collection.js'
import { getCosmeticBadge, applySyncedInventory, getGearTier, getOwned, GEAR_LINES, getSkinColor } from './store.js'
import { getLevelInfo } from './leveling.js'
import { loadLocalWallet, saveLocalWallet } from './wallet-storage.js'
import { DEFAULT_AVATAR, loadLocalAvatar, saveLocalAvatar } from './avatar.js'
import {
  evaluate as evaluateAchievements,
  isClaimedLocally as isAchievementClaimedLocally,
  markClaimedLocally as markAchievementClaimedLocally,
  claimedIdsFromInventory,
  achievementJenisId,
  ACHIEVEMENTS,
} from './achievements.js'
import {
  isClaimedToday as isDailyClaimedToday,
  computeStreak as computeDailyStreak,
  rewardForStreak as dailyRewardForStreak,
  showDailyRewardModal,
  dailyJenisId,
  todayDailyKey,
  markClaimedLocally as markDailyClaimedLocally,
} from './daily-reward.js'
import { hasSeenTutorial, showTutorial } from './tutorial.js'
import { unlockAudio, playAchievement, playDailyReward } from './audio.js'
import { connectLobby, sendChat, updatePresenceCosmetics } from './social.js'
import { MultiplayerSession } from './game/multiplayer.js'
import { showCountdown, hideCountdown, showMatchResults } from './multiplayer-ui.js'

const app = document.querySelector('#app')

async function main() {
  const { session, username, guest } = await showAuthGate(app)

  // Load the player's existing lifetime points + wallet + avatar so
  // nothing resets to 0/default every time you log back in — logged-in
  // players get this from Supabase, guests get it from this browser's
  // local storage.
  let totalPoints = 0
  let wallet = 0
  let avatar = DEFAULT_AVATAR
  let inventoryRows = []
  if (session?.user) {
    const [profile, rows] = await Promise.all([fetchProfile(session.user.id), fetchInventory(session.user.id)])
    totalPoints = profile.points
    wallet = profile.wallet
    avatar = profile.avatar || DEFAULT_AVATAR
    inventoryRows = rows
    // Bring any gear/cosmetics bought on another device into this
    // browser's local cache too, so bonuses apply immediately.
    applySyncedInventory(inventoryRows)
  } else {
    const local = loadLocalWallet()
    totalPoints = local.points
    wallet = local.wallet
    avatar = loadLocalAvatar()
  }

  startGame({ session, username, guest, totalPoints, wallet, avatar, inventoryRows })
}

function startGame({ session, username, guest, totalPoints, wallet, avatar, inventoryRows }) {
  const touch = isTouchDevice()

  app.innerHTML = `
    <div id="game-container" class="${touch ? 'touch-mode' : ''}">
      <canvas id="game-canvas"></canvas>
      <div id="hud-root"></div>
      <div id="menu-root"></div>
    </div>
  `

  const canvas = document.querySelector('#game-canvas')
  const hud = new Hud(document.querySelector('#hud-root'))
  hud.setUsername(username + (guest ? ' (Tamu)' : ''))
  hud.setBadge(getCosmeticBadge())
  hud.setScore(wallet)
  hud.setLevel(getLevelInfo(totalPoints).level)
  // ---- Presence ("who's online") + live chat -----------------------------
  // Logged-in players use their stable auth id (so friends/leaderboard rows
  // can match them up as online); guests get a random per-session id, which
  // just means they show up as "online" without matching any specific
  // profile row anywhere else. (Papan Skor itself lives in the pause menu
  // now — see pause-menu.js — not as a HUD quick-access button.)
  // Rod skin / hat / vest to announce alongside presence — this is the
  // only way another player (or the Profile preview, see pause-menu.js)
  // can know what you actually have equipped right now, since that choice
  // is a per-device preference with nothing to look up for it in Supabase.
  function currentCosmeticsForPresence() {
    const owned = getOwned()
    return {
      rodColor: getSkinColor('rod', DEFAULT_ROD_COLOR),
      hat: owned.includes('hat_nelayan'),
      vest: owned.includes('vest_pro'),
    }
  }

  const identityId = session?.user?.id ?? crypto.randomUUID()
  hud.setIdentity({ id: identityId, username, avatar, loggedIn: Boolean(session?.user) })
  hud.getFriends = () => (session?.user ? fetchFriends(session.user.id) : Promise.resolve([]))
  hud.onSendChat = ({ toId, text }) => sendChat({ fromId: identityId, fromName: username, toId, text })
  connectLobby(
    { id: identityId, username, avatar, cosmetics: currentCosmeticsForPresence() },
    { onChat: (payload) => hud.receiveChatMessage(payload) }
  )
  // On desktop the mouse is pointer-locked (captured/hidden) while playing,
  // so clicking the 💬 button does nothing — there's no real cursor to
  // click with. Opening chat has to release the lock first; closing it
  // re-acquires the lock so movement/look pick back up right away. Also
  // freeze WASD movement while chat is open so typing a message doesn't
  // walk the character around.
  hud.onChatOpen = () => {
    if (touch) return
    if (document.pointerLockElement === renderer.domElement) {
      suppressChatUnlock = true
      document.exitPointerLock()
    }
    player.setInputLocked(true)
    hud.chatInput?.focus()
  }
  hud.onChatClose = () => {
    if (touch) return
    player.setInputLocked(false)
    if (!paused) player.controls.lock()
  }

  // Persists points/wallet to Supabase (logged in) or this browser (guest)
  // whenever either one changes — catch, store purchase, achievement, or
  // daily reward. Shows a small "Menyimpan.../Tersimpan" indicator for
  // logged-in players so progress loss never feels silent/uncertain.
  function persistPoints() {
    if (session?.user) {
      hud.setSyncStatus('saving')
      syncPoints(session.user.id, username, totalPoints, wallet)
        .then(() => hud.setSyncStatus('saved'))
        .catch(() => hud.setSyncStatus('error'))
    } else {
      saveLocalWallet(totalPoints, wallet)
    }
  }

  // ---- Achievements -------------------------------------------------
  // "Claimed" achievement ids — merged from Supabase (cross-device, for
  // logged-in players) or this browser's local storage (guests).
  const claimedAchievementIds = session?.user
    ? claimedIdsFromInventory(inventoryRows)
    : new Set(ACHIEVEMENTS.map((a) => a.id).filter(isAchievementClaimedLocally))
  // Snapshot of catch counts from Supabase at login time, so achievement
  // progress correctly includes catches made on other devices — merged
  // with this browser's own live local collection as the session goes on.
  const initialGrouped = session?.user ? groupInventoryRows(inventoryRows) : {}

  function currentGrouped() {
    const merged = { ...initialGrouped }
    for (const [id, entry] of Object.entries(allCollectionEntries())) {
      const existing = merged[id]
      merged[id] = {
        count: Math.max(existing?.count ?? 0, entry.count),
        firstCaughtAt: Math.min(existing?.firstCaughtAt ?? Infinity, entry.firstCaughtAt),
        maxWeight: Math.max(existing?.maxWeight ?? 0, entry.maxWeight ?? 0),
      }
    }
    return merged
  }

  function currentAchievementStats() {
    return {
      grouped: currentGrouped(),
      level: getLevelInfo(totalPoints).level,
      gearTiers: Object.fromEntries(GEAR_LINES.map((l) => [l.id, getGearTier(l.id)])),
      cosmeticsCount: getOwned().length,
    }
  }

  // Checks for newly-unlocked achievements and auto-claims them (coin
  // reward + persisted claim). `silent` skips the toast/sound — used once
  // at startup so a returning player with lots of prior progress doesn't
  // get bombarded with achievement popups the instant the game loads.
  function checkAchievements(silent = false) {
    const stats = currentAchievementStats()
    const unlocked = evaluateAchievements(stats)
    let anyNew = false
    for (const ach of unlocked) {
      if (claimedAchievementIds.has(ach.id)) continue
      claimedAchievementIds.add(ach.id)
      wallet += ach.reward
      anyNew = true
      if (!silent) {
        hud.showAchievementToast(ach)
        playAchievement()
      }
      if (session?.user) addInventoryItem(session.user.id, achievementJenisId(ach.id)).catch(() => {})
      else markAchievementClaimedLocally(ach.id)
    }
    if (anyNew) {
      hud.setScore(wallet)
      persistPoints()
    }
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500)

  const { sun, hemi, ambient, boatHullMat } = buildEnvironment(scene)
  const water = new Water()
  scene.add(water.mesh)

  const player = new Player(camera, renderer.domElement)
  // The camera must live in the scene graph for objects parented to it
  // (the viewmodel rod) to be rendered.
  scene.add(camera)

  // Applies whichever rod/boat skins are currently equipped — called once
  // at startup and again after every store purchase/equip so a change
  // shows up immediately in the 3D world.
  function applyEquippedSkins() {
    player.applyRodSkin()
    boatHullMat.color.setHex(getSkinColor('boat', DEFAULT_BOAT_COLOR))
  }
  applyEquippedSkins()

  const dayNight = new DayNightCycle({ scene, sun, hemi, ambient, camera })

  // ---- Survival (Sub-tahap Survival-A: hunger/thirst/stamina/day-count
  // core loop) ------------------------------------------------------------
  const survival = new SurvivalSession({ dayNight })

  // ---- Multiplayer (Sub-tahap C: rooms, invites, live position sync) ----
  // No dedicated game server exists — this rides the same Supabase
  // Realtime broadcast/presence primitives as the lobby chat/presence
  // above, just on a separate per-room channel (see social.js). The host's
  // client is the de-facto timer/tie-break authority; see game/multiplayer.js
  // for that tradeoff spelled out.
  const multiplayer = new MultiplayerSession({
    scene,
    camera,
    identity: { id: identityId, username, avatar },
    getCosmetics: currentCosmeticsForPresence,
  })

  // ---- Boat / open-sea zone ---------------------------------------------
  const BOARD_RADIUS = 4
  const DISEMBARK_RADIUS = 6

  function boardBoat() {
    if (player.mode === 'boat') return
    const d = Math.hypot(camera.position.x - BOAT_DOCK_POSITION.x, camera.position.z - BOAT_DOCK_POSITION.z)
    if (d >= BOARD_RADIUS) return
    unlockAudio()
    fishing.releaseAction()
    player.setMode('boat', BOAT_DOCK_POSITION)
    hud.hideInteractPrompt()
  }

  function disembark() {
    if (player.mode !== 'boat') return
    const d = Math.hypot(camera.position.x - PIER_RETURN_POSITION.x, camera.position.z - PIER_RETURN_POSITION.z)
    if (d >= DISEMBARK_RADIUS) return
    fishing.releaseAction()
    // Back to the wider island bounds mid-survival-run (so the cave/spring
    // stay reachable), otherwise the usual narrow dock/pier strip.
    player.setMode(survival.active ? 'island' : 'dock', PIER_RETURN_POSITION)
    hud.hideInteractPrompt()
  }

  // ---- Survival camp (cave to sleep in, spring to drink from) -----------
  const CAVE_RADIUS = 3
  const SPRING_RADIUS = 2.4

  function trySleep() {
    if (!survival.active || !dayNight.isNight()) return
    const isLastNight = survival.day >= SURVIVAL_TOTAL_DAYS
    showSleepTransition(isLastNight ? 'Menuju pagi terakhir...' : `Hari ${survival.day + 1} dimulai`)
    survival.sleep()
    hud.hideInteractPrompt()
    // Freeze movement for the brief fade so the player doesn't go wandering
    // off mid-transition — released again once it fades back in.
    player.setInputLocked(true)
    setTimeout(() => {
      hideSleepTransition()
      player.setInputLocked(false)
    }, 1300)
  }

  function tryDrink() {
    if (!survival.active) return
    if (survival.drink()) hud.showSurvivalToast('💧 Minum air segar (+40 Haus)')
    else hud.showSurvivalToast('Belum haus lagi, tunggu sebentar...')
  }

  // Single source of truth for "what can E / the touch prompt do right
  // now" — shared by updateInteractPrompt() (shows the prompt) and the E
  // keydown handler below, so the proximity checks only live in one place.
  function getNearestInteraction() {
    if (player.mode === 'boat') {
      const d = Math.hypot(camera.position.x - PIER_RETURN_POSITION.x, camera.position.z - PIER_RETURN_POSITION.z)
      if (d < DISEMBARK_RADIUS) return { label: touch ? '🚶 Turun dari Perahu' : 'Tekan E untuk turun dari perahu', action: disembark }
      return null
    }
    const dBoat = Math.hypot(camera.position.x - BOAT_DOCK_POSITION.x, camera.position.z - BOAT_DOCK_POSITION.z)
    if (dBoat < BOARD_RADIUS) return { label: touch ? '🚤 Naik Perahu' : 'Tekan E untuk naik perahu', action: boardBoat }
    if (survival.active && player.mode === 'island') {
      const dCave = Math.hypot(camera.position.x - SURVIVAL_CAVE_POSITION.x, camera.position.z - SURVIVAL_CAVE_POSITION.z)
      if (dCave < CAVE_RADIUS && dayNight.isNight()) {
        return { label: touch ? '💤 Tidur di Gua' : 'Tekan E untuk tidur di gua', action: trySleep }
      }
      const dSpring = Math.hypot(camera.position.x - SURVIVAL_SPRING_POSITION.x, camera.position.z - SURVIVAL_SPRING_POSITION.z)
      if (dSpring < SPRING_RADIUS) {
        return { label: touch ? '💧 Minum Air' : 'Tekan E untuk minum air', action: tryDrink }
      }
    }
    return null
  }

  function updateInteractPrompt() {
    const interaction = getNearestInteraction()
    if (interaction) hud.showInteractPrompt(interaction.label, interaction.action)
    else hud.hideInteractPrompt()
  }

  if (!touch) {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyE' || paused) return
      getNearestInteraction()?.action()
    })
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyQ') return
      // Unlike E (board/disembark), Q works even while paused — chat is
      // meant to be reachable from the pause menu too, not just mid-game
      // (see the raised #chat-toggle/#chat-panel z-index in style.css).
      // Don't hijack Q while the player is actually typing a message that
      // happens to contain the letter Q.
      if (document.activeElement === hud.chatInput) return
      // Otherwise this keydown is about to focus the chat input as part of
      // opening it (see hud.onChatOpen) — without preventDefault the
      // browser still delivers this same keystroke to that now-focused
      // input, leaving a stray "q" typed into it.
      e.preventDefault()
      hud.toggleChat()
    })
  }

  function getFishingZone() {
    const dist = Math.hypot(camera.position.x, camera.position.z)
    const deepSea = player.mode === 'boat' && dist > OPEN_SEA_RADIUS
    return { deepSea, deepSeaBonus: deepSea ? 0.5 : 0 }
  }

  const fishing = new Fishing({
    scene,
    camera,
    player,
    water,
    domElement: renderer.domElement,
    onStatus: (text, opts) => hud.setStatus(text, opts),
    getZone: getFishingZone,
    getExtraBiteSpeedBonus: () => dayNight.getRainBiteBonus(),
    getExtraLegendaryBonus: () => dayNight.getNightLegendaryBonus(),
    // Survival catches feed Hunger instead of the "Dapat X! +N poin" line —
    // see game/survival.js's foodValueFor.
    getCatchStatusText: (fish) => {
      if (!survival.active) return null
      const amount = foodValueFor(fish)
      return amount > 0 ? `🍖 Dimakan: ${fish.name} (+${amount} Lapar)` : `${fish.name} bukan makanan...`
    },
    onCatch: (fish) => {
      recordCatch(fish.id, fish.weight)
      if (session?.user) {
        addInventoryItem(session.user.id, fish.id, fish.weight).catch(() => {})
      }
      if (survival.active) {
        // Survival is about staying alive, not the points economy — catches
        // here restore Hunger only, never wallet/points/match registration.
        const foodAmount = survival.feed(fish)
        hud.showCatch(fish, { foodAmount })
      } else {
        if (!fish.junk) {
          totalPoints += fish.points
          wallet += fish.points
          const prevLevel = getLevelInfo(totalPoints - fish.points).level
          const newLevel = getLevelInfo(totalPoints).level
          hud.setScore(wallet)
          hud.setLevel(newLevel)
          if (newLevel > prevLevel) hud.showLevelUp(newLevel)
          persistPoints()
        }
        multiplayer.registerCatch(fish)
        // NOTE: this used to force-exit pointer lock here so the (now
        // disabled) share button on the catch popup would be clickable. With
        // sharing off there's nothing on the popup to click, and releasing
        // the lock was actually a bug on desktop: the player would land back
        // in "free cursor" mode with no obvious way back in (clicking the
        // canvas to re-lock could also get eaten as a stray cast attempt),
        // making it look like fishing was broken. Just leave the lock alone
        // now — the catch popup is purely a toast, no interaction needed.
        hud.showCatch(fish)
      }
      checkAchievements()
    },
    onMiss: () => {},
  })

  // ---- Pause menu (Escape on desktop, ☰ button always) ----------------
  let paused = true
  // Opening chat on desktop deliberately releases pointer lock (see
  // hud.onChatOpen below) so the mouse cursor comes back for clicking
  // around the panel. That triggers the same 'unlock' event Escape does —
  // this flag tells the listener "this one's from chat, not a real
  // pause," so it doesn't also pop the pause menu open on top of it.
  let suppressChatUnlock = false
  const menuRoot = document.querySelector('#menu-root')
  const pauseMenu = new PauseMenu(menuRoot, {
    username,
    userId: session?.user?.id ?? null,
    avatar,
    getScore: () => wallet,
    getTotalPoints: () => totalPoints,
    spendScore: (amount) => {
      if (wallet < amount) return false
      wallet -= amount
      hud.setScore(wallet)
      persistPoints()
      return true
    },
    onSensitivityChange: (v) => {
      player.controls.pointerSpeed = v
    },
    onStoreChange: () => {
      hud.setBadge(getCosmeticBadge())
      applyEquippedSkins()
      updatePresenceCosmetics(currentCosmeticsForPresence())
      checkAchievements()
    },
    onAvatarChange: (newAvatar) => {
      avatar = newAvatar
      if (session?.user) updateAvatar(session.user.id, newAvatar).catch(() => {})
      else saveLocalAvatar(newAvatar)
    },
    getAchievementsState: () => ({ stats: currentAchievementStats(), claimedIds: claimedAchievementIds }),
    onResume: () => enterGame(),
    multiplayer,
    onInviteFriend: (friendId, code) =>
      sendChat({ fromId: identityId, fromName: username, toId: friendId, text: `Ayo gabung room ${code}!`, invite: { code } }),
    survival,
    onStartSurvival: () => startSurvival(),
    onLeaveSurvival: () => {
      hud.hideSurvivalHud()
      player.setMode('dock', PIER_RETURN_POSITION)
    },
  })

  // Shared by "▶ Main" (single player) and the multiplayer countdown
  // finishing — both just mean "close the menu and put the player back in
  // control of the camera/movement".
  function enterGame() {
    unlockAudio()
    if (touch) {
      paused = false
      pauseMenu.close()
    } else {
      player.controls.lock()
    }
  }

  function openPause() {
    paused = true
    fishing.releaseAction()
    pauseMenu.open()
    hud.hideInteractPrompt()
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
  }

  // ---- Survival event wiring (Sub-tahap Survival-A) ----------------------
  function startSurvival() {
    survival.start()
    player.setMode('island', SURVIVAL_SPAWN_POSITION)
    hud.showSurvivalHud()
    hud.updateSurvivalStats(survival.snapshot())
    enterGame()
  }

  survival.onStatChange = (snapshot) => hud.updateSurvivalStats(snapshot)
  survival.onDayChange = (day, missedSleep) => {
    if (missedSleep) hud.showSurvivalToast(`☀️ Fajar tiba, kamu begadang semalaman... Stamina berkurang! Hari ${day} dimulai.`)
  }
  survival.onGameOver = ({ reason, day, isNewRecord, bestDay }) => {
    hud.hideSurvivalHud()
    openPause()
    showSurvivalEnd(
      { outcome: 'lose', reason, day, totalDays: SURVIVAL_TOTAL_DAYS, bestDay, isNewRecord },
      { onClose: () => player.setMode('dock', PIER_RETURN_POSITION) }
    )
  }
  survival.onWin = ({ day, isNewRecord, bestDay }) => {
    hud.hideSurvivalHud()
    openPause()
    showSurvivalEnd(
      { outcome: 'win', day, totalDays: SURVIVAL_TOTAL_DAYS, bestDay, isNewRecord },
      { onClose: () => player.setMode('dock', PIER_RETURN_POSITION) }
    )
  }

  // ---- Multiplayer event wiring ----------------------------------------
  multiplayer.onCountdown = (secondsLeft) => showCountdown(secondsLeft)
  multiplayer.onMatchBegin = () => {
    hideCountdown()
    enterGame()
  }
  multiplayer.onMatchTick = (info) => hud.updateMpBanner(info)
  multiplayer.onLeaveRoom = () => hud.hideMpBanner()
  multiplayer.onMatchEnd = (payload) => {
    hud.hideMpBanner()
    openPause()
    showMatchResults(payload, {
      localId: identityId,
      onClose: () => multiplayer.leaveRoom(),
    })
  }
  // Tapping a "🎮 Gabung Room" invite in chat — pause (releasing pointer
  // lock as needed), close the chat panel, join, and land straight on the
  // room screen instead of the pause menu's main view.
  hud.onJoinRoomInvite = (code) => {
    hud.toggleChat(false)
    openPause()
    multiplayer.joinRoom(code)
    pauseMenu.openMultiplayerRoom()
  }

  if (!touch) {
    player.controls.addEventListener('lock', () => {
      paused = false
      pauseMenu.close()
    })
    player.controls.addEventListener('unlock', () => {
      if (suppressChatUnlock) {
        suppressChatUnlock = false
        return
      }
      if (!paused) openPause()
    })
  }

  // Silently reconcile any achievements already earned before this feature
  // existed (or on another device), then show the first-run tutorial (new
  // players only) followed by today's login bonus, if not yet claimed.
  checkAchievements(true)

  function maybeShowDailyReward() {
    const rows = session?.user ? inventoryRows : null
    if (isDailyClaimedToday(rows)) return
    const streakAfter = computeDailyStreak(rows) + 1
    const reward = dailyRewardForStreak(streakAfter)
    showDailyRewardModal({
      streak: streakAfter,
      reward,
      onClaim: () => {
        unlockAudio()
        playDailyReward()
        wallet += reward
        hud.setScore(wallet)
        persistPoints()
        if (session?.user) addInventoryItem(session.user.id, dailyJenisId(todayDailyKey())).catch(() => {})
        else markDailyClaimedLocally()
      },
    })
  }

  if (!hasSeenTutorial()) {
    showTutorial({
      touch,
      onDone: () => {
        unlockAudio()
        pauseMenu.open()
        maybeShowDailyReward()
      },
    })
  } else {
    pauseMenu.open()
    maybeShowDailyReward()
  }

  // ---- Touch controls (phones/tablets) ---------------------------------
  let touchControls = null
  if (touch) {
    touchControls = new TouchControls(document.querySelector('#game-container'), {
      onMove: (x, y) => {
        if (!paused) player.setAnalogMove(x, y)
      },
      onLook: (dx, dy) => {
        if (!paused) player.applyLookDelta(dx, dy)
      },
      onActionStart: () => {
        unlockAudio()
        if (!paused) fishing.pressAction()
      },
      onActionEnd: () => {
        if (!paused) fishing.releaseAction()
      },
      onPause: () => {
        if (paused) {
          paused = false
          pauseMenu.close()
        } else {
          openPause()
        }
      },
    })
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const clock = new THREE.Clock()
  function animate() {
    requestAnimationFrame(animate)
    const dt = Math.min(clock.getDelta(), 0.1)
    const elapsed = clock.elapsedTime

    if (!paused) {
      water.update(elapsed)
      player.update(dt, 1, water, elapsed)
      fishing.update(dt, elapsed)
      dayNight.update(dt)
      survival.tick(dt)
      updateInteractPrompt()
    }
    // Remote-player interpolation and the match clock keep running in real
    // time even while paused (same as it would for everyone else in the
    // room) — only our own position broadcast pauses with everything else.
    multiplayer.tick(dt, paused)
    hud.setTimeWeather(dayNight.getLabel())

    renderer.render(scene, camera)
  }
  animate()
}

main()
