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

alter table public.leaderboard enable row level security;

-- Anyone (including anonymous visitors) can read the leaderboard.
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
