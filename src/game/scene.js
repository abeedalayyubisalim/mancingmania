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
  const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x59584f, flatShading: true })
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, flatShading: true })
  const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x18181a, flatShading: true })

  // An irregular cluster of overlapping boulders forming a rocky hillside
  // (instead of one single rock mound), so the entrance reads as built INTO
  // a slope rather than floating on top of a lone rock ball.
  const boulders = [
    [-1.8, -0.6, 1.7, 1.7, 1.15, 1.4, rockMat],
    [1.9, -0.3, 2.1, 1.5, 1.3, 1.3, rockMat2],
    [0.1, -1.7, 2.7, 1.55, 1.0, 1.2, rockMat],
    [-0.7, 0.8, 1.15, 1.35, 0.8, 1.0, rockMat2],
    [2.6, 1.3, 1.4, 1.1, 0.9, 1.1, rockMat],
  ]
  for (const [dx, dz, y, sx, sy, sz, mat] of boulders) {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mat)
    b.position.set(dx, y, dz)
    b.scale.set(sx * 1.4, sy * 1.4, sz * 1.4)
    b.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2)
    b.castShadow = true
    b.receiveShadow = true
    group.add(b)
  }

  // Recessed entrance with real depth — a dark tunnel block set back behind
  // a rounded doorway, instead of just a flat painted circle on a rock face.
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 3.2), tunnelMat)
  tunnel.position.set(0, 1.35, 0.3)
  group.add(tunnel)

  const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), mouthMat)
  mouth.position.set(0, 1.3, 1.85)
  group.add(mouth)

  // A brow of rock overhanging the entrance.
  const brow = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), rockMat2)
  brow.position.set(0, 2.9, 1.2)
  brow.scale.set(1.8, 0.7, 1.1)
  brow.castShadow = true
  group.add(brow)

  for (const [dx, dz, s] of [
    [-2.6, 1.6, 0.8],
    [2.8, 1.2, 0.9],
    [0.6, 2.6, 0.55],
    [-1.4, 2.4, 0.5],
    [1.6, -1.4, 0.65],
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
  const rockMat3 = new THREE.MeshStandardMaterial({ color: 0x5f5b52, flatShading: true })
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f1f6, flatShading: true })
  const scrubMat = new THREE.MeshStandardMaterial({ color: 0x5a7a4a, flatShading: true })

  // Wide scrubby talus skirt blending the rock face into the surrounding
  // grass, and four offset cone stages (instead of a perfectly centered
  // stack) so the silhouette reads as an irregular peak rather than a
  // single traffic-cone shape.
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(15, 5, 11), scrubMat)
  skirt.position.set(0, 2.2, 0)
  skirt.castShadow = true
  skirt.receiveShadow = true
  group.add(skirt)

  const base = new THREE.Mesh(new THREE.ConeGeometry(14, 17, 11), rockMat)
  base.position.set(-0.8, 8, 0.6)
  base.castShadow = true
  base.receiveShadow = true
  group.add(base)

  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(10, 10, 10), rockMat3)
  shoulder.position.set(1, 14, -1)
  shoulder.castShadow = true
  group.add(shoulder)

  const mid = new THREE.Mesh(new THREE.ConeGeometry(7, 9, 9), rockMat2)
  mid.position.set(0.6, 19, -0.6)
  mid.castShadow = true
  group.add(mid)

  const peak = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5.5, 8), snowMat)
  peak.position.set(1, 25, -1)
  peak.castShadow = true
  group.add(peak)

  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 13 + Math.random() * 6
    group.add(lowPolyRock(Math.cos(a) * r, Math.sin(a) * r, 0.6 + Math.random() * 0.7))
  }

  group.position.set(x, 0, z)
  return group
}

function buildForest(x, z, spread = 20) {
  const group = new THREE.Group()
  const undergrowthMat = new THREE.MeshStandardMaterial({ color: 0x3c7a42, flatShading: true })

  for (let i = 0; i < 20; i++) {
    const dx = (Math.random() - 0.5) * spread
    const dz = (Math.random() - 0.5) * spread
    group.add(lowPolyTree(dx, dz))
  }
  for (let i = 0; i < 8; i++) {
    const dx = (Math.random() - 0.5) * spread
    const dz = (Math.random() - 0.5) * spread
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.3, 0), undergrowthMat)
    bush.position.set(dx, 0.3, dz)
    bush.castShadow = true
    group.add(bush)
  }
  for (let i = 0; i < 5; i++) {
    const dx = (Math.random() - 0.5) * spread
    const dz = (Math.random() - 0.5) * spread
    group.add(lowPolyRock(dx, dz, 0.35 + Math.random() * 0.4))
  }

  group.position.set(x, 0, z)
  return group
}

// The island's own flat "grass" terrain sits at local y=0.5 (see
// buildSurvivalIsland's grass cylinder: 0.6 tall, centered at y=0.2) and is
// a single unbroken disc — there's no hole cut out of it for the lake/river
// (that would need real hole-cut geometry, not just stacked primitives).
// That matters twice over here:
//  1. Anything positioned BELOW y=0.5 anywhere within the grass disc's
//     footprint sits underneath that solid surface and is hidden by it —
//     why the very first flat "pool" plane (and an early sunken-basin
//     redesign) both rendered as invisible from almost every angle.
//  2. Even once every layer is moved above y=0.5, a design where the water
//     sits LOWER than a surrounding rim/bank has the same problem in
//     miniature: from typical first-person eye height just outside the
//     lake, the near side of that raised rim blocks the sightline down to
//     the (shorter) water behind it — a crater viewed from ground level.
// So instead of a basin OR a walled rim, this builds a gentle MOUND that
// keeps rising toward the middle — bank, then water, then a deeper-blue
// center accent, each a little taller than the last — so nothing is ever
// hidden behind something shorter in front of it, from any angle.
const GRASS_TOP = 0.5
function buildLake(x, z, radius = 7) {
  const group = new THREE.Group()
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xcbb27a, flatShading: true })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3f9fce,
    flatShading: true,
    roughness: 0.35,
    transparent: true,
    opacity: 0.92,
  })
  const deepMat = new THREE.MeshStandardMaterial({
    color: 0x27678f,
    flatShading: true,
    roughness: 0.3,
    transparent: true,
    opacity: 0.95,
  })

  const bank = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.1, radius * 1.4, 0.16, 24), bankMat)
  bank.position.y = GRASS_TOP + 0.11
  bank.receiveShadow = true
  bank.castShadow = true
  group.add(bank)

  const water = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 1.15, 0.14, 24), waterMat)
  water.position.y = GRASS_TOP + 0.24
  group.add(water)

  const deep = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.35, radius * 0.35, 0.12, 20), deepMat)
  deep.position.y = GRASS_TOP + 0.29
  group.add(deep)

  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2
    const r = radius * (1.15 + Math.random() * 0.35)
    group.add(lowPolyRock(Math.cos(a) * r, Math.sin(a) * r, 0.35 + Math.random() * 0.45))
  }

  group.position.set(x, 0, z)
  return group
}

// A winding channel strung between waypoints (island-local x/z pairs) —
// same gently-rising-toward-the-water-not-a-basin approach as buildLake
// above (see its comment): a sandy bank strip, with the water sitting a
// little TALLER than it down the middle, so the bank never blocks the view
// of the water from the side the way a taller outer rim would.
function buildRiver(points, width = 3.2) {
  const group = new THREE.Group()
  const bankMat = new THREE.MeshStandardMaterial({ color: 0xcbb27a, flatShading: true })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3f9fce,
    flatShading: true,
    roughness: 0.4,
    transparent: true,
    opacity: 0.88,
  })

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[i + 1]
    const dx = x2 - x1
    const dz = z2 - z1
    const len = Math.hypot(dx, dz)
    const angle = Math.atan2(dx, dz)
    const cx = (x1 + x2) / 2
    const cz = (z1 + z2) / 2

    const bank = new THREE.Mesh(new THREE.BoxGeometry(width + 2.2, 0.16, len + 0.6), bankMat)
    bank.position.set(cx, GRASS_TOP + 0.11, cz)
    bank.rotation.y = angle
    bank.receiveShadow = true
    bank.castShadow = true
    group.add(bank)

    const water = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, len + 0.6), waterMat)
    water.position.set(cx, GRASS_TOP + 0.25, cz)
    water.rotation.y = angle
    group.add(water)
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
  const base = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 3, 20), sandMat)
  base.scale.set(1, 1, 1.4)
  base.position.y = -1.3
  base.receiveShadow = true
  group.add(base)

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(28, 32, 0.6, 20), grassMat)
  grass.scale.set(1, 1, 1.4)
  grass.position.set(0, 0.2, -3)
  grass.receiveShadow = true
  group.add(grass)

  // Rising foothill toward the mountain at the north end, so the terrain
  // isn't perfectly flat everywhere.
  const foothill = new THREE.Mesh(new THREE.CylinderGeometry(18, 24, 3.2, 16), hillMat)
  foothill.position.set(1, 0.9, -28)
  foothill.receiveShadow = true
  foothill.castShadow = true
  group.add(foothill)

  group.add(buildMountain(0, -36))
  group.add(buildCave(3, -21))
  group.add(buildForest(-22, 3, 26))
  group.add(buildLake(22, 7))
  group.add(buildRiver([[4, -25], [7, -11], [3, 3], [6, 17], [4, 29]]))

  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 25 + Math.random() * 6
    group.add(lowPolyRock(Math.cos(a) * r, 22 + Math.sin(a) * 6, 0.4 + Math.random() * 0.5))
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
export const SURVIVAL_CAVE_POSITION = { x: SURVIVAL_ISLAND_CENTER.x + 3, z: SURVIVAL_ISLAND_CENTER.z - 21 }
export const SURVIVAL_LAKE_POSITION = { x: SURVIVAL_ISLAND_CENTER.x + 22, z: SURVIVAL_ISLAND_CENTER.z + 7 }
// The middle bend of the river's waypoint path (see buildRiver's call in
// buildSurvivalIsland) — the single representative point main.js measures
// "am I near the river" proximity against.
export const SURVIVAL_RIVER_POSITION = { x: SURVIVAL_ISLAND_CENTER.x + 5, z: SURVIVAL_ISLAND_CENTER.z + 10 }
// Where a stranded player starts out — on the south beach, facing inland
// toward the forest/river/mountain rather than straight out to open water.
export const SURVIVAL_SPAWN_POSITION = { x: SURVIVAL_ISLAND_CENTER.x, z: SURVIVAL_ISLAND_CENTER.z + 30 }
// The box the player is actually allowed to roam within during Survival
// (see player.js's setMode) — this IS the walkable island footprint as far
// as the game is concerned, so coast-detection below is defined relative to
// this box's edges rather than a separately-eyeballed ellipse (the two used
// to disagree, which made the spawn point read as "inland" and the far
// mountain interior read as "coastal").
export const SURVIVAL_ISLAND_BOUNDS = {
  minX: SURVIVAL_ISLAND_CENTER.x - 36,
  maxX: SURVIVAL_ISLAND_CENTER.x + 34,
  minZ: SURVIVAL_ISLAND_CENTER.z - 48,
  maxZ: SURVIVAL_ISLAND_CENTER.z + 36,
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
  const foothill = radialBump(lx, lz, 1, -28, 11, 24, 2.6)
  const mountain = radialBump(lx, lz, 0, -36, 6, 20, 13)
  return Math.max(foothill, mountain)
}

// True once you're close enough to the walkable island's edge (within
// COAST_MARGIN of the SURVIVAL_ISLAND_BOUNDS box) to cast a line into the
// open sea — measured as distance to the nearest bounds edge rather than an
// ellipse, since SURVIVAL_ISLAND_BOUNDS box IS the walkable area the player
// actually moves within (see player.js). Used together with the river/lake
// proximity checks (main.js) to gate fishing/casting to "actually near
// water" during Survival.
const COAST_MARGIN = 7
export function isNearSurvivalCoast(worldX, worldZ) {
  const b = SURVIVAL_ISLAND_BOUNDS
  const distToEdge = Math.min(worldX - b.minX, b.maxX - worldX, worldZ - b.minZ, b.maxZ - worldZ)
  return distToEdge <= COAST_MARGIN
}
