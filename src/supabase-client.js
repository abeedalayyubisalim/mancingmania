// ---------------------------------------------------------------------------
// Supabase configuration
// ---------------------------------------------------------------------------
// 1. Create a free project at https://supabase.com
// 2. Go to Project Settings -> API and copy the "Project URL" and the
//    "anon public" key into the two constants below.
// 3. Run the SQL in supabase_schema.sql (Supabase dashboard -> SQL editor)
//    to create the `leaderboard` table and its security policies.
//
// This project's `leaderboard` table uses these columns:
//   id (text, the auth user's uuid stored as text), name (text),
//   points (numeric), created_at (timestamptz)
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://riugacrmejboxnpcawpd.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdWdhY3JtZWpib3hucGNhd3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNDI1ODYsImV4cCI6MjEwMzYxODU4Nn0.hh5xE1FGm8uqiunj9dkSnU-7Sai7g6hIepq_9Iar6LA'

export const isSupabaseConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON')

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// Supabase Auth wants an email. We let players sign up with just a
// username by turning it into a fake, unique-looking email address.
function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@fishing-fps.local`
}

export async function signUp(username, password) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const email = usernameToEmail(username)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  })
  if (error) throw error

  // Seed a leaderboard row for this new user.
  if (data.user) {
    const { error: seedError } = await supabase
      .from('leaderboard')
      .upsert({ id: data.user.id, name: username.trim(), points: 0, wallet: 0 }, { onConflict: 'id' })
    if (seedError) {
      // Older table without `wallet` — retry without it.
      await supabase
        .from('leaderboard')
        .upsert({ id: data.user.id, name: username.trim(), points: 0 }, { onConflict: 'id' })
    }
  }
  return data
}

export async function signIn(username, password) {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const email = usernameToEmail(username)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getMyUsername(session) {
  if (!session) return null
  return session.user.user_metadata?.username ?? session.user.email.split('@')[0]
}

// `points` = lifetime total ever earned (only grows, used for the
// leaderboard ranking AND the player's level). `wallet` = spendable
// balance for the store (grows on catches, shrinks on purchases) — kept
// separate so spending gear never costs you rank or level. `avatar` = the
// player's chosen profile picture emoji.
export async function fetchProfile(userId) {
  if (!supabase || !userId) return { points: 0, wallet: 0, avatar: null }
  let { data, error } = await supabase
    .from('leaderboard')
    .select('name, points, wallet, avatar')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    // Older table without `avatar` — retry without it.
    ;({ data, error } = await supabase
      .from('leaderboard')
      .select('name, points, wallet')
      .eq('id', userId)
      .maybeSingle())
  }
  if (error) {
    // Older still, without `wallet` either.
    ;({ data, error } = await supabase
      .from('leaderboard')
      .select('name, points')
      .eq('id', userId)
      .maybeSingle())
  }
  if (error || !data) return { points: 0, wallet: 0, avatar: null }
  return { points: data.points ?? 0, wallet: data.wallet ?? data.points ?? 0, avatar: data.avatar ?? null }
}

// Updates just the player's chosen profile picture (covered by the same
// "update own row" RLS policy as points/wallet).
export async function updateAvatar(userId, avatar) {
  if (!supabase || !userId) return
  await supabase.from('leaderboard').update({ avatar }).eq('id', userId)
}

// Call whenever the player's lifetime total and/or wallet changes (catch,
// purchase) — keeps both in sync with Supabase so nothing resets on login.
export async function syncPoints(userId, username, points, wallet) {
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('leaderboard')
    .upsert({ id: userId, name: username, points, wallet }, { onConflict: 'id' })
  if (error) {
    // Older table without `wallet` — retry without it.
    await supabase.from('leaderboard').upsert({ id: userId, name: username, points }, { onConflict: 'id' })
  }
}

export async function fetchLeaderboard(limit = 10) {
  if (!supabase) return []
  let { data, error } = await supabase
    .from('leaderboard')
    .select('id, name, points, avatar')
    .order('points', { ascending: false })
    .limit(limit)
  if (error) {
    ;({ data, error } = await supabase
      .from('leaderboard')
      .select('id, name, points')
      .order('points', { ascending: false })
      .limit(limit))
  }
  if (error) return []
  // Normalize to {username, score} so the rest of the app doesn't need to
  // know about this table's actual column names.
  return data.map((row) => ({ id: row.id, username: row.name, score: row.points, avatar: row.avatar ?? null }))
}

// Looks up one player's public profile by (exact) username — used when a
// player is opened from a search result or a leaderboard row.
export async function fetchPublicProfileById(userId) {
  if (!supabase || !userId) return null
  let { data, error } = await supabase
    .from('leaderboard')
    .select('id, name, points, avatar')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    ;({ data, error } = await supabase.from('leaderboard').select('id, name, points').eq('id', userId).maybeSingle())
  }
  if (error || !data) return null
  return data
}

export async function fetchPublicProfileByName(username) {
  if (!supabase || !username) return null
  let { data, error } = await supabase
    .from('leaderboard')
    .select('id, name, points, avatar')
    .ilike('name', username)
    .maybeSingle()
  if (error) {
    ;({ data, error } = await supabase
      .from('leaderboard')
      .select('id, name, points')
      .ilike('name', username)
      .maybeSingle())
  }
  if (error || !data) return null
  return data
}

// Free-text player search (for the profile "cari pemain" box).
export async function searchPlayers(query, limit = 8) {
  if (!supabase || !query || !query.trim()) return []
  let { data, error } = await supabase
    .from('leaderboard')
    .select('id, name, points, avatar')
    .ilike('name', `%${query.trim()}%`)
    .order('points', { ascending: false })
    .limit(limit)
  if (error) {
    ;({ data, error } = await supabase
      .from('leaderboard')
      .select('id, name, points')
      .ilike('name', `%${query.trim()}%`)
      .order('points', { ascending: false })
      .limit(limit))
  }
  if (error) return []
  return data
}

// ---------------------------------------------------------------------------
// Inventory (fish caught, and later other item types like hooks/bait).
// One row per item acquired — `jenis` is the item id (e.g. a fish id like
// "tuna", or a future non-fish item like "hook_bronze"). `id` is this row's
// own unique primary key (we generate it client-side); `user_id` is who
// owns the row.
// ---------------------------------------------------------------------------

export async function addInventoryItem(userId, jenis, berat) {
  if (!supabase || !userId) return
  const row = { id: crypto.randomUUID(), user_id: userId, jenis }
  if (typeof berat === 'number') row.berat = berat
  const { error } = await supabase.from('inventory').insert(row)
  if (error && typeof berat === 'number') {
    // Table doesn't have a `berat` column yet (migration not run) — retry
    // without it so the catch still gets saved.
    await supabase.from('inventory').insert({ id: crypto.randomUUID(), user_id: userId, jenis })
  }
}

// Returns every inventory row for this user, oldest first.
export async function fetchInventory(userId) {
  if (!supabase || !userId) return []
  let { data, error } = await supabase
    .from('inventory')
    .select('jenis, created_at, berat')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    // Older table without `berat` — retry without selecting it.
    ;({ data, error } = await supabase
      .from('inventory')
      .select('jenis, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }))
  }
  if (error) return []
  return data
}

// All inventory rows (any player) created since `sinceIso` — used to
// compute the weekly leaderboard by re-deriving points earned from each
// catch's fish id + weight, without needing a separate "weekly points"
// column that would need a scheduled reset job.
export async function fetchInventorySince(sinceIso) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('inventory')
    .select('user_id, jenis, berat, created_at')
    .gte('created_at', sinceIso)
  if (error) return []
  return data
}

// Batch name/avatar lookup for a set of user ids (e.g. to label a weekly
// leaderboard computed from raw inventory rows).
export async function fetchProfilesByIds(ids) {
  if (!supabase || !ids?.length) return []
  let { data, error } = await supabase.from('leaderboard').select('id, name, avatar').in('id', ids)
  if (error) {
    ;({ data, error } = await supabase.from('leaderboard').select('id, name').in('id', ids))
  }
  if (error) return []
  return data
}

// ---------------------------------------------------------------------------
// Friends — a personal follow list (see supabase_schema.sql). Not public:
// RLS only lets a player see their own list.
// ---------------------------------------------------------------------------

export async function fetchFriends(userId) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('friends')
    .select('friend_id, friend_name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data
}

export async function addFriend(userId, friendId, friendName) {
  if (!supabase || !userId || !friendId) return
  await supabase
    .from('friends')
    .upsert({ user_id: userId, friend_id: friendId, friend_name: friendName }, { onConflict: 'user_id,friend_id' })
}

export async function removeFriend(userId, friendId) {
  if (!supabase || !userId) return
  await supabase.from('friends').delete().eq('user_id', userId).eq('friend_id', friendId)
}

// ---------------------------------------------------------------------------
// Match history (see supabase_schema.sql) — Sub-tahap D: one row per
// finished MULTIPLAYER match (Mode Waktu / Mode Jenis Ikan). Single Player
// and Survival never call this — those stay local-progress-only, per the
// original design brief. Whichever client's game/multiplayer.js detects
// the match ending is the one that calls recordMatchHistory(); everyone
// else just renders the same 'end' broadcast they already show a results
// popup from (see MultiplayerSession._endMatch/_handleEnd).
// ---------------------------------------------------------------------------

export async function recordMatchHistory({ roomCode, mode, params, results, winnerId }) {
  if (!supabase) return
  await supabase.from('match_history').insert({
    room_code: roomCode,
    mode,
    params,
    results,
    winner_id: winnerId,
    participant_ids: results.map((r) => r.id).filter(Boolean),
  })
}

// Most recent matches a given player took part in, newest first — shown on
// their Profile screen (works for self AND other players, same as their
// fish collection/gear already do, since match_history is publicly
// readable). Guests get an empty list here: their id is a fresh random
// uuid every session, so there's nothing stable in Supabase to look up.
export async function fetchMatchHistory(userId, limit = 10) {
  if (!supabase || !userId) return []
  const { data, error } = await supabase
    .from('match_history')
    .select('id, room_code, mode, params, results, winner_id, created_at')
    .contains('participant_ids', [userId])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}
