-- 0001_add_entry_date.sql
-- Adds an entry_date column to scope "today's" log.
--
-- Run this in the Supabase SQL editor against the input_output project.
-- Idempotent: safe to run multiple times.

-- 1. Add the column (no NOT NULL yet, so existing rows can be backfilled).
alter table public.food_entries
  add column if not exists entry_date date;

-- 2. Backfill: any existing rows get their entry_date set to the day they
--    were created. Without this step, an ALTER ... SET NOT NULL below
--    would fail.
update public.food_entries
  set entry_date = created_at::date
  where entry_date is null;

-- 3. Enforce NOT NULL and add a default for future inserts.
alter table public.food_entries
  alter column entry_date set not null,
  alter column entry_date set default current_date;

-- 4. Index for the most common query (today's entries, ordered by created_at).
create index if not exists food_entries_entry_date_idx
  on public.food_entries (entry_date, created_at);
