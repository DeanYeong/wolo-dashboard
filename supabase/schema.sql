-- Wolo Yoga dashboard schema. Run once in Supabase: SQL Editor > New query > paste > Run.

-- ---------- roles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('viewer', 'editor'))
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'editor');
$$;

-- ---------- settings (one row) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  vision text not null default '',
  core_values jsonb not null default '[{"t":"","d":""},{"t":"","d":""},{"t":"","d":""},{"t":"","d":""}]',
  target_2027 numeric, -- annual revenue target amount (column name is historical)
  fee_rate numeric not null default 0.10 check (fee_rate >= 0 and fee_rate < 1),
  updated_at timestamptz not null default now()
);
-- Year the annual revenue target applies to; blank means the current year.
alter table public.settings add column if not exists target_year int check (target_year between 2000 and 2100);

insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- weekly entries (week_start is the Monday) ----------
create table if not exists public.weekly_entries (
  week_start date primary key check (extract(isodow from week_start) = 1),
  shopify_revenue numeric not null default 0,
  shopee_revenue numeric not null default 0,
  shopify_cogs numeric not null default 0,
  shopee_cogs numeric not null default 0,
  meta_spend numeric not null default 0,
  google_spend numeric not null default 0,
  shopee_ads numeric not null default 0,
  affiliate numeric not null default 0,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------- monthly entries (month_start is the 1st) ----------
create table if not exists public.monthly_entries (
  month_start date primary key check (extract(day from month_start) = 1),
  shopify_revenue numeric not null default 0,
  shopee_revenue numeric not null default 0,
  other_revenue numeric not null default 0,
  shopify_cogs numeric not null default 0,
  shopee_cogs numeric not null default 0,
  other_cogs numeric not null default 0,
  meta_spend numeric not null default 0,
  google_spend numeric not null default 0,
  shopee_ads numeric not null default 0,
  affiliate numeric not null default 0,
  ccc_days numeric,
  cash_in_bank numeric,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- ---------- row level security: everyone signed in reads, only editors write ----------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.weekly_entries enable row level security;
alter table public.monthly_entries enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['settings', 'weekly_entries', 'monthly_entries'] loop
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('create policy "read all" on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists "editors insert" on public.%I', t);
    execute format('create policy "editors insert" on public.%I for insert to authenticated with check (public.is_editor())', t);
    execute format('drop policy if exists "editors update" on public.%I', t);
    execute format('create policy "editors update" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t);
    execute format('drop policy if exists "editors delete" on public.%I', t);
    execute format('create policy "editors delete" on public.%I for delete to authenticated using (public.is_editor())', t);
  end loop;
end $$;

-- ---------- after you create your own user, make yourself an editor ----------
-- update public.profiles set role = 'editor' where email = 'dean.yeong@gmail.com';
