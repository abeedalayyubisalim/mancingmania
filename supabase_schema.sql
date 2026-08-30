-- Reference schema for the `leaderboard` table used by this game.
-- If you already created the table yourself with different columns,
-- you don't need to run the CREATE TABLE part — just run the RLS
-- policies below (adjusted to your actual column names) so the game
-- can read/write scores.

create table if not exists public.leaderboard (
  id text primary key,
  name text not null,
  points numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Already have the table? Run this line too — it adds the spendable
-- "wallet" balance (separate from lifetime points/level) used by the
-- store. Safe to run even if the column already exists.
alter table public.leaderboard add column if not exists wallet numeric not null default 0;

-- Already have the table? Run this line too — it adds the player's chosen
-- profile picture (an emoji). Safe to run even if it already exists.
alter table public.leaderboard add column if not exists avatar text;

-- One-time fix if you already had players with points > 0 BEFORE the
-- `wallet` column existed: the column defaults new/existing rows to 0,
-- which left their wallet empty even though they'd already earned points.
-- This backfills wallet = points for any row that looks un-initialized
-- (wallet still 0 but points > 0). Safe to run more than once — it's a
-- no-op once every wallet has been touched by real gameplay.
update public.leaderboard set wallet = points where wallet = 0 and points > 0;

alter table public.leaderboard enable row level security;

-- Anyone (including anonymous visitors) can read the leaderboard — also
-- needed so players can look up and view each other's public profile.
create policy "Leaderboard is publicly readable"
  on public.leaderboard for select
  using (true);

-- A player can only insert/update their own row (id = their auth uuid,
-- stored as text).
create policy "Players can insert their own score"
  on public.leaderboard for insert
  with check (auth.uid()::text = id);

create policy "Players can update their own score"
  on public.leaderboard for update
  using (auth.uid()::text = id);

-- ---------------------------------------------------------------------------
-- `inventory` — one row per item a player has acquired (fish caught, and
-- later other item types like hooks/bait). `id` is this row's own unique
-- primary key (generated client-side), `user_id` is the player's auth uuid
-- (stored as text — a player has many rows), `jenis` is the item id (e.g.
-- a fish id like "tuna"), `created_at` timestamps it.
-- ---------------------------------------------------------------------------

create table if not exists public.inventory (
  id text primary key,
  user_id text not null,
  jenis text not null,
  created_at timestamptz not null default now()
);

-- Already have the table but no `berat` (weight, kg) column yet? Run just
-- this line — it's safe to run even if the column already exists.
alter table public.inventory add column if not exists berat numeric;

alter table public.inventory enable row level security;

-- Anyone can view any player's catches — needed so a player's fish
-- collection shows up on their public profile (search / leaderboard).
-- If you'd rather keep collections private, use the commented-out
-- "own inventory only" policy below instead.
drop policy if exists "Players can view their own inventory" on public.inventory;
drop policy if exists "Inventory is publicly readable" on public.inventory;
create policy "Inventory is publicly readable"
  on public.inventory for select
  using (true);

-- create policy "Players can view their own inventory"
--   on public.inventory for select
--   using (auth.uid()::text = user_id);

-- A player can only add items to their own inventory.
drop policy if exists "Players can add to their own inventory" on public.inventory;
create policy "Players can add to their own inventory"
  on public.inventory for insert
  with check (auth.uid()::text = user_id);

-- ---------------------------------------------------------------------------
-- `friends` — a player's personal follow list (used for the Teman menu and
-- to show which of your friends are currently online). One-directional: you
-- adding someone as a friend doesn't require them to accept, same as
-- "following" on many social apps. `friend_name` is cached at add-time so
-- the list renders without an extra lookup.
-- ---------------------------------------------------------------------------

create table if not exists public.friends (
  user_id text not null,
  friend_id text not null,
  friend_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.friends enable row level security;

-- A player can only see, add to, and remove from their OWN friends list —
-- unlike leaderboard/inventory this one isn't public.
drop policy if exists "Players can view their own friends list" on public.friends;
create policy "Players can view their own friends list"
  on public.friends for select
  using (auth.uid()::text = user_id);

drop policy if exists "Players can add to their own friends list" on public.friends;
create policy "Players can add to their own friends list"
  on public.friends for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "Players can remove their own friends" on public.friends;
create policy "Players can remove their own friends"
  on public.friends for delete
  using (auth.uid()::text = user_id);

-- ---------------------------------------------------------------------------
-- `match_history` — one row per finished MULTIPLAYER match (Mode Waktu /
-- Mode Jenis Ikan only — Single Player and Survival are intentionally never
-- recorded here). `results` is the full final scoreboard as JSON
-- ([{id, name, points, catches}, ...], already sorted by points) and
-- `participant_ids` pulls just those ids out into their own column so a
-- player's Profile can cheaply ask "every match I was part of" with one
-- `@>` containment check instead of scanning/parsing `results` itself.
-- ---------------------------------------------------------------------------

create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  mode text not null,
  params jsonb not null default '{}'::jsonb,
  results jsonb not null,
  winner_id text,
  participant_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists match_history_participant_idx on public.match_history using gin (participant_ids);

alter table public.match_history enable row level security;

-- Public read — a player's match history shows up on their profile the
-- same way their fish collection/gear already does.
drop policy if exists "Match history is publicly readable" on public.match_history;
create policy "Match history is publicly readable"
  on public.match_history for select
  using (true);

-- Any client that was actually in the room can report a finished match.
-- Unlike leaderboard/inventory/friends, one match_history row covers
-- EVERYONE in that round, not just the id of whoever's client inserts it —
-- and since there's no game server, it might be any participant's client
-- (guest included) that detects the end condition first and reports it —
-- so this can't be narrowed to "only your own id" the way those tables are.
drop policy if exists "Players can record a finished match" on public.match_history;
create policy "Players can record a finished match"
  on public.match_history for insert
  with check (true);
