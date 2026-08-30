import * as THREE from 'three'

// A small low-poly humanoid, matching the flat-shaded style used
// everywhere else in the game (dock, boat, trees, rocks). This is the
// model other players will see representing you in multiplayer (Sub-tahap
// C) — your own view stays first-person-only, you never see your own
// body. Also reused right now for the rotating preview on the Profile
// screen, so cosmetics/skins are visible before multiplayer exists at all.
const SKIN_COLOR = 0xe0ac7a
const SHIRT_COLOR = 0x4a7fb0
const PANTS_COLOR = 0x2b2f38
const HAT_COLOR = 0xd9b45a
const VEST_COLOR = 0xd97a3a

// Overall standing height, used by callers to frame a camera around it.
export const CHARACTER_HEIGHT = 1.75

export function buildCharacterAvatar({ hat = false, vest = false, rodColor = 0x3b2a1a } = {}) {
  const group = new THREE.Group()

  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, flatShading: true })
  const shirtMat = new THREE.MeshStandardMaterial({ color: SHIRT_COLOR, flatShading: true })
  const pantsMat = new THREE.MeshStandardMaterial({ color: PANTS_COLOR, flatShading: true })
  const rodMat = new THREE.MeshStandardMaterial({ color: rodColor, flatShading: true })
  const reelMat = new THREE.MeshStandardMaterial({ color: 0x999999, flatShading: true, metalness: 0.6, roughness: 0.4 })

  // Legs.
  const legGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.75, 6)
  const legL = new THREE.Mesh(legGeo, pantsMat)
  legL.position.set(-0.12, 0.375, 0)
  const legR = new THREE.Mesh(legGeo, pantsMat)
  legR.position.set(0.12, 0.375, 0)
  group.add(legL, legR)

  // Torso.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.26), shirtMat)
  torso.position.set(0, 1.05, 0)
  group.add(torso)

  // Arms.
  const armGeo = new THREE.CylinderGeometry(0.075, 0.07, 0.55, 6)
  const armL = new THREE.Mesh(armGeo, skinMat)
  armL.position.set(-0.29, 0.98, 0)
  armL.rotation.z = 0.15
  const armR = new THREE.Mesh(armGeo, skinMat)
  armR.position.set(0.29, 0.98, 0)
  armR.rotation.z = -0.55 // angled forward/down, as if holding a rod
  group.add(armL, armR)

  // Head.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 7), skinMat)
  head.position.set(0, 1.56, 0)
  group.add(head)

  // Optional vest cosmetic — a slightly larger overlay box on the torso.
  const vestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: VEST_COLOR, flatShading: true }))
  vestMesh.position.set(0, 1.15, 0)
  vestMesh.visible = vest
  group.add(vestMesh)

  // Optional hat cosmetic — a simple cap on top of the head.
  const hatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.12, 8), new THREE.MeshStandardMaterial({ color: HAT_COLOR, flatShading: true }))
  hatMesh.position.set(0, 1.72, 0)
  hatMesh.visible = hat
  group.add(hatMesh)

  // Held fishing rod — same shapes as the first-person viewmodel, scaled
  // to look right from outside, angled out from the right hand.
  const rodGroup = new THREE.Group()
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xe0ac7a, flatShading: true }))
  handle.position.set(0, -0.11, 0)
  rodGroup.add(handle)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 1.1, 6), rodMat)
  shaft.position.set(0, 0.44, 0)
  rodGroup.add(shaft)
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.045, 8), reelMat)
  reel.rotation.x = Math.PI / 2
  reel.position.set(0, -0.03, 0.04)
  rodGroup.add(reel)
  rodGroup.position.set(0.38, 0.65, 0.12)
  rodGroup.rotation.set(-0.2, 0, -0.75)
  group.add(rodGroup)

  return {
    group,
    // Swaps the rod's color to whatever skin is currently equipped (or
    // the default) — same idea as Player.applyRodSkin() for the FPS
    // viewmodel.
    setRodColor(hex) {
      rodMat.color.setHex(hex)
    },
    setCosmetics({ hat: h, vest: v }) {
      hatMesh.visible = Boolean(h)
      vestMesh.visible = Boolean(v)
    },
  }
}
