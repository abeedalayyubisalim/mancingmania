import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'

// Bounds the player is allowed to walk within (the dock platform + pier).
const BOUNDS = { minX: -2.6, maxX: 2.6, minZ: 2, maxZ: 24.5 }
const EYE_HEIGHT = 1.7

export class Player {
  constructor(camera, domElement) {
    this.camera = camera
    this.controls = new PointerLockControls(camera, domElement)

    this.camera.position.set(0, EYE_HEIGHT, 5)

    this.move = { forward: false, back: false, left: false, right: false }
    this.velocity = new THREE.Vector3()

    this._onKeyDown = (e) => this.setKey(e.code, true)
    this._onKeyUp = (e) => this.setKey(e.code, false)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)

    this._buildViewmodel()
  }

  setKey(code, down) {
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
    }
  }

  _buildViewmodel() {
    // A simple low-poly fishing rod held in view, parented to the camera.
    this.rig = new THREE.Group()
    this.camera.add(this.rig)

    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1a, flatShading: true })
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

  // World-space position of the rod tip, for spawning the fishing line/bobber.
  getRodTipWorld() {
    return this.rodTipLocal.clone().applyMatrix4(this.rodGroup.matrixWorld)
  }

  update(dt, bobAmount = 1) {
    const speed = 3.2
    const damping = 10

    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate()

    const wish = new THREE.Vector3()
    if (this.move.forward) wish.add(forward)
    if (this.move.back) wish.sub(forward)
    if (this.move.right) wish.add(right)
    if (this.move.left) wish.sub(right)
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed)

    this.velocity.lerp(wish, Math.min(1, damping * dt))

    const pos = this.camera.position
    pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, BOUNDS.minX, BOUNDS.maxX)
    pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, BOUNDS.minZ, BOUNDS.maxZ)

    // Subtle walk bob.
    const moving = wish.lengthSq() > 0
    this._bobT = (this._bobT ?? 0) + (moving ? dt * 8 : dt * 2)
    const bob = moving ? Math.sin(this._bobT) * 0.03 : Math.sin(this._bobT) * 0.01
    pos.y = EYE_HEIGHT + bob * bobAmount
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
  }
}
