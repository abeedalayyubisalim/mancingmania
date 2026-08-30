import * as THREE from 'three'
import './style.css'
import { showAuthGate } from './auth-ui.js'
import { Hud } from './hud.js'
import { buildEnvironment } from './game/scene.js'
import { Water } from './game/water.js'
import { Player } from './game/player.js'
import { Fishing } from './game/fishing.js'
import { fetchProfile, syncPoints, updateAvatar, fetchLeaderboard, fetchInventory, addInventoryItem } from './supabase-client.js'
import { PauseMenu } from './pause-menu.js'
import { TouchControls } from './touch-controls.js'
import { isTouchDevice } from './settings.js'
import { recordCatch, allEntries as allCollectionEntries, groupInventoryRows } from './collection.js'
import { getCosmeticBadge, applySyncedInventory, getGearTier, getOwned, GEAR_LINES } from './store.js'
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
  hud.onOpenLeaderboard = async () => {
    const rows = await fetchLeaderboard(10)
    hud.renderLeaderboard(rows, username)
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

  buildEnvironment(scene)
  const water = new Water()
  scene.add(water.mesh)

  const player = new Player(camera, renderer.domElement)
  // The camera must live in the scene graph for objects parented to it
  // (the viewmodel rod) to be rendered.
  scene.add(camera)

  const fishing = new Fishing({
    scene,
    camera,
    player,
    water,
    domElement: renderer.domElement,
    onStatus: (text, opts) => hud.setStatus(text, opts),
    onCatch: (fish) => {
      recordCatch(fish.id, fish.weight)
      if (session?.user) {
        addInventoryItem(session.user.id, fish.id, fish.weight).catch(() => {})
      }
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
      checkAchievements()
      // The share button on the catch popup is unusable while the mouse
      // is pointer-locked (cursor hidden/captured, and the global
      // mousedown listener in fishing.js would treat the click as a new
      // cast). Release the lock so the popup is actually clickable; the
      // `unlock` handler below is told to not treat this as "player
      // opened the pause menu" via suppressUnlockPause. The player can
      // re-lock (and resume) just by clicking the canvas again.
      if (!touch && document.pointerLockElement === renderer.domElement) {
        suppressUnlockPause = true
        document.exitPointerLock()
      }
      hud.showCatch(fish)
    },
    onMiss: () => {},
  })

  // ---- Pause menu (Escape on desktop, ☰ button always) ----------------
  let paused = true
  let suppressUnlockPause = false
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
      checkAchievements()
    },
    onAvatarChange: (newAvatar) => {
      avatar = newAvatar
      if (session?.user) updateAvatar(session.user.id, newAvatar).catch(() => {})
      else saveLocalAvatar(newAvatar)
    },
    getAchievementsState: () => ({ stats: currentAchievementStats(), claimedIds: claimedAchievementIds }),
    onResume: () => {
      unlockAudio()
      if (touch) {
        paused = false
        pauseMenu.close()
      } else {
        player.controls.lock()
      }
    },
  })

  function openPause() {
    paused = true
    fishing.releaseAction()
    pauseMenu.open()
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock()
  }

  if (!touch) {
    player.controls.addEventListener('lock', () => {
      paused = false
      pauseMenu.close()
    })
    player.controls.addEventListener('unlock', () => {
      if (suppressUnlockPause) {
        suppressUnlockPause = false
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
      player.update(dt)
      fishing.update(dt, elapsed)
    }

    renderer.render(scene, camera)
  }
  animate()
}

main()
