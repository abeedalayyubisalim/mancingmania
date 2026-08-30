// Lightweight "who's online" presence + emote broadcasting over a single
// shared Supabase Realtime channel ("lobby"). No new table needed — presence
// and broadcasts are ephemeral (Supabase keeps them in memory server-side
// for the life of the connection), which is exactly what we want here.
import { supabase } from './supabase-client.js'

let channel = null
let presenceState = {}
let onlineChangeHandler = null
let emoteHandler = null

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
export function connectLobby(identity, { onOnlineChange, onEmote } = {}) {
  if (!supabase || channel) return
  onlineChangeHandler = onOnlineChange ?? null
  emoteHandler = onEmote ?? null

  channel = supabase.channel('lobby', { config: { presence: { key: identity.id } } })

  channel.on('presence', { event: 'sync' }, () => {
    presenceState = channel.presenceState()
    onlineChangeHandler?.(getOnlinePlayers())
  })

  channel.on('broadcast', { event: 'emote' }, ({ payload }) => {
    emoteHandler?.(payload)
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

// Broadcasts an emote reaction to everyone in the lobby (including the
// sender, so their own tap gets the same feedback toast).
export function sendEmote({ username, avatar, emoteId }) {
  channel?.send({ type: 'broadcast', event: 'emote', payload: { username, avatar, emoteId } })
}
