import * as THREE from 'three'

// A big low-poly water plane whose vertices bob up and down with
// layered sine waves — cheap, and gives that faceted low-poly look.
export class Water {
  constructor() {
    const size = 400
    const segments = 80
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    geometry.rotateX(-Math.PI / 2)

    this.basePositions = geometry.attributes.position.array.slice()

    const material = new THREE.MeshStandardMaterial({
      color: 0x1c6fa5,
      flatShading: true,
      roughness: 0.65,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.receiveShadow = true
  }

  // Water height at a given world x/z — used to float the bobber & fish.
  heightAt(x, z, t) {
    return (
      Math.sin(x * 0.08 + t * 1.1) * 0.5 +
      Math.cos(z * 0.11 + t * 0.8) * 0.4 +
      Math.sin((x + z) * 0.05 + t * 0.5) * 0.3
    )
  }

  update(t) {
    const pos = this.mesh.geometry.attributes.position
    const base = this.basePositions
    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3
      const x = base[ix]
      const z = base[ix + 2]
      pos.array[ix + 1] = this.heightAt(x, z, t)
    }
    pos.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }
}
