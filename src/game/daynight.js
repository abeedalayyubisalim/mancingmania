import * as THREE from 'three'
import { setRainSound } from '../audio.js'

// A full day/night cycle (default 10 real minutes per full day) driving
// sky/fog color, sun position/color/intensity, and ambient lighting — plus
// a simple weather system (clear/rain) that periodically toggles, complete
// with a following rain particle effect and a rain ambience sound. Both
// tie back into gameplay: fish bite a little faster in the rain, and the
// legendary golden fish is a bit more likely to turn up at night.
const CYCLE_SECONDS = 600

const SKY_DAY = new THREE.Color(0x9fd8e8)
const SKY_SUNSET = new THREE.Color(0xf2a765)
const SKY_NIGHT = new THREE.Color(0x0b1830)
const FOG_DAY = new THREE.Color(0x9fd8e8)
const FOG_SUNSET = new THREE.Color(0xe08a52)
const FOG_NIGHT = new THREE.Color(0x0b1830)
const SUN_DAY = new THREE.Color(0xfff2d0)
const SUN_SUNSET = new THREE.Color(0xff9a52)
const SUN_NIGHT = new THREE.Color(0x496fb0)

function smooth01(x) {
  const t = THREE.MathUtils.clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

export class DayNightCycle {
  constructor({ scene, sun, hemi, ambient, camera }) {
    this.scene = scene
    this.sun = sun
    this.hemi = hemi
    this.ambient = ambient
    this.camera = camera
    this.elapsed = CYCLE_SECONDS * 0.3 // start mid-morning, not at midnight
    this.weather = 'clear'
    this._weatherTimer = 45 + Math.random() * 60
    this._baseFogNear = scene.fog.near
    this._baseFogFar = scene.fog.far
    this._buildRain()
  }

  _buildRain() {
    const COUNT = 500
    const positions = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = Math.random() * 20 - 4
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xaad0ee,
      size: 0.09,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.rainPoints = new THREE.Points(geo, mat)
    this.rainPoints.visible = false
    // Follows the camera so it always surrounds the player without needing
    // to track world position separately.
    this.camera.add(this.rainPoints)
  }

  _updateRain(dt) {
    if (this.weather !== 'rain') return
    const pos = this.rainPoints.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      let y = pos.array[i * 3 + 1] - dt * 14
      if (y < -4) y = 16
      pos.array[i * 3 + 1] = y
    }
    pos.needsUpdate = true
  }

  _updateWeather(dt) {
    this._weatherTimer -= dt
    if (this._weatherTimer > 0) return
    if (this.weather === 'clear') {
      // ~35% chance to start raining each time the timer rolls over.
      if (Math.random() < 0.35) this._setWeather('rain')
      this._weatherTimer = 60 + Math.random() * 90
    } else {
      this._setWeather('clear')
      this._weatherTimer = 90 + Math.random() * 120
    }
  }

  _setWeather(weather) {
    this.weather = weather
    this.rainPoints.visible = weather === 'rain'
    setRainSound(weather === 'rain')
  }

  update(dt) {
    this.elapsed += dt
    const t = (this.elapsed % CYCLE_SECONDS) / CYCLE_SECONDS
    // -1 at midnight, +1 at noon, 0 at sunrise/sunset.
    const sunHeight = -Math.cos(t * Math.PI * 2)
    this._sunHeight = sunHeight
    this._t = t

    const dayMix = smooth01((sunHeight + 0.15) / 0.5) // 0 at/below horizon-ish, 1 once well up
    const sunsetMix = 1 - Math.abs(THREE.MathUtils.clamp(sunHeight, -1, 1)) // peaks near the horizon

    const sky = SKY_NIGHT.clone().lerp(SKY_DAY, dayMix).lerp(SKY_SUNSET, sunsetMix * 0.55)
    const fog = FOG_NIGHT.clone().lerp(FOG_DAY, dayMix).lerp(FOG_SUNSET, sunsetMix * 0.55)
    const sunColor = SUN_NIGHT.clone().lerp(SUN_DAY, dayMix).lerp(SUN_SUNSET, sunsetMix * 0.6)

    this.scene.background = sky
    this.scene.fog.color.copy(fog)

    this.sun.color.copy(sunColor)
    this.sun.intensity = 0.15 + Math.max(0, sunHeight) * 1.0
    const angle = t * Math.PI * 2
    this.sun.position.set(Math.cos(angle) * 60, Math.max(6, sunHeight * 50 + 25), Math.sin(angle) * 60 - 20)

    this.hemi.intensity = 0.15 + dayMix * 0.75
    this.ambient.intensity = 0.12 + dayMix * 0.43

    this._updateWeather(dt)
    this._updateRain(dt)

    // Rain tightens visibility a bit and dims things further.
    const rainMix = this.weather === 'rain' ? 1 : 0
    this.scene.fog.near = THREE.MathUtils.lerp(this._baseFogNear, this._baseFogNear * 0.5, rainMix)
    this.scene.fog.far = THREE.MathUtils.lerp(this._baseFogFar, this._baseFogFar * 0.45, rainMix)
    if (rainMix > 0) {
      this.hemi.intensity *= 0.7
      this.ambient.intensity *= 0.75
    }
  }

  isNight() {
    return (this._sunHeight ?? 1) < -0.15
  }

  isRaining() {
    return this.weather === 'rain'
  }

  // Small gameplay tie-ins — folded into fishing.js's existing bonus math.
  getRainBiteBonus() {
    return this.isRaining() ? 0.18 : 0
  }

  getNightLegendaryBonus() {
    return this.isNight() ? 0.15 : 0
  }

  getLabel() {
    const t = this._t ?? 0.3
    let phase
    if (t < 0.22 || t > 0.9) phase = '🌙 Malam'
    else if (t < 0.3) phase = '🌅 Pagi'
    else if (t < 0.68) phase = '☀️ Siang'
    else if (t < 0.8) phase = '🌇 Sore'
    else phase = '🌆 Senja'
    return this.isRaining() ? `${phase} · 🌧️ Hujan` : phase
  }
}
