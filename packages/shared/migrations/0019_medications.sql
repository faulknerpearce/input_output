-- 0019_medications.sql
-- Medication catalog + dose log (interval-based next dose).
--
-- Run in the Supabase SQL editor after 0018_wearable_day_total.sql.

-- ---------------------------------------------------------------------------
-- 1. Medications (user-scoped catalog / legend)
-- ---------------------------------------------------------------------------
create table if not exists public.medications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  brand_name      text not null default '',
  strength        text not null default '',
  interval_hours  numeric(6, 2) not null,
  how_to_take     text not null default '',
  schedule        text not null default 'as_needed',
  used_for        text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.medications
  drop constraint if exists medications_interval_hours_check;

alter table public.medications
  add constraint medications_interval_hours_check
  check (interval_hours > 0);

alter table public.medications
  drop constraint if exists medications_schedule_check;

alter table public.medications
  add constraint medications_schedule_check
  check (schedule in ('scheduled', 'as_needed'));

create index if not exists medications_user_updated_idx
  on public.medications (user_id, updated_at desc);

alter table public.medications enable row level security;

drop policy if exists "Users can view own medications" on public.medications;
create policy "Users can view own medications"
  on public.medications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own medications" on public.medications;
create policy "Users can insert own medications"
  on public.medications for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own medications" on public.medications;
create policy "Users can update own medications"
  on public.medications for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own medications" on public.medications;
create policy "Users can delete own medications"
  on public.medications for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Medication doses (daily log)
-- ---------------------------------------------------------------------------
create table if not exists public.medication_doses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  medication_id  uuid not null references public.medications(id) on delete cascade,
  dose_date      date not null default (timezone('utc', now()))::date,
  taken_at       timestamptz not null default now(),
  notes          text not null default '',
  created_at     timestamptz not null default now()
);

create index if not exists medication_doses_user_date_taken_idx
  on public.medication_doses (user_id, dose_date, taken_at);

create index if not exists medication_doses_medication_idx
  on public.medication_doses (medication_id);

alter table public.medication_doses enable row level security;

drop policy if exists "Users can view own medication doses" on public.medication_doses;
create policy "Users can view own medication doses"
  on public.medication_doses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own medication doses" on public.medication_doses;
create policy "Users can insert own medication doses"
  on public.medication_doses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own medication doses" on public.medication_doses;
create policy "Users can update own medication doses"
  on public.medication_doses for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own medication doses" on public.medication_doses;
create policy "Users can delete own medication doses"
  on public.medication_doses for delete
  using (auth.uid() = user_id);
