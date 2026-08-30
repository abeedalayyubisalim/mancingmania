import * as THREE from 'three'

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
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, 1, 10), sandMat)
  sand.position.y = -0.3
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

  group.position.set(x, 0, z)
  return group
}

function buildDock() {
  const group = new THREE.Group()
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, flatShading: true, roughness: 0.9 })
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, flatShading: true })

  // Main platform (where the player stands) + a long pier.
  const platform = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 6), woodMat)
  platform.position.set(0, 0.2, 6)
  platform.castShadow = true
  platform.receiveShadow = true
  group.add(platform)

  const pierLength = 16
  const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, pierLength), woodMat)
  pier.position.set(0, 0.2, 6 + 3 + pierLength / 2)
  pier.castShadow = true
  pier.receiveShadow = true
  group.add(pier)

  // Plank grooves for a bit of visual texture.
  for (let i = -2; i <= pierLength / 2; i += 1.2) {
    const plankLine = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.02, 0.06), postMat)
    plankLine.position.set(0, 0.39, 6 + 3 + i)
    group.add(plankLine)
  }

  // Support posts under the pier.
  for (let i = -1; i <= pierLength - 2; i += 4) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), postMat)
      post.position.set(side * 1.1, -0.9, 6 + 3 + i)
      post.castShadow = true
      group.add(post)
    }
  }

  // A simple low-poly rowboat tied at the end of the pier for atmosphere.
  const boat = new THREE.Group()
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xb5432c, flatShading: true })
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.5, 6, 1, false), hullMat)
  hull.rotation.z = Math.PI / 2
  hull.scale.set(1, 1, 1.8)
  hull.position.y = 0.1
  boat.add(hull)
  boat.position.set(2.6, 0.15, 6 + 3 + pierLength - 1)
  boat.rotation.y = 0.3
  group.add(boat)

  return group
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
  scene.add(sun)

  const dock = buildDock()
  scene.add(dock)

  // Home island the dock is attached to. Trees are kept away from the
  // +z wedge (angle ~90°) where the dock/pier and player stand.
  const homeIsland = island(0, 3, 7, { avoidAngleRange: [0.3, Math.PI - 0.3] })
  scene.add(homeIsland)

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

  return { dock }
}
