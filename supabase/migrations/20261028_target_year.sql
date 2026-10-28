-- Run once in the Supabase SQL editor if your database already exists.
-- Adds the year the annual revenue target applies to. Blank (null) means the current year.
alter table public.settings
  add column if not exists target_year int check (target_year between 2000 and 2100);
