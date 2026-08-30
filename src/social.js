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
// `identity` = { id, username, avatar } — `id` should be stable for a
// session (auth uuid for logged-in players, a random id for guests) so
// reconnects don't spam duplicate entries.
export function connectLobby(identity, { onOnlineChange, onChat } = {}) {
  if (!supabase || channel) return
  onlineChangeHandler = onOnlineChange ?? null
  chatHandler = onChat ?? null

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
      await channel.track({ username: identity.username, avatar: identity.avatar })
    }
  })
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
// client-side on the way in.
export function sendChat({ fromId, fromName, toId = null, text }) {
  channel?.send({
    type: 'broadcast',
    event: 'chat',
    payload: { fromId, fromName, toId, text, ts: Date.now() },
  })
}
