import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { settings } from '../settings.js'
import { getSkinColor } from '../store.js'
import { SURVIVAL_ISLAND_CENTER, SURVIVAL_ISLAND_BOUNDS, SHORE_LIFT, getSurvivalGroundHeight } from './scene.js'

// Bounds the player is allowed to walk within (the dock platform + pier).
const DOCK_BOUNDS = { minX: -2.6, maxX: 2.6, minZ: 2, maxZ: 24.5 }
// Once aboard the boat, the whole (large) water plane is navigable.
const BOAT_BOUNDS = { minX: -185, maxX: 185, minZ: -185, maxZ: 185 }
// Survival mode roams the whole (much bigger, Sub-tahap Survival-B) survival
// island — forest, mountain, river and lake all included — so every biome
// piece built in game/scene.js's buildSurvivalIsland() stays reachable. This
// box is the single source of truth for the walkable footprint — scene.js's
// isNearSurvivalCoast() is defined relative to the same box.
const ISLAND_BOUNDS = SURVIVAL_ISLAND_BOUNDS
const EYE_HEIGHT = 1.7
const BOAT_EYE_HEIGHT = 1.5
// Vertical hop (spacebar) — off the boat only. No real air control, just a
// snappy up-then-down arc back to whatever the ground height is under you
// when you land (see getGroundHeight below).
const GRAVITY = 18
const JUMP_SPEED = 6.5
// The rod shaft's built-in color, absent any purchased skin.
export const DEFAULT_ROD_COLOR = 0x3b2a1a
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')

export class Player {
  constructor(camera, domElement) {
    this.camera = camera
    this.controls = new PointerLockControls(camera, domElement)
    this.controls.pointerSpeed = settings.lookSensitivity

    this.camera.position.set(0, SHORE_LIFT + EYE_HEIGHT, 5)
    this.mode = 'dock' // 'dock' | 'boat'
    this.bounds = DOCK_BOUNDS

    this.move = { forward: false, back: false, left: false, right: false }
    // Analog stick input (touch joystick), each in [-1, 1].
    this.analog = { x: 0, y: 0 }
    this.velocity = new THREE.Vector3()
    // Set while a text input (chat, etc.) has focus, so typing "wasd" in a
    // message doesn't also walk the character around the dock.
    this.inputLocked = false
    // Jump/gravity state (off the boat only) — see GRAVITY/JUMP_SPEED.
    this._vy = 0
    this._grounded = true

    this._onKeyDown = (e) => this.setKey(e.code, true)
    this._onKeyUp = (e) => this.setKey(e.code, false)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)

    this._buildViewmodel()
  }

  setInputLocked(locked) {
    this.inputLocked = locked
    if (locked) this.move = { forward: false, back: false, left: false, right: false }
  }

  setKey(code, down) {
    if (this.inputLocked) return
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.move.forward = down
        break
      case 'KeyS':
      case 'ArrowDown':
        this.move.back = down
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.move.left = down
        break
      case 'KeyD':
      case 'ArrowRight':
        this.move.right = down
        break
      case 'Space':
        if (down) this.jump()
        break
    }
  }

  // Off the boat only — a simple upward velocity impulse, gravity (applied
  // in update()) brings it back down onto whatever the ground height is at
  // the landing spot. Ignored mid-air so you can't double-jump.
  jump() {
    if (this.mode === 'boat' || !this._grounded) return
    this._vy = JUMP_SPEED
    this._grounded = false
  }

  // Ground elevation (world Y) directly beneath a given x/z, off the boat.
  // Flat SHORE_LIFT everywhere except the survival island, where
  // getSurvivalGroundHeight adds the foothill/mountain slope on top.
  _groundHeightAt(x, z) {
    const bump = this.mode === 'island' ? getSurvivalGroundHeight(x, z) : 0
    return SHORE_LIFT + bump
  }

  _buildViewmodel() {
    // A simple low-poly fishing rod held in view, parented to the camera.
    this.rig = new THREE.Group()
    this.camera.add(this.rig)

    const rodMat = new THREE.MeshStandardMaterial({
      color: getSkinColor('rod', DEFAULT_ROD_COLOR),
      flatShading: true,
    })
    this.rodMat = rodMat
    const handMat = new THREE.MeshStandardMaterial({ color: 0xe0ac7a, flatShading: true })
    const reelMat = new THREE.MeshStandardMaterial({ color: 0x999999, flatShading: true, metalness: 0.6, roughness: 0.4 })

    const rodGroup = new THREE.Group()

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 6), handMat)
    handle.position.set(0, -0.15, 0)
    rodGroup.add(handle)

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 1.5, 6), rodMat)
    shaft.position.set(0, 0.6, 0)
    rodGroup.add(shaft)

    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), reelMat)
    reel.rotation.x = Math.PI / 2
    reel.position.set(0, -0.05, 0.05)
    rodGroup.add(reel)
    this.reel = reel

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), handMat)
    hand.position.set(0, -0.1, 0.02)
    rodGroup.add(hand)

    rodGroup.position.set(0.32, -0.32, -0.55)
    rodGroup.rotation.set(-0.15, 0, -0.12)
    this.rig.add(rodGroup)
    this.rodGroup = rodGroup
    this.rodTipLocal = new THREE.Vector3(0, 1.3, 0)
  }

  // Switches between walking on the dock (small bounds, fixed eye height),
  // roaming the home island during Survival ('island', wider bounds — see
  // ISLAND_BOUNDS), and piloting the boat (huge bounds spanning the whole
  // water plane, eye height gently follows the waves). `position` (optional)
  // re-places the camera immediately, e.g. to the boat's mooring spot or
  // back to the dock.
  setMode(mode, position = null) {
    this.mode = mode
    this.bounds = mode === 'boat' ? BOAT_BOUNDS : mode === 'island' ? ISLAND_BOUNDS : DOCK_BOUNDS
    if (position) {
      this.camera.position.x = position.x
      this.camera.position.z = position.z
      // Snap straight to the new spot's ground height instead of letting
      // next frame's gravity fall/rise into it — without this a teleport
      // from high ground (e.g. leaving Survival near the mountain) back to
      // flat ground plays out as a brief unwanted free-fall.
      if (mode !== 'boat') this.camera.position.y = this._groundHeightAt(position.x, position.z) + EYE_HEIGHT
      this._vy = 0
      this._grounded = true
    }
  }

  // Re-applies whichever rod skin is currently equipped (or the default
  // color) — call after a store purchase/equip so the change shows up
  // immediately without rebuilding the whole viewmodel.
  applyRodSkin() {
    this.rodMat.color.setHex(getSkinColor('rod', DEFAULT_ROD_COLOR))
  }

  // World-space position of the rod tip, for spawning the fishing line/bobber.
  getRodTipWorld() {
    return this.rodTipLocal.clone().applyMatrix4(this.rodGroup.matrixWorld)
  }

  // Set by the touch joystick: x = strafe (-1..1), y = forward/back (-1..1).
  setAnalogMove(x, y) {
    this.analog.x = x
    this.analog.y = y
  }

  // Rotates the camera directly from a touch-drag delta (used on mobile,
  // where the Pointer Lock API PointerLockControls relies on isn't reliably
  // available). Mirrors PointerLockControls' own YXZ euler math.
  applyLookDelta(dx, dy) {
    _euler.setFromQuaternion(this.camera.quaternion)
    const s = 0.0025 * settings.lookSensitivity
    _euler.y -= dx * s
    _euler.x -= dy * s
    const maxPitch = Math.PI / 2 - 0.01
    _euler.x = Math.max(-maxPitch, Math.min(maxPitch, _euler.x))
    this.camera.quaternion.setFromEuler(_euler)
  }

  update(dt, bobAmount = 1, water = null, elapsed = 0) {
    const speed = this.mode === 'boat' ? 7 : 3.2
    const damping = this.mode === 'boat' ? 3.5 : 10

    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    // NOTE: forward × up already points to the camera's true right when
    // facing -Z (three.js's default forward) with +Y up — no .negate()
    // needed. (An earlier version of this code negated it, which quietly
    // swapped A/D — and the touch joystick's left/right — the whole time.)
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0))

    const wish = new THREE.Vector3()
    if (this.move.forward) wish.add(forward)
    if (this.move.back) wish.sub(forward)
    if (this.move.right) wish.add(right)
    if (this.move.left) wish.sub(right)
    wish.addScaledVector(forward, this.analog.y)
    wish.addScaledVector(right, this.analog.x)
    if (wish.lengthSq() > 1) wish.normalize()
    wish.multiplyScalar(speed)

    this.velocity.lerp(wish, Math.min(1, damping * dt))

    const pos = this.camera.position
    pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, this.bounds.minX, this.bounds.maxX)
    pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, this.bounds.minZ, this.bounds.maxZ)

    if (this.mode === 'boat' && water) {
      // Ride the waves instead of the little idle walk-bob.
      pos.y = water.heightAt(pos.x, pos.z, elapsed) + BOAT_EYE_HEIGHT
      this._vy = 0
      this._grounded = true
    } else {
      // Subtle walk bob.
      const moving = wish.lengthSq() > 0
      this._bobT = (this._bobT ?? 0) + (moving ? dt * 8 : dt * 2)
      const bob = moving ? Math.sin(this._bobT) * 0.03 : Math.sin(this._bobT) * 0.01
      const standingY = this._groundHeightAt(pos.x, pos.z) + EYE_HEIGHT + bob * bobAmount

      // Gravity/jump. While grounded, pos.y just hugs the terrain exactly
      // (so walking up OR down a slope — e.g. the survival island's
      // foothill/mountain — tracks it smoothly with zero lag); jump() sets
      // _grounded false and this free-falls/arcs until it reaches the
      // ground height under wherever the player ends up, then re-grounds.
      if (this._grounded) {
        pos.y = standingY
      } else {
        this._vy -= GRAVITY * dt
        pos.y += this._vy * dt
        if (pos.y <= standingY) {
          pos.y = standingY
          this._vy = 0
          this._grounded = true
        }
      }
    }
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
  }
}
