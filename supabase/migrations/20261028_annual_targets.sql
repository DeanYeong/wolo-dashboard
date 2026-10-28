-- Run once in the Supabase SQL editor if your database already exists.
-- Keeps one revenue target per year, so setting 2027 never replaces 2026.

create table if not exists public.annual_targets (
  year int primary key check (year between 2000 and 2100),
  amount numeric not null check (amount > 0),
  updated_at timestamptz not null default now()
);

alter table public.annual_targets enable row level security;

drop policy if exists "read all" on public.annual_targets;
create policy "read all" on public.annual_targets for select to authenticated using (true);
drop policy if exists "editors insert" on public.annual_targets;
create policy "editors insert" on public.annual_targets for insert to authenticated with check (public.is_editor());
drop policy if exists "editors update" on public.annual_targets;
create policy "editors update" on public.annual_targets for update to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists "editors delete" on public.annual_targets;
create policy "editors delete" on public.annual_targets for delete to authenticated using (public.is_editor());

-- Copy the single target you may already have entered into the new table.
-- A blank year meant "the current year" in the app, so it is copied as this year.
alter table public.settings add column if not exists target_year int;

insert into public.annual_targets (year, amount)
select coalesce(target_year, extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::int), target_2027
from public.settings
where id = 1 and target_2027 is not null and target_2027 > 0
on conflict (year) do nothing;
