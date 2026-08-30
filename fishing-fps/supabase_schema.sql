-- Run this once in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create table if not exists public.leaderboard (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  score integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

-- Anyone (including anonymous visitors) can read the leaderboard.
create policy "Leaderboard is publicly readable"
  on public.leaderboard for select
  using (true);

-- A player can only insert/update their own row.
create policy "Players can insert their own score"
  on public.leaderboard for insert
  with check (auth.uid() = id);

create policy "Players can update their own score"
  on public.leaderboard for update
  using (auth.uid() = id);
