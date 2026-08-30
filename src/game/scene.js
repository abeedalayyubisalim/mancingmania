import * as THREE from 'three'

// The rowboat hull's built-in color, absent any purchased skin.
export const DEFAULT_BOAT_COLOR = 0xb5432c

// How far above the water's own resting height (y=0) every walkable
// shoreline surface (island sand/grass, dock/pier deck) sits. Water.heightAt
// swings by about ±1.2 at its extremes (see game/water.js) — anything at or
// below that used to occasionally get visibly "flooded" by a wave crest.
// Lifting the land clear of the highest possible crest (with a margin) and
// extending each landmass's underside down past the lowest trough keeps the
// waterline looking like a beach at all times instead of lapping onto the
// grass. player.js's ground-height model adds this same amount so the
// camera keeps standing right at ground level, not sunk into it.
export const SHORE_LIFT = 1.3

function lowPolyTree(x, z) {
  const group = new THREE.Group()
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, flatShading: true })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3d, flatShading: true })

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 2, 6), trunkMat)
  trunk.position.y = 1
  trunk.castShadow = true
  group.add(trunk)

  for (let i = 0; i < 3; i++) {
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.25, 1.4, 7), leafMat)
    leaves.position.y = 2 + i * 0.9
    leaves.castShadow = true
    group.add(leaves)
  }

  group.position.set(x, 0, z)
  group.scale.setScalar(0.8 + Math.random() * 0.6)
  group.rotation.y = Math.random() * Math.PI * 2
  return group
}

function lowPolyRock(x, z, scale = 1) {
  const geo = new THREE.DodecahedronGeometry(0.6 * scale, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a7a72, flatShading: true })
  const rock = new THREE.Mesh(geo, mat)
  rock.position.set(x, 0.25 * scale, z)
  rock.rotation.set(Math.random(), Math.random(), Math.random())
  rock.castShadow = true
  rock.receiveShadow = true
  return rock
}

function island(x, z, radius, opts = {}) {
  const { withTrees = true, avoidAngleRange = null } = opts
  const group = new THREE.Group()
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8c27a, flatShading: true })
  // Stretched tall (top pinned at the old y=0.2 surface, bottom extended
  // deep down) so that after the whole group is lifted by SHORE_LIFT below,
  // the beach top clears the highest wave crest and the base still
  // disappears well beneath the lowest trough — see SHORE_LIFT above.
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, 3, 10), sandMat)
  sand.position.y = -1.3
  sand.receiveShadow = true
  sand.castShadow = true
  group.add(sand)

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a9d4f, flatShading: true })
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.9, 0.4, 10), grassMat)
  grass.position.y = 0.25
  grass.receiveShadow = true
  group.add(grass)

  if (withTrees) {
    const treeCount = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < treeCount; i++) {
      let a
      do {
        a = Math.random() * Math.PI * 2
      } while (avoidAngleRange && a > avoidAngleRange[0] && a < avoidAngleRange[1])
      const r = radius * 0.55 + Math.random() * radius * 0.35
      const t = lowPolyTree(Math.cos(a) * r, Math.sin(a) * r)
      t.position.y = 0.4
      group.add(t)
    }
  }

  group.position.set(x, SHORE_LIFT, z)
  return group
}

// Survival-mode camp props (Sub-tahap Survival-A) — placed on the far side
// of the home island from the dock/pier so they don't clash with it, using
// the same low-poly/flatShading language as everything else here. Present
// in the scene at all times (harmless during Normal mode, same as the boat
// always being there); only interactable while a survival run is active —
// see main.js's updateInteractPrompt().
function buildCave(x, z) {
  const group = new THREE.Group()
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6a62, flatShading: true })
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, flatShading: true })

  const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 0), rockMat)
  mound.position.set(0, 1.5, -0.6)
  mound.scale.set(1.3, 0.95, 1.1)
  mound.castShadow = true
  mound.receiveShadow = true
  group.add(mound)

  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), mouthMat)
  mouth.position.set(0, 0.95, 0.85)
  group.add(mouth)

  for (const [dx, dz, s] of [
    [-1.6, 0.6, 0.7],
    [1.7, 0.3, 0.9],
    [0.6, 1.3, 0.5],
  ]) {
    group.add(lowPolyRock(dx, dz, s))
  }

  group.position.set(x, 0, z)
  return group
}

// Sub-tahap Survival-B — the bigger, biome-varied survival island. Trees,
// mountain and river are purely decorative low-poly primitives (see
// player.js's ISLAND_BOUNDS — there's no real terrain collision in this
// game, movement is just a rectangular cage), while the lake/river/cave
// positions exported below double as proximity zones main.js checks for
// drinking + freshwater-biased fishing (see fish-data.js's rollFish zone).

function buildMountain(x, z) {
  const group = new THREE.Group()
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, flatShading: true })
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x716c60, flatShading: true })
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f1f6, flatShading: true })

  const base = new THREE.Mesh(new THREE.ConeGeometry(10, 11, 8), rockMat)
  base.position.set(0, 5, 0)
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const mid = new THREE.Mesh(new THREE.ConeGeometry(6, 6.5, 8), rockMat2)
  mid.position.set(0.6, 10, -0.6)
  mid.castShadow = true
  group.add(mid)

  const peak = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.8, 8), snowMat)
  peak.position.set(0.6, 14, -0.6)
  peak.castShadow = true
  group.add(peak)

  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 8.5 + Math.random() * 3.5
    group.add(lowPolyRock(Math.cos(a) * r, Math.sin(a) * r, 0.6 + Math.random() * 0.5))
  }

  group.position.set(x, 0, z)
  return group
}

function buildForest(x, z) {
  const group = new THREE.Group()
  const undergrowthMat = new THREE.MeshStandardMaterial({ color: 0x3c7a42, flatShading: true })

  for (let i = 0; i < 16; i++) {
    const dx = (Math.random() - 0.5) * 20
    const dz = (Math.random() - 0.5) * 20
    group.add(lowPolyTree(dx, dz))
  }
  for (let i = 0; i < 6; i++) {
    const dx = (Math.random() - 0.5) * 20
    const dz = (Math.random() - 0.5) * 20
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.3, 0), undergrowthMat)
    bush.position.set(dx, 0.3, dz)
    bush.castShadow = true
    group.add(bush)
  }
  for (let i = 0; i < 4; i++) {
    const dx = (Math.random() - 0.5) * 20
    const dz = (Math.random() - 0.5) * 20
    group.add(lowPolyRock(dx, dz, 0.35 + Math.random() * 0.4))
  }

  group.position.set(x, 0, z)
  return group
}

function buildLake(x, z, radius = 4.5) {
  const group = new THREE.Group()
  const poolMat = new THREE.MeshStandardMaterial({
    color: 0x4fb0d8,
    flatShading: true,
    roughness: 0.4,
    transparent: true,
    opacity: 0.9,
  })
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x6b8f5a, flatShading: true })

  const bank = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, 0.24, 20), bankMat)
  bank.position.set(0, -0.02, 0)
  bank.receiveShadow = true
  group.add(bank)

  const pool = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.12, 20), poolMat)
  pool.position.set(0, 0.08, 0)
  group.add(pool)

  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2
    const r = radius * (1.05 + Math.random() * 0.35)
    group.add(lowPolyRock(Math.cos(a) * r, Math.sin(a) * r, 0.35 + Math.random() * 0.4))
  }

  group.position.set(x, 0, z)
  return group
}

// A winding ribbon of flattened "water" boxes strung between waypoints
// (island-local x/z pairs) — cheap stand-in for a proper river mesh, in
// the same flat-shaded primitive style as everything else here.
function buildRiver(points, width = 2.4) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4fb0d8,
    flatShading: true,
    roughness: 0.4,
    transparent: true,
    opacity: 0.88,
  })
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x6b8f5a, flatShading: true })

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[i + 1]
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.hypot(dx, dz)
    const angle = Math.atan2(dx, dz)

    const bank = new THREE.Mesh(new THREE.BoxGeometry(width + 1.3, 0.08, len + 0.6), bankMat)
    bank.position.set((x1 + x2) / 2, -0.02, (z1 + z2) / 2)
    bank.rotation.y = angle
    group.add(bank)

    const seg = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, len + 0.6), mat)
    seg.position.set((x1 + x2) / 2, 0.06, (z1 + z2) / 2)
    seg.rotation.y = angle
    group.add(seg)
  }

  for (const [x, z] of points) {
    if (Math.random() < 0.7) {
      group.add(lowPolyRock(x + (Math.random() - 0.5) * width * 2, z + (Math.random() - 0.5) * 2, 0.3 + Math.random() * 0.35))
    }
  }

  return group
}

// The island itself: a bigger, differently-shaped landmass than the round
// home island, plus every biome piece above assembled onto it. Sits far
// out in open water (see SURVIVAL_ISLAND_CENTER) so it never crowds the
// normal dock/boat scenery.
function buildSurvivalIsland(center) {
  const group = new THREE.Group()

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xdec27a, flatShading: true })
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a9d4f, flatShading: true })
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x357a3a, flatShading: true })

  // Top pinned at the same y=0.2 every other feature here is built
  // relative to; stretched deep underneath instead so that once the whole
  // group is lifted by SHORE_LIFT below, the beach clears the highest wave
  // crest and the base still vanishes below the lowest trough.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(24, 27, 3, 18), sandMat)
  base.scale.set(1, 1, 1.4)
  base.position.y = -1.3
  base.receiveShadow = true
  group.add(base)

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(20, 23, 0.6, 18), grassMat)
  grass.scale.set(1, 1, 1.4)
  grass.position.set(0, 0.2, -3)
  grass.receiveShadow = true
  group.add(grass)

  // Rising foothill toward the mountain at the north end, so the terrain
  // isn't perfectly flat everywhere.
  const foothill = new THREE.Mesh(new THREE.CylinderGeometry(13, 17, 2.6, 14), hillMat)
  foothill.position.set(1, 0.7, -20)
  foothill.receiveShadow = true
  foothill.castShadow = true
  group.add(foothill)

  group.add(buildMountain(0, -26))
  group.add(buildCave(2, -15))
  group.add(buildForest(-16, 2))
  group.add(buildLake(16, 5))
  group.add(buildRiver([[3, -18], [5, -8], [2, 2], [4, 12], [3, 21]]))

  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 18 + Math.random() * 5
    group.add(lowPolyRock(Math.cos(a) * r, 16 + Math.sin(a) * 5, 0.4 + Math.random() * 0.5))
  }

  // Lifted clear of the waterline — see SHORE_LIFT.
  group.position.set(center.x, SHORE_LIFT, center.z)
  return group
}

function buildDock() {
  const group = new THREE.Group()
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, flatShading: true, roughness: 0.9 })
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, flatShading: true })

  // The deck (platform + pier + planks) sits at the same lifted height as
  // every other walkable surface (see SHORE_LIFT) so waves never wash over
  // it; unlike island(), this group can't just be lifted wholesale since
  // the support posts and tied-up boat below deliberately stay down at the
  // water line — those are sized/positioned individually below instead.
  const DECK_Y = SHORE_LIFT + 0.2

  // Main platform (where the player stands) + a long pier.
  const platform = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 6), woodMat)
  platform.position.set(0, DECK_Y, 6)
  platform.castShadow = true
  platform.receiveShadow = true
  group.add(platform)

  const pierLength = 16
  const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, pierLength), woodMat)
  pier.position.set(0, DECK_Y, 6 + 3 + pierLength / 2)
  pier.castShadow = true
  pier.receiveShadow = true
  group.add(pier)

  // Plank grooves for a bit of visual texture.
  for (let i = -2; i <= pierLength / 2; i += 1.2) {
    const plankLine = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.02, 0.06), postMat)
    plankLine.position.set(0, DECK_Y + 0.19, 6 + 3 + i)
    group.add(plankLine)
  }

  // Support posts under the pier — stretched to still reach from the
  // (now higher) pier underside down to well below the waterline.
  for (let i = -1; i <= pierLength - 2; i += 4) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2 + SHORE_LIFT, 6), postMat)
      post.position.set(side * 1.1, -0.9 + SHORE_LIFT / 2, 6 + 3 + i)
      post.castShadow = true
      group.add(post)
    }
  }

  // A simple low-poly rowboat tied at the end of the pier for atmosphere.
  const boat = new THREE.Group()
  const hullMat = new THREE.MeshStandardMaterial({ color: DEFAULT_BOAT_COLOR, flatShading: true })
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.5, 6, 1, false), hullMat)
  hull.rotation.z = Math.PI / 2
  hull.scale.set(1, 1, 1.8)
  hull.position.y = 0.1
  boat.add(hull)
  boat.position.set(2.6, 0.15, 6 + 3 + pierLength - 1)
  boat.rotation.y = 0.3
  group.add(boat)

  return { group, hullMat }
}

export function buildEnvironment(scene) {
  // Sky gradient via fog + background color.
  scene.background = new THREE.Color(0x9fd8e8)
  scene.fog = new THREE.Fog(0x9fd8e8, 40, 180)

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x2a5a3a, 0.9)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xfff2d0, 1.1)
  sun.position.set(30, 40, -20)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -50
  sun.shadow.camera.right = 50
  sun.shadow.camera.top = 50
  sun.shadow.camera.bottom = -50
  sun.shadow.camera.far = 150
  sun.shadow.bias = -0.001
  scene.add(sun)

  // Flat fill light so surfaces facing away from the sun (shadowed dock
  // underside, island slopes, etc.) never render as pure black.
  const ambient = new THREE.AmbientLight(0xffffff, 0.55)
  scene.add(ambient)

  const { group: dock, hullMat: boatHullMat } = buildDock()
  scene.add(dock)

  // Home island the dock is attached to. Trees are kept away from the
  // +z wedge (angle ~90°) where the dock/pier and player stand.
  const homeIsland = island(0, 3, 7, { avoidAngleRange: [0.3, Math.PI - 0.3] })
  scene.add(homeIsland)

  // Survival island (Sub-tahap Survival-B) — a separate, bigger, biome-
  // varied landmass out in open water. Not connected to the dock at all;
  // Survival mode teleports the player straight there (see main.js's
  // startSurvival()).
  scene.add(buildSurvivalIsland(SURVIVAL_ISLAND_CENTER))

  // A scattering of distant islands + rocks for horizon interest.
  const decor = new THREE.Group()
  const positions = [
    [-30, -40], [45, -25], [-55, 20], [60, 35], [-20, -70], [35, 60],
  ]
  positions.forEach(([x, z]) => decor.add(island(x, z, 4 + Math.random() * 5)))
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 25 + Math.random() * 15
    decor.add(lowPolyRock(Math.cos(a) * r + 0, Math.sin(a) * r + 20, 1 + Math.random()))
  }
  scene.add(decor)

  // Handed back so the day/night cycle can drive these over time, and so
  // the boat skin store item can recolor the hull.
  return { dock, sun, hemi, ambient, boatHullMat }
}

// World-space spot the little rowboat is tied at (see buildDock above) and
// where the player boards it from the pier.
export const BOAT_DOCK_POSITION = { x: 2.6, z: 24 }
// Where the player ends up back on the pier after disembarking.
export const PIER_RETURN_POSITION = { x: 0, z: 20 }

// Survival island (Sub-tahap Survival-B) — a bigger, separate landmass out
// in open water (see buildSurvivalIsland above), well clear of the home
// island/dock and the scattered horizon-decor islands below.
export const SURVIVAL_ISLAND_CENTER = { x: -95, z: -95 }
// Each of these is island-LOCAL offset + SURVIVAL_ISLAND_CENTER, matching
// where buildSurvivalIsland actually placed that feature.
export const SURVIVAL_CAVE_POSITION = { x: SURVIVAL_ISLAND_CENTER.x + 2, z: SURVIVAL_ISLAND_CENTER.z - 15 }
export const SURVIVAL_LAKE_POSITION = { x: SURVIVAL_ISLAND_CENTER.x + 16, z: SURVIVAL_ISLAND_CENTER.z + 5 }
export const SURVIVAL_RIVER_POSITION = { x: SURVIVAL_ISLAND_CENTER.x + 3, z: SURVIVAL_ISLAND_CENTER.z + 7 }
// Where a stranded player starts out — on the south beach, facing inland
// toward the forest/river/mountain rather than straight out to open water.
export const SURVIVAL_SPAWN_POSITION = { x: SURVIVAL_ISLAND_CENTER.x, z: SURVIVAL_ISLAND_CENTER.z + 20 }
// The box the player is actually allowed to roam within during Survival
// (see player.js's setMode) — this IS the walkable island footprint as far
// as the game is concerned, so coast-detection below is defined relative to
// this box's edges rather than a separately-eyeballed ellipse (the two used
// to disagree, which made the spawn point read as "inland" and the far
// mountain interior read as "coastal").
export const SURVIVAL_ISLAND_BOUNDS = {
  minX: SURVIVAL_ISLAND_CENTER.x - 26,
  maxX: SURVIVAL_ISLAND_CENTER.x + 24,
  minZ: SURVIVAL_ISLAND_CENTER.z - 34,
  maxZ: SURVIVAL_ISLAND_CENTER.z + 26,
}
// Beyond this distance from the home island, the water counts as "open
// sea" — better odds at rare fish, and a couple of species that only turn
// up out there.
export const OPEN_SEA_RADIUS = 55

// Approximate ground elevation on the survival island's raised terrain
// (foothill + mountain) — there's no real 3D collision anywhere in this
// game (see player.js's *_BOUNDS boxes), so this is a height LOOKUP the
// camera follows as you walk around, matching buildSurvivalIsland's actual
// foothill/mountain footprints closely enough to feel like a real slope
// instead of the camera staying flat while the ground visibly rises
// beneath it. Returns height ABOVE the island's own flat ground (add
// SHORE_LIFT for a world-space Y — see player.js).
function radialBump(px, pz, cx, cz, innerR, outerR, height) {
  const d = Math.hypot(px - cx, pz - cz)
  if (d >= outerR) return 0
  if (d <= innerR) return height
  const t = 1 - (d - innerR) / (outerR - innerR)
  return height * (t * t * (3 - 2 * t)) // smoothstep — a natural-feeling rise
}

export function getSurvivalGroundHeight(worldX, worldZ) {
  const lx = worldX - SURVIVAL_ISLAND_CENTER.x
  const lz = worldZ - SURVIVAL_ISLAND_CENTER.z
  const foothill = radialBump(lx, lz, 1, -20, 8, 17, 2.1)
  const mountain = radialBump(lx, lz, 0, -26, 3, 11, 9)
  return Math.max(foothill, mountain)
}

// True once you're close enough to the walkable island's edge (within
// COAST_MARGIN of the SURVIVAL_ISLAND_BOUNDS box) to cast a line into the
// open sea — measured as distance to the nearest bounds edge rather than an
// ellipse, since SURVIVAL_ISLAND_BOUNDS box IS the walkable area the player
// actually moves within (see player.js). Used together with the river/lake
// proximity checks (main.js) to gate fishing/casting to "actually near
// water" during Survival.
const COAST_MARGIN = 6
export function isNearSurvivalCoast(worldX, worldZ) {
  const b = SURVIVAL_ISLAND_BOUNDS
  const distToEdge = Math.min(worldX - b.minX, b.maxX - worldX, worldZ - b.minZ, b.maxZ - worldZ)
  return distToEdge <= COAST_MARGIN
}
