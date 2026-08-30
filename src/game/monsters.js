import * as THREE from 'three'
import {
  SHORE_LIFT,
  SURVIVAL_ISLAND_CENTER,
  SURVIVAL_ISLAND_BOUNDS,
  SURVIVAL_LAKE_POSITION,
  SURVIVAL_RIVER_POSITION,
  getSurvivalGroundHeight,
} from './scene.js'

// Sub-tahap Survival-C: wave-based "monster fish" combat. Every night
// (starting the 2nd night, once the player's had a chance to get their
// bearings), a handful of these crawl out of the lake/river/coast and
// shamble straight toward the player in a dead-straight line — no
// pathfinding, matching the rest of this stacked-primitive world's "no real
// 3D collision" design (see scene.js). Killed with thrown rocks (a forgiving
// hitscan, not a real physics projectile — see throwRock below); anything
// still alive at dawn despawns, same as the day/night cycle already resets
// everything else in Survival mode.
//
// Rendering note: same "grass disc has no hole, and its top face at world y
// SHORE_LIFT+0.5 hides anything fully below it" pitfall documented in
// scene.js applies here — these are real visible meshes (unlike the
// camera-only player), so they're deliberately lifted clear of that surface
// (see GRASS_WORLD_TOP below), not just given a ground-height Y like the
// camera rig is.
const GRASS_WORLD_TOP = SHORE_LIFT + 0.5
const FEET_CLEARANCE = 0.55

const MONSTER_SPEED = 2.4 // units/sec
const CONTACT_RADIUS = 1.6
const STOP_RADIUS = CONTACT_RADIUS * 0.7 // stop closing in once already biting range
const CONTACT_DAMAGE = 6
const CONTACT_COOLDOWN = 1.1 // seconds between bites from the same monster
const MONSTER_HP = 2 // rock hits to kill
const THROW_RANGE = 26
const THROW_HIT_RADIUS = 1.5 // forgiving aim cone — arcade game, not a shooter
const ROCK_FLIGHT_TIME = 0.16 // seconds, purely cosmetic

function buildMonsterMesh() {
  const group = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3c2f4a, flatShading: true })
  const finMat = new THREE.MeshStandardMaterial({ color: 0x241b30, flatShading: true })
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0x8a2f2f, flatShading: true })
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff3b3b,
    emissive: 0xff2020,
    emissiveIntensity: 1.4,
    flatShading: true,
  })

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), bodyMat)
  body.scale.set(1.7, 1.0, 1.1)
  body.castShadow = true
  group.add(body)

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), bodyMat)
  jaw.rotation.z = -Math.PI / 2
  jaw.position.set(1.25, -0.15, 0)
  group.add(jaw)

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 4), finMat)
  tail.rotation.z = Math.PI / 2
  tail.position.set(-1.4, 0, 0)
  group.add(tail)

  const finTop = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 3), finMat)
  finTop.position.set(-0.2, 0.75, 0)
  group.add(finTop)

  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), spikeMat)
    spike.position.set(0.5 - i * 0.5, 0.55, 0)
    group.add(spike)
  }

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), eyeMat)
  eyeL.position.set(0.75, 0.2, 0.42)
  group.add(eyeL)
  const eyeR = eyeL.clone()
  eyeR.position.z = -0.42
  group.add(eyeR)

  group.scale.setScalar(1.15)
  return group
}

export class MonsterField {
  constructor({ scene, onPlayerHit, onKill }) {
    this.scene = scene
    this.onPlayerHit = onPlayerHit ?? (() => {})
    this.onKill = onKill ?? (() => {}) // (aliveCountRemaining) => void
    this.monsters = [] // { mesh, hp, alive, biteTimer, bob }
    this._fx = [] // in-flight cosmetic thrown-rock meshes
  }

  get aliveCount() {
    return this.monsters.reduce((n, m) => n + (m.alive ? 1 : 0), 0)
  }

  _groundY(x, z) {
    return GRASS_WORLD_TOP + FEET_CLEARANCE + getSurvivalGroundHeight(x, z)
  }

  // Picks a spawn point out at the water's edge — the lake, somewhere along
  // the river's run, or a random point along the walkable island's outer
  // perimeter (the "coast" from the mainland-fishing zones' point of view) —
  // so a wave visibly comes FROM the water rather than popping up inland.
  _spawnPoint() {
    const roll = Math.random()
    if (roll < 0.35) {
      const a = Math.random() * Math.PI * 2
      const r = 4 + Math.random() * 4
      return { x: SURVIVAL_LAKE_POSITION.x + Math.cos(a) * r, z: SURVIVAL_LAKE_POSITION.z + Math.sin(a) * r }
    }
    if (roll < 0.65) {
      return {
        x: SURVIVAL_RIVER_POSITION.x + (Math.random() - 0.5) * 5,
        z: SURVIVAL_ISLAND_CENTER.z - 20 + Math.random() * 45,
      }
    }
    const b = SURVIVAL_ISLAND_BOUNDS
    const margin = 2.5
    const side = Math.floor(Math.random() * 4)
    if (side === 0) return { x: b.minX + margin, z: b.minZ + Math.random() * (b.maxZ - b.minZ) }
    if (side === 1) return { x: b.maxX - margin, z: b.minZ + Math.random() * (b.maxZ - b.minZ) }
    if (side === 2) return { x: b.minX + Math.random() * (b.maxX - b.minX), z: b.minZ + margin }
    return { x: b.minX + Math.random() * (b.maxX - b.minX), z: b.maxZ - margin }
  }

  spawnWave(count) {
    for (let i = 0; i < count; i++) {
      const p = this._spawnPoint()
      const mesh = buildMonsterMesh()
      mesh.position.set(p.x, this._groundY(p.x, p.z), p.z)
      mesh.rotation.y = Math.random() * Math.PI * 2
      this.scene.add(mesh)
      this.monsters.push({ mesh, hp: MONSTER_HP, alive: true, biteTimer: 0.5, bob: Math.random() * Math.PI * 2 })
    }
  }

  despawnAll() {
    for (const m of this.monsters) this.scene.remove(m.mesh)
    this.monsters = []
    for (const fx of this._fx) this.scene.remove(fx.mesh)
    this._fx = []
  }

  update(dt, playerPos, elapsed) {
    for (const m of this.monsters) {
      if (!m.alive) continue
      const dx = playerPos.x - m.mesh.position.x
      const dz = playerPos.z - m.mesh.position.z
      const dist = Math.hypot(dx, dz)
      if (dist > 0.05) {
        const nx = dx / dist
        const nz = dz / dist
        if (dist > STOP_RADIUS) {
          m.mesh.position.x += nx * MONSTER_SPEED * dt
          m.mesh.position.z += nz * MONSTER_SPEED * dt
        }
        m.mesh.rotation.y = Math.atan2(nx, nz)
      }
      m.mesh.position.y =
        this._groundY(m.mesh.position.x, m.mesh.position.z) + Math.sin(elapsed * 3 + m.bob) * 0.06

      if (m.biteTimer > 0) m.biteTimer -= dt
      if (dist < CONTACT_RADIUS && m.biteTimer <= 0) {
        m.biteTimer = CONTACT_COOLDOWN
        this.onPlayerHit(CONTACT_DAMAGE)
      }
    }

    for (let i = this._fx.length - 1; i >= 0; i--) {
      const fx = this._fx[i]
      fx.t += dt
      const t = Math.min(1, fx.t / ROCK_FLIGHT_TIME)
      fx.mesh.position.lerpVectors(fx.from, fx.to, t)
      fx.mesh.position.y += Math.sin(t * Math.PI) * 0.4
      if (t >= 1) {
        this.scene.remove(fx.mesh)
        this._fx.splice(i, 1)
      }
    }
  }

  // Forgiving hitscan: cast a ray from the camera and find the nearest
  // alive monster whose body center is close to that ray (a wide cone, not
  // pixel-perfect aim — this is a low-poly arcade game, not a shooter).
  // Always spawns the cosmetic flying-rock fx toward wherever the throw
  // landed, hit or miss, so every throw reads as having done something.
  throwRock(camera) {
    const origin = camera.position.clone()
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)

    let best = null
    let bestAlong = Infinity
    for (const m of this.monsters) {
      if (!m.alive) continue
      const toM = m.mesh.position.clone().sub(origin)
      const along = toM.dot(dir)
      if (along <= 0 || along > THROW_RANGE) continue
      const closest = origin.clone().addScaledVector(dir, along)
      const off = m.mesh.position.distanceTo(closest)
      if (off > THROW_HIT_RADIUS) continue
      if (along < bestAlong) {
        bestAlong = along
        best = m
      }
    }

    const target = best ? best.mesh.position.clone() : origin.clone().addScaledVector(dir, 6)
    this._spawnRockFx(origin, target)

    if (!best) return { hit: false, killed: false }
    best.hp -= 1
    if (best.hp <= 0) {
      best.alive = false
      this.scene.remove(best.mesh)
      this.onKill(this.aliveCount)
      return { hit: true, killed: true }
    }
    return { hit: true, killed: false }
  }

  _spawnRockFx(from, to) {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: 0x8a8578, flatShading: true })
    )
    mesh.position.copy(from)
    this.scene.add(mesh)
    this._fx.push({ mesh, from: from.clone(), to: to.clone(), t: 0 })
  }
}
