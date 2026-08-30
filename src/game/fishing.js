import * as THREE from 'three'
import { rollFish, rollWeight, pointsForWeight } from './fish-data.js'
import { getRareBonus, getLegendaryBonus, getBiteSpeedBonus } from '../store.js'

const STATE = {
  IDLE: 'idle',
  CHARGING: 'charging',
  FLYING: 'flying',
  WAITING: 'waiting',
  BITE: 'bite',
  REELING: 'reeling',
}

const MAX_CHARGE_TIME = 1.4 // seconds to reach full power
const MAX_CAST_DIST = 14
const MIN_CAST_DIST = 4
const BITE_WINDOW = 0.85
const REEL_FILL_RATE = 0.42 // per second while holding
const REEL_DECAY_RATE = 0.18 // per second while not holding
const REEL_TIMEOUT = 16

export class Fishing {
  constructor({ scene, camera, player, water, domElement, onStatus, onCatch, onMiss }) {
    this.scene = scene
    this.camera = camera
    this.player = player
    this.water = water
    this.domElement = domElement
    this.onStatus = onStatus
    this.onCatch = onCatch
    this.onMiss = onMiss

    this.state = STATE.IDLE
    this.power = 0
    this.reelProgress = 0
    this.holding = false
    this.currentFish = null
    this.clock = 0

    this._buildBobber()
    this._buildLine()

    this._onMouseDown = (e) => {
      if (e.button !== 0 || document.pointerLockElement !== this.domElement) return
      this.pressAction()
    }
    this._onMouseUp = (e) => {
      if (e.button !== 0) return
      this.releaseAction()
    }
    document.addEventListener('mousedown', this._onMouseDown)
    document.addEventListener('mouseup', this._onMouseUp)

    this._setStatus('Klik & tahan untuk mengisi lemparan, lepas untuk melempar kail.')
  }

  _buildBobber() {
    const group = new THREE.Group()
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xdd3b3b, flatShading: true })
    )
    const capTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true })
    )
    capTop.position.y = 0.1
    group.add(ball, capTop)
    group.visible = false
    this.bobber = group
    this.scene.add(group)
  }

  _buildLine() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff })
    this.line = new THREE.Line(geo, mat)
    this.line.visible = false
    this.scene.add(this.line)
  }

  _setStatus(text, opts = {}) {
    this.onStatus?.(text, opts)
  }

  // Public entry points for whatever input device is driving the game
  // (mouse hold, or a touch action button on mobile).
  pressAction() {
    this.holding = true
    if (this.state === STATE.IDLE) {
      this.state = STATE.CHARGING
      this.power = 0
      this._setStatus('Mengisi tenaga lemparan...', { power: 0 })
    } else if (this.state === STATE.BITE) {
      this._hookFish()
    }
  }

  releaseAction() {
    this.holding = false
    if (this.state === STATE.CHARGING) {
      this._cast()
    }
  }

  _cast() {
    const power = this.power
    this.state = STATE.FLYING

    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()

    const dist = MIN_CAST_DIST + power * (MAX_CAST_DIST - MIN_CAST_DIST)
    const start = this.player.getRodTipWorld()
    const target = start.clone().addScaledVector(dir, dist)
    target.y = this.water.heightAt(target.x, target.z, this.clock)

    this._flight = { start, target, t: 0, duration: THREE.MathUtils.clamp(dist / 16, 0.35, 0.9) }
    this.bobber.visible = true
    this.line.visible = true
    this._setStatus('Melempar kail...')
  }

  _startWaiting() {
    this.state = STATE.WAITING
    const base = 1.6 + Math.random() * 2.8 - this.power * 0.4
    this._waitTimer = Math.max(0.4, base * (1 - getBiteSpeedBonus()))
    this._setStatus('Menunggu ikan menggigit...')
  }

  _startBite() {
    this.state = STATE.BITE
    this._biteTimer = BITE_WINDOW
    this._setStatus('IKAN MENGGIGIT! Klik sekarang!', { alert: true })
  }

  _hookFish() {
    const base = rollFish(this.power, getRareBonus(), getLegendaryBonus())
    const weight = rollWeight(base)
    this.currentFish = { ...base, weight, points: pointsForWeight(base, weight) }
    this.state = STATE.REELING
    this.reelProgress = 0.18
    this._reelTimer = 0
    this._nextStruggle = 1 + Math.random() * 1.5
    this._setStatus(`Tersangkut! Tahan klik untuk menggulung "${this.currentFish.name}".`, { reeling: true, progress: this.reelProgress })
  }

  _fishEscapes(reason) {
    this.state = STATE.IDLE
    this.bobber.visible = false
    this.line.visible = false
    this.currentFish = null
    this.onMiss?.(reason)
    this._setStatus(reason, { reset: true })
  }

  _catchFish() {
    const fish = this.currentFish
    this.state = STATE.IDLE
    this.bobber.visible = false
    this.line.visible = false
    this.currentFish = null
    this.onCatch?.(fish)
    this._setStatus(
      fish.junk
        ? `Cuma dapat ${fish.name}...`
        : `Dapat ${fish.name} (${fish.weight.toFixed(2)} kg)! +${fish.points} poin`,
      { reset: true }
    )
  }

  update(dt, elapsed) {
    this.clock = elapsed

    if (this.state === STATE.CHARGING) {
      this.power = Math.min(1, this.power + dt / MAX_CHARGE_TIME)
      this._setStatus('Mengisi tenaga lemparan...', { power: this.power })
    }

    if (this.state === STATE.FLYING) {
      const f = this._flight
      f.t += dt / f.duration
      const t = Math.min(1, f.t)
      const pos = f.start.clone().lerp(f.target, t)
      pos.y = f.start.y + Math.sin(Math.PI * t) * 2.2 * (0.4 + this.power * 0.6)
      this.bobber.position.copy(pos)
      if (t >= 1) {
        this.bobber.position.copy(f.target)
        this._startWaiting()
      }
    }

    if (this.state === STATE.WAITING) {
      const p = this.bobber.position
      p.y = this.water.heightAt(p.x, p.z, elapsed) + 0.05
      this._waitTimer -= dt
      if (this._waitTimer <= 0) this._startBite()
    }

    if (this.state === STATE.BITE) {
      const p = this.bobber.position
      p.y = this.water.heightAt(p.x, p.z, elapsed) - 0.15 + Math.sin(elapsed * 40) * 0.05
      this._biteTimer -= dt
      if (this._biteTimer <= 0) this._fishEscapes('Ikan kabur, kurang cepat!')
    }

    if (this.state === STATE.REELING) {
      const p = this.bobber.position
      p.y = this.water.heightAt(p.x, p.z, elapsed) + Math.sin(elapsed * 25) * 0.08

      this._reelTimer += dt
      this._nextStruggle -= dt
      if (this._nextStruggle <= 0) {
        this.reelProgress -= 0.16
        this._nextStruggle = 1 + Math.random() * 1.8
      }

      this.reelProgress += (this.holding ? REEL_FILL_RATE : -REEL_DECAY_RATE) * dt
      this.reelProgress = THREE.MathUtils.clamp(this.reelProgress, 0, 1)

      // Slowly pull the bobber toward the player while reeling.
      const rodTip = this.player.getRodTipWorld()
      p.x = THREE.MathUtils.lerp(p.x, rodTip.x, dt * 0.5)
      p.z = THREE.MathUtils.lerp(p.z, rodTip.z, dt * 0.5)

      this._setStatus(
        this.holding ? 'Menggulung...' : 'Ikan menarik balik! Tahan klik!',
        { reeling: true, progress: this.reelProgress }
      )

      if (this.reelProgress >= 1) this._catchFish()
      else if (this.reelProgress <= 0 || this._reelTimer > REEL_TIMEOUT) this._fishEscapes('Ikan lepas!')
    }

    // Keep the line drawn from rod tip to bobber whenever it's out.
    if (this.bobber.visible) {
      const tip = this.player.getRodTipWorld()
      const pts = [tip, this.bobber.position.clone()]
      this.line.geometry.setFromPoints(pts)
    }

    // Reel wheel spins while actively reeling.
    if (this.player.reel) {
      this.player.reel.rotation.z += (this.state === STATE.REELING && this.holding ? 12 : 1) * dt
    }
  }

  dispose() {
    document.removeEventListener('mousedown', this._onMouseDown)
    document.removeEventListener('mouseup', this._onMouseUp)
  }
}
