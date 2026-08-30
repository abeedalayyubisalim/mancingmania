// Small self-contained synth — every sound effect and the background
// ambience are generated on the fly with the Web Audio API, so the game
// needs zero external audio files. Volumes/mute are persisted via
// settings.js.
import { settings, saveSettings } from './settings.js'

let ctx = null
let masterGain = null
let sfxGain = null
let musicGain = null
let musicNodes = null

function ensureContext() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()

  masterGain = ctx.createGain()
  masterGain.gain.value = 1
  masterGain.connect(ctx.destination)

  sfxGain = ctx.createGain()
  sfxGain.gain.value = settings.sfxVolume
  sfxGain.connect(masterGain)

  musicGain = ctx.createGain()
  musicGain.gain.value = settings.musicVolume
  musicGain.connect(masterGain)

  return ctx
}

// Browsers won't let audio play until a real user gesture has happened.
// Call this from the first click/tap in the game (it's safe to call many
// times — after the first successful resume it's a no-op).
export function unlockAudio() {
  const c = ensureContext()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  startMusic()
}

export function setSfxVolume(v) {
  settings.sfxVolume = v
  saveSettings()
  if (sfxGain) sfxGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
}

export function setMusicVolume(v) {
  settings.musicVolume = v
  saveSettings()
  if (musicGain) musicGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
}

// ---------------------------------------------------------------------------
// Low-level synth helpers
// ---------------------------------------------------------------------------

function tone(freq, { start = 0, duration = 0.2, type = 'sine', gain = 0.22, slideTo = null } = {}) {
  const c = ensureContext()
  if (!c) return
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g)
  g.connect(sfxGain)
  osc.start(t0)
  osc.stop(t0 + duration + 0.03)
}

function noiseBurst({ start = 0, duration = 0.3, gain = 0.15, filterFreq = 1200, filterType = 'lowpass' } = {}) {
  const c = ensureContext()
  if (!c) return
  const size = Math.max(1, Math.floor(c.sampleRate * duration))
  const buffer = c.createBuffer(1, size, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size)
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  const g = c.createGain()
  g.gain.value = gain
  src.connect(filter)
  filter.connect(g)
  g.connect(sfxGain)
  src.start(c.currentTime + start)
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

export function playCast() {
  tone(520, { duration: 0.22, type: 'sine', gain: 0.16, slideTo: 180 })
  noiseBurst({ start: 0.16, duration: 0.18, gain: 0.08, filterFreq: 2200 })
}

export function playBite() {
  tone(880, { duration: 0.1, type: 'square', gain: 0.18 })
  tone(880, { start: 0.14, duration: 0.1, type: 'square', gain: 0.18 })
}

export function playPatternHit() {
  tone(1100, { duration: 0.07, type: 'triangle', gain: 0.2 })
}

export function playPatternMiss() {
  tone(160, { duration: 0.16, type: 'sawtooth', gain: 0.14 })
}

export function playSplash() {
  noiseBurst({ duration: 0.35, gain: 0.14, filterFreq: 900 })
}

export function playEscape() {
  tone(420, { duration: 0.3, type: 'sine', gain: 0.16, slideTo: 120 })
}

export function playCatch(fish) {
  if (fish?.junk) {
    tone(220, { duration: 0.18, type: 'triangle', gain: 0.14 })
    tone(160, { start: 0.1, duration: 0.22, type: 'triangle', gain: 0.14 })
    return
  }
  if (fish?.tier === 'legendary') {
    // A little sparkly fanfare for the rarest catch in the game.
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { start: i * 0.09, duration: 0.35, type: 'triangle', gain: 0.2 }))
    return
  }
  const bigCatch = fish?.tier === 'rare' || fish?.tier === 'very-rare'
  const notes = bigCatch ? [523, 659, 784, 1046] : [523, 659, 784]
  notes.forEach((f, i) => tone(f, { start: i * 0.075, duration: 0.22, type: 'sine', gain: 0.2 }))
}

export function playUIClick() {
  tone(700, { duration: 0.05, type: 'square', gain: 0.08 })
}

export function playPurchase() {
  tone(660, { duration: 0.1, type: 'square', gain: 0.16 })
  tone(990, { start: 0.09, duration: 0.16, type: 'square', gain: 0.18 })
}

export function playLevelUp() {
  ;[440, 554, 659, 880].forEach((f, i) => tone(f, { start: i * 0.08, duration: 0.28, type: 'sawtooth', gain: 0.16 }))
}

export function playAchievement() {
  ;[659, 880, 1108].forEach((f, i) => tone(f, { start: i * 0.09, duration: 0.3, type: 'triangle', gain: 0.2 }))
}

export function playDailyReward() {
  tone(784, { duration: 0.12, type: 'square', gain: 0.16 })
  tone(1046, { start: 0.1, duration: 0.2, type: 'square', gain: 0.18 })
}

// ---------------------------------------------------------------------------
// Ambient background "music" — a soft evolving pad plus a faint noise wash,
// standing in for waves. Loops forever once started; no scheduling of
// discrete notes needed so it can't drift or glitch over a long session.
// ---------------------------------------------------------------------------

function startMusic() {
  if (musicNodes || !ctx) return
  if (settings.musicMuted) return

  const now = ctx.currentTime
  const nodes = []

  // Two slightly-detuned low pads, a fifth apart, with a slow gain LFO so
  // the pad "breathes" instead of droning flatly.
  ;[110, 165].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = 0
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06 + i * 0.015
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.05
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    g.gain.setValueAtTime(0.05, now)
    osc.connect(g)
    g.connect(musicGain)
    osc.start(now)
    lfo.start(now)
    nodes.push(osc, lfo, g, lfoGain)
  })

  // Faint filtered noise wash standing in for distant waves.
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noiseSrc = ctx.createBufferSource()
  noiseSrc.buffer = buffer
  noiseSrc.loop = true
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'lowpass'
  noiseFilter.frequency.value = 500
  const noiseLfo = ctx.createOscillator()
  noiseLfo.frequency.value = 0.05
  const noiseLfoGain = ctx.createGain()
  noiseLfoGain.gain.value = 150
  noiseLfo.connect(noiseLfoGain)
  noiseLfoGain.connect(noiseFilter.frequency)
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.05
  noiseSrc.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(musicGain)
  noiseSrc.start(now)
  noiseLfo.start(now)
  nodes.push(noiseSrc, noiseLfo, noiseFilter, noiseGain, noiseLfoGain)

  musicNodes = nodes
}

function stopMusic() {
  if (!musicNodes) return
  for (const n of musicNodes) {
    try {
      if (n.stop) n.stop()
      n.disconnect()
    } catch {
      // Already stopped/disconnected — fine.
    }
  }
  musicNodes = null
}

export function setMusicMuted(muted) {
  settings.musicMuted = muted
  saveSettings()
  if (muted) stopMusic()
  else if (ctx) startMusic()
}

export function isMusicMuted() {
  return !!settings.musicMuted
}

// ---------------------------------------------------------------------------
// Rain ambience — a continuous filtered-noise loop, toggled on/off by the
// day/night cycle's weather system. Independent of the background pad music
// so it keeps playing (or not) regardless of the music mute setting.
// ---------------------------------------------------------------------------

let rainNodes = null

export function setRainSound(on) {
  const c = ensureContext()
  if (!c) return
  if (on && !rainNodes) {
    const bufferSize = c.sampleRate * 3
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3200
    filter.Q.value = 0.6
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(0.09, c.currentTime + 1.2)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(musicGain)
    src.start()
    rainNodes = { src, filter, gain }
  } else if (!on && rainNodes) {
    const { src, gain } = rainNodes
    gain.gain.setTargetAtTime(0, c.currentTime, 0.4)
    setTimeout(() => {
      try {
        src.stop()
        src.disconnect()
      } catch {
        // Already stopped — fine.
      }
    }, 1500)
    rainNodes = null
  }
}
