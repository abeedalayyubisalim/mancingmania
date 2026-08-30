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
