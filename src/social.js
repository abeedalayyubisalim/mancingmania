// Lightweight "who's online" presence + live chat over a single shared
// Supabase Realtime channel ("lobby"). No new table needed — presence and
// broadcasts are ephemeral (Supabase keeps them in memory server-side for
// the life of the connection, nothing is persisted to Postgres), which
// keeps the whole social layer schema-free. The tradeoff: reload the page,
// or miss a friend while they're offline, and that message/status is gone
// — there's no history to catch up on.
import { supabase } from './supabase-client.js'

let channel = null
let presenceState = {}
let onlineChangeHandler = null
let chatHandler = null
// The last {username, avatar, ...cosmetics} we told the channel about —
// kept around so updatePresenceCosmetics() can re-track without needing
// the caller to re-pass username/avatar every time.
let trackedMeta = null

// ---- Multiplayer room channel ----------------------------------------
// A second, separate Realtime channel from the lobby one above — joined
// only while a player is in (or waiting in) a multiplayer room. Same
// ephemeral presence+broadcast approach, just scoped to `room:<code>`
// instead of the shared "lobby" so room chatter/positions never leak to
// players who aren't in that room.
let roomChannel = null
let roomPresenceState = {}
let roomMeta = null
let roomHandlers = {}

// Avoids ambiguous characters (0/O, 1/I) so a spoken-aloud or handwritten
// code is never misread.
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode() {
  let code = ''
  for (let i = 0; i < 5; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  return code
}

// Reused as the quick-tap reaction row inside the chat panel (see hud.js) —
// tapping one just sends its emoji as a normal chat message.
export const EMOTES = [
  { id: 'wave', emoji: '👋', label: 'Hai!' },
  { id: 'nice', emoji: '😄', label: 'Mantap!' },
  { id: 'laugh', emoji: '😂', label: 'Wkwk' },
  { id: 'fire', emoji: '🔥', label: 'Gokil!' },
  { id: 'ggwp', emoji: '🏆', label: 'Selamat!' },
  { id: 'sad', emoji: '😢', label: 'Yah...' },
]

// Joins the shared lobby channel and announces this player's presence.
// `identity` = { id, username, avatar, cosmetics } — `id` should be stable
// for a session (auth uuid for logged-in players, a random id for guests)
// so reconnects don't spam duplicate entries. `cosmetics` (optional) =
// { rodColor, hat, vest } — broadcast alongside username/avatar so anyone
// who has you in view (multiplayer, or a Profile preview while you're
// online) can render your character wearing what you actually have
// equipped right now, not a guess. Equipped-skin choice is a per-device
// preference (see store.js) with nothing to look up in Supabase for it,
// so presence is the only way this info reaches other players at all.
export function connectLobby(identity, { onOnlineChange, onChat } = {}) {
  if (!supabase || channel) return
  onlineChangeHandler = onOnlineChange ?? null
  chatHandler = onChat ?? null
  trackedMeta = { username: identity.username, avatar: identity.avatar, ...(identity.cosmetics ?? {}) }

  // `broadcast.self: true` makes our own messages come back to us over the
  // same channel — the chat UI relies on that single path for rendering
  // both sent and received messages instead of also appending locally.
  channel = supabase.channel('lobby', {
    config: { presence: { key: identity.id }, broadcast: { self: true } },
  })

  channel.on('presence', { event: 'sync' }, () => {
    presenceState = channel.presenceState()
    onlineChangeHandler?.(getOnlinePlayers())
  })

  channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
    chatHandler?.(payload)
  })

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track(trackedMeta)
    }
  })
}

// Re-announces this player's presence with updated cosmetics (call after
// buying/equipping a new rod skin or accessory) without touching
// username/avatar. A no-op if we're not connected yet.
export function updatePresenceCosmetics(cosmetics) {
  if (!channel || !trackedMeta) return
  trackedMeta = { ...trackedMeta, ...cosmetics }
  channel.track(trackedMeta)
}

export function disconnectLobby() {
  if (channel) {
    channel.unsubscribe()
    channel = null
  }
  presenceState = {}
}

// [{ id, username, avatar }] for everyone currently connected, including
// this player.
export function getOnlinePlayers() {
  return Object.entries(presenceState).map(([id, metas]) => ({ id, ...(metas[0] ?? {}) }))
}

export function isOnline(id) {
  return Boolean(presenceState[id])
}

export function onlineCount() {
  return Object.keys(presenceState).length
}

// Broadcasts one chat message. `toId: null` (or omitted) means "global" —
// everyone in the lobby sees it. A `toId` scopes it to a DM shown only in
// that pair's thread (see hud.js's receiveChatMessage) — it's still sent
// to the whole channel since there's no per-pair channel, just filtered
// client-side on the way in. `invite` (optional) = { code } — stamps this
// message as a multiplayer room invite so the receiving chat UI can render
// a tappable "Gabung Room" button instead of/alongside the text.
export function sendChat({ fromId, fromName, toId = null, text, invite = null }) {
  channel?.send({
    type: 'broadcast',
    event: 'chat',
    payload: { fromId, fromName, toId, text, invite, ts: Date.now() },
  })
}

// Joins (or re-joins) the Realtime channel for one multiplayer room.
// `identity` = { id, username, avatar, cosmetics, isHost }. `handlers` =
// { onPresence, onStart, onPos, onCatch, onEnd } — see game/multiplayer.js,
// which owns all the actual game logic; this module is purely the wire.
export function joinRoomChannel(code, identity, handlers = {}) {
  if (!supabase) return
  if (roomChannel) leaveRoomChannel() // safety net if a caller forgot to leave first
  roomHandlers = handlers
  roomMeta = {
    username: identity.username,
    avatar: identity.avatar,
    isHost: Boolean(identity.isHost),
    ...(identity.cosmetics ?? {}),
  }

  roomChannel = supabase.channel(`room:${code}`, {
    config: { presence: { key: identity.id }, broadcast: { self: true } },
  })

  roomChannel.on('presence', { event: 'sync' }, () => {
    roomPresenceState = roomChannel.presenceState()
    roomHandlers.onPresence?.(getRoomPlayers())
  })
  roomChannel.on('broadcast', { event: 'start' }, ({ payload }) => roomHandlers.onStart?.(payload))
  roomChannel.on('broadcast', { event: 'pos' }, ({ payload }) => roomHandlers.onPos?.(payload))
  roomChannel.on('broadcast', { event: 'catch' }, ({ payload }) => roomHandlers.onCatch?.(payload))
  roomChannel.on('broadcast', { event: 'end' }, ({ payload }) => roomHandlers.onEnd?.(payload))

  roomChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await roomChannel.track(roomMeta)
  })
}

export function leaveRoomChannel() {
  if (roomChannel) {
    roomChannel.unsubscribe()
    roomChannel = null
  }
  roomPresenceState = {}
  roomMeta = null
  roomHandlers = {}
}

export function getRoomPlayers() {
  return Object.entries(roomPresenceState).map(([id, metas]) => ({ id, ...(metas[0] ?? {}) }))
}

// event: 'pos' | 'catch' | 'end' — 'start' is only ever sent by the host,
// via startMatch() in game/multiplayer.js, but routed the same way.
export function broadcastRoom(event, payload) {
  roomChannel?.send({ type: 'broadcast', event, payload })
}
