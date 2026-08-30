import * as THREE from 'three'
import './style.css'
import { showAuthGate } from './auth-ui.js'
import { Hud } from './hud.js'
import { buildEnvironment } from './game/scene.js'
import { Water } from './game/water.js'
import { Player } from './game/player.js'
import { Fishing } from './game/fishing.js'
import { submitScore, fetchLeaderboard, addInventoryItem } from './supabase-client.js'
import { PauseMenu } from './pause-menu.js'
import { TouchControls } from './touch-controls.js'
import { isTouchDevice } from './settings.js'
import { recordCatch } from './collection.js'

const app = document.querySelector('#app')

async function main() {
  const { session, username, guest } = await showAuthGate(app)
  startGame({ session, username, guest })
}

function startGame({ session, username, guest }) {
  let score = 0
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
  hud.setScore(score)
  hud.onOpenLeaderboard = async () => {
    const rows = await fetchLeaderboard(10)
    hud.renderLeaderboard(rows, username)
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
      recordCatch(fish.id)
      if (session?.user) {
        addInventoryItem(session.user.id, fish.id).catch(() => {})
      }
      if (!fish.junk) {
        score += fish.points
        hud.setScore(score)
        if (session?.user) submitScore(session.user.id, username, score)
      }
      hud.showCatch(fish)
    },
    onMiss: () => {},
  })

  // ---- Pause menu (Escape on desktop, ☰ button always) ----------------
  let paused = true
  const menuRoot = document.querySelector('#menu-root')
  const pauseMenu = new PauseMenu(menuRoot, {
    username,
    userId: session?.user?.id ?? null,
    onSensitivityChange: (v) => {
      player.controls.pointerSpeed = v
    },
    onResume: () => {
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
      if (!paused) openPause()
    })
  }
  pauseMenu.open()

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
