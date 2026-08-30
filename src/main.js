import * as THREE from 'three'
import './style.css'
import { showAuthGate } from './auth-ui.js'
import { Hud } from './hud.js'
import { buildEnvironment } from './game/scene.js'
import { Water } from './game/water.js'
import { Player } from './game/player.js'
import { Fishing } from './game/fishing.js'
import { submitScore, fetchLeaderboard } from './supabase-client.js'

const app = document.querySelector('#app')

async function main() {
  const { session, username, guest } = await showAuthGate(app)
  startGame({ session, username, guest })
}

function startGame({ session, username, guest }) {
  let score = 0
  app.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="hud-root"></div>
      <div id="blocker">
        <div id="blocker-inner">
          <h2>🎣 Klik untuk mulai</h2>
          <p>WASD gerak, mouse untuk melihat sekitar.<br/>Klik &amp; tahan untuk mengisi lemparan, lepas untuk melempar kail.</p>
        </div>
      </div>
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

  const blocker = document.querySelector('#blocker')
  blocker.addEventListener('click', () => player.controls.lock())
  player.controls.addEventListener('lock', () => blocker.classList.add('hidden'))
  player.controls.addEventListener('unlock', () => blocker.classList.remove('hidden'))

  const fishing = new Fishing({
    scene,
    camera,
    player,
    water,
    domElement: renderer.domElement,
    onStatus: (text, opts) => hud.setStatus(text, opts),
    onCatch: (fish) => {
      if (!fish.junk) {
        score += fish.points
        hud.setScore(score)
        if (session?.user) submitScore(session.user.id, username, score)
      }
      hud.showCatch(fish)
    },
    onMiss: () => {},
  })

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

    water.update(elapsed)
    player.update(dt)
    fishing.update(dt, elapsed)

    renderer.render(scene, camera)
  }
  animate()
}

main()
