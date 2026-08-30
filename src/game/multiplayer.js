import * as THREE from 'three'
import { buildCharacterAvatar, CHARACTER_HEIGHT } from './character.js'
import { DEFAULT_ROD_COLOR } from './player.js'
import { joinRoomChannel, leaveRoomChannel, broadcastRoom, generateRoomCode } from '../social.js'
import { recordMatchHistory } from '../supabase-client.js'

// How often (seconds) we broadcast our own position/heading while a match
// is running. 1000/120 ≈ 8Hz — smooth enough once lerped on the receiving
// end, without hammering the channel.
const POS_SEND_INTERVAL = 0.12
// Rough vertical offset from "eye height" (what we broadcast, straight off
// the camera) down to "feet on the ground" (where the character model's
// origin sits) — see game/character.js. Not exact for every stance (boat
// eye height differs from dock), but close enough for a stylized low-poly
// game that nobody is going to pixel-peep the ankles of.
const AVATAR_EYE_OFFSET = 1.6

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// A billboard-ish name tag floating above a remote player's head — a
// canvas-textured sprite rather than an HTML overlay, so it lives in the
// same 3D space as everything else and needs no per-frame screen-space
// projection math to keep in sync.
function makeNameSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = Math.min(240, ctx.measureText(text).width + 28)
  roundRect(ctx, canvas.width / 2 - w / 2, 10, w, 44, 10)
  ctx.fillStyle = 'rgba(10, 20, 30, 0.6)'
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, canvas.width / 2, 33, 232)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
  sprite.scale.set(1.5, 0.375, 1)
  sprite.position.set(0, CHARACTER_HEIGHT + 0.35, 0)
  sprite.renderOrder = 999
  return sprite
}

function shortestAngleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ')

// Owns one multiplayer room end-to-end: creating/joining, the lobby roster,
// host-selected mode/params, the synced countdown, in-match position sync
// (rendering other players as characters — see game/character.js — moving
// around the same world), catch tallying, and win detection for both modes.
//
// There's deliberately no game server here — Supabase Realtime broadcast
// is the only transport, so the host's own client is the de-facto
// authority for the match timer and tie-breaking. That's a real (accepted)
// limitation: if the host disconnects mid-match, nothing ends the round for
// everyone else. Fine for a casual "play with friends" feature; would need
// real server authority to be cheat-proof or fully reliable.
export class MultiplayerSession {
  constructor({ scene, camera, identity, getCosmetics }) {
    this.scene = scene
    this.camera = camera
    this.identity = identity
    this.getCosmetics = getCosmetics ?? (() => ({}))

    this.inRoom = false
    this.roomCode = null
    this.isHost = false
    this.roster = []
    this.mode = null // 'time' | 'fish'
    this.params = null
    this.matchActive = false
    this.matchEnded = false
    this.remoteAvatars = new Map() // id -> { group, sprite, setRodColor, setCosmetics, target }
    this.catchLog = new Map() // id -> { name, avatar, points, catches: [{fishId,fishName,weight,points}] }
    this._posTimer = 0
    this._matchEndAt = null
    this._endTriggered = false
    this._reportedEnd = false
    this._mpInviteLoaded = false

    // Hooks the caller (main.js) wires up — kept as plain nullable fields
    // rather than an event emitter since each only ever has one listener.
    this.onRoomChange = null // () => void
    this.onCountdown = null // (secondsLeft) => void — 0 means "MULAI!"
    this.onMatchBegin = null // () => void
    this.onMatchTick = null // ({ secondsLeft } | { fishName }) => void
    this.onMatchEnd = null // ({ results, winnerId, mode }) => void
    this.onLeaveRoom = null // () => void
  }

  createRoom() {
    this.roomCode = generateRoomCode()
    this.isHost = true
    this._connect()
    return this.roomCode
  }

  joinRoom(code) {
    this.roomCode = code.trim().toUpperCase()
    this.isHost = false
    this._connect()
  }

  _connect() {
    this.inRoom = true
    joinRoomChannel(
      this.roomCode,
      { id: this.identity.id, username: this.identity.username, avatar: this.identity.avatar, cosmetics: this.getCosmetics(), isHost: this.isHost },
      {
        onPresence: (players) => this._handlePresence(players),
        onStart: (payload) => this._handleStart(payload),
        onPos: (payload) => this._handlePos(payload),
        onCatch: (payload) => this._handleCatch(payload),
        onEnd: (payload) => this._handleEnd(payload),
      }
    )
  }

  leaveRoom() {
    if (!this.inRoom) return
    leaveRoomChannel()
    this._clearAvatars()
    this.inRoom = false
    this.roomCode = null
    this.isHost = false
    this.roster = []
    this.mode = null
    this.params = null
    this.matchActive = false
    this.matchEnded = false
    this._endTriggered = false
    this._reportedEnd = false
    this.catchLog.clear()
    this.onLeaveRoom?.()
    this.onRoomChange?.()
  }

  // Host only — non-hosts have their selection dictated by the host and
  // just see it echoed at match start.
  setMode(mode, params) {
    if (!this.isHost) return
    this.mode = mode
    this.params = params
    this.onRoomChange?.()
  }

  // Host only — kicks off a synced countdown for everyone currently in the
  // room. `startAt` is an absolute timestamp so every client (whatever its
  // own clock drift/latency) converges on the same moment.
  startMatch() {
    if (!this.isHost || !this.mode) return
    broadcastRoom('start', { mode: this.mode, params: this.params, startAt: Date.now() + 3200 })
  }

  _handlePresence(players) {
    this.roster = players
    const liveIds = new Set(players.map((p) => p.id))
    for (const [id, av] of this.remoteAvatars) {
      if (!liveIds.has(id)) {
        this.scene.remove(av.group)
        this.remoteAvatars.delete(id)
      }
    }
    // A player who changed their equipped skin mid-match should show it
    // right away, same as the Profile preview does while they're online.
    for (const p of players) {
      const av = this.remoteAvatars.get(p.id)
      if (av) {
        av.setCosmetics({ hat: p.hat, vest: p.vest })
        av.setRodColor(p.rodColor ?? DEFAULT_ROD_COLOR)
      }
    }
    this.onRoomChange?.()
  }

  _handleStart({ mode, params, startAt }) {
    this.mode = mode
    this.params = params
    this.matchActive = false
    this.matchEnded = false
    this._endTriggered = false
    this._reportedEnd = false
    this.catchLog.clear()
    for (const p of this.roster)
      this.catchLog.set(p.id, { name: p.username ?? 'Pemain', avatar: p.avatar ?? null, points: 0, catches: [] })

    const step = () => {
      const msLeft = startAt - Date.now()
      if (msLeft <= 0) {
        this.onCountdown?.(0)
        setTimeout(() => {
          this.matchActive = true
          this._matchEndAt = this.mode === 'time' ? Date.now() + this.params.minutes * 60000 : null
          this.onMatchBegin?.()
        }, 450)
        return
      }
      this.onCountdown?.(Math.ceil(msLeft / 1000))
      setTimeout(step, 200)
    }
    step()
  }

  // Call from the Fishing onCatch callback — a no-op outside an active
  // match, or for junk (a boot doesn't count for anyone's score).
  registerCatch(fish) {
    if (!this.matchActive || this.matchEnded || fish.junk) return
    broadcastRoom('catch', {
      id: this.identity.id,
      name: this.identity.username,
      avatar: this.identity.avatar,
      fishId: fish.id,
      fishName: fish.name,
      weight: fish.weight,
      points: fish.points,
    })
  }

  _handleCatch(payload) {
    if (!this.matchActive || this.matchEnded) return
    const entry = this.catchLog.get(payload.id) ?? { name: payload.name ?? 'Pemain', avatar: payload.avatar ?? null, points: 0, catches: [] }
    entry.points += payload.points
    entry.catches.push({ fishId: payload.fishId, fishName: payload.fishName, weight: payload.weight, points: payload.points })
    entry.name = payload.name ?? entry.name
    entry.avatar = payload.avatar ?? entry.avatar
    this.catchLog.set(payload.id, entry)

    if (this.mode === 'fish' && payload.fishId === this.params.fishId && payload.id === this.identity.id) {
      this._endMatch(payload.id)
    }
  }

  // Called every frame from main.js's render loop. `paused` just skips
  // broadcasting our own position (no point spamming updates while the
  // pause menu is open) — everything else (the match clock, remote-avatar
  // interpolation) keeps running in real time regardless, same as it would
  // for every other player in the room.
  tick(dt, paused) {
    if (this.matchActive && !this.matchEnded) {
      if (this.mode === 'time') {
        const secondsLeft = Math.max(0, Math.ceil((this._matchEndAt - Date.now()) / 1000))
        this.onMatchTick?.({ secondsLeft })
        if (this.isHost && secondsLeft <= 0) this._endMatch(null)
      } else if (this.mode === 'fish') {
        this.onMatchTick?.({ fishName: this.params.fishName })
      }

      if (!paused) {
        this._posTimer += dt
        if (this._posTimer >= POS_SEND_INTERVAL) {
          this._posTimer = 0
          _euler.setFromQuaternion(this.camera.quaternion)
          broadcastRoom('pos', {
            id: this.identity.id,
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
            ry: _euler.y,
          })
        }
      }
    }

    const lerpT = Math.min(1, dt * 10)
    for (const av of this.remoteAvatars.values()) {
      if (!av.target) continue
      av.group.position.lerp(av.target.pos, lerpT)
      av.group.rotation.y += shortestAngleDelta(av.group.rotation.y, av.target.ry) * lerpT
    }
  }

  _handlePos(payload) {
    if (payload.id === this.identity.id) return
    let av = this.remoteAvatars.get(payload.id)
    if (!av) av = this._spawnRemoteAvatar(payload.id)
    av.target = { pos: new THREE.Vector3(payload.x, payload.y - AVATAR_EYE_OFFSET, payload.z), ry: payload.ry }
  }

  _spawnRemoteAvatar(id) {
    const meta = this.roster.find((p) => p.id === id) ?? {}
    const { group, setRodColor, setCosmetics } = buildCharacterAvatar({
      hat: Boolean(meta.hat),
      vest: Boolean(meta.vest),
      rodColor: meta.rodColor ?? DEFAULT_ROD_COLOR,
    })
    group.add(makeNameSprite(meta.username ?? 'Pemain'))
    this.scene.add(group)
    const av = { group, setRodColor, setCosmetics, target: null }
    this.remoteAvatars.set(id, av)
    return av
  }

  _clearAvatars() {
    for (const av of this.remoteAvatars.values()) this.scene.remove(av.group)
    this.remoteAvatars.clear()
  }

  // winnerId is explicit for Mode Jenis Ikan (whoever just caught the
  // target); null for Mode Waktu, where the host derives it from the tally.
  _endMatch(winnerId) {
    if (this._endTriggered) return
    this._endTriggered = true
    const results = [...this.catchLog.entries()]
      .map(([id, e]) => ({ id, name: e.name, avatar: e.avatar, points: e.points, catches: e.catches }))
      .sort((a, b) => b.points - a.points)
    const finalWinnerId = winnerId ?? results[0]?.id ?? null
    broadcastRoom('end', { results, winnerId: finalWinnerId, mode: this.mode })
    // Only the one client that actually detected the end condition writes
    // the history row — everyone else's _handleEnd below just renders the
    // same broadcast, so this never double-inserts the same match.
    recordMatchHistory({ roomCode: this.roomCode, mode: this.mode, params: this.params, results, winnerId: finalWinnerId }).catch(
      () => {} // best-effort — a failed write (schema not migrated yet, offline, etc.) shouldn't block anyone's results popup
    )
  }

  // Fires for every client (including whoever triggered it, via the
  // channel's self-echo) so exactly one results popup path handles both
  // "I won" and "someone else won/time ran out".
  _handleEnd(payload) {
    if (this._reportedEnd) return
    this._reportedEnd = true
    this.matchEnded = true
    this.matchActive = false
    this.onMatchEnd?.(payload)
  }
}
