import * as THREE from 'three'

// Builds a simple low-poly fish mesh (body cone/octahedron + tail) from a
// fish-data entry, used both for the catch-popup preview and future use.
export function buildFishMesh(fish) {
  const group = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: fish.color, flatShading: true })

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(fish.size * 0.5, 0), mat)
  body.scale.set(1.6, 0.9, 1)
  group.add(body)

  const tail = new THREE.Mesh(new THREE.ConeGeometry(fish.size * 0.4, fish.size * 0.6, 4), mat)
  tail.rotation.z = Math.PI / 2
  tail.position.x = -fish.size * 0.85
  group.add(tail)

  return group
}
