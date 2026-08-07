-- 0020_ingredients.sql
-- Standalone ingredient catalog (reusable building blocks for recipes).
-- Macros are defined per 100g; recipes reference an ingredient and scale by grams.
--
-- Run in the Supabase SQL editor after 0019_medications.sql.

-- ---------------------------------------------------------------------------
-- 1. Ingredients (user-scoped catalog / legend)
-- ---------------------------------------------------------------------------
create table if not exists public.ingredients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  description text not null default '',
  icon       text not null default 'fa-seedling',
  icon_bg    text not null default '#f4f4f5',
  icon_color text not null default '#71717a',
  per_100g_calories integer not null default 0,
  per_100g_protein   integer not null default 0,
  per_100g_carbs     integer not null default 0,
  per_100g_fat       integer not null default 0,
  per_100g_fiber     integer not null default 0,
  per_100g_caffeine  integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredients
  drop constraint if exists ingredients_per_100g_non_negative;

alter table public.ingredients
  add constraint ingredients_per_100g_non_negative
  check (
    per_100g_calories >= 0 and per_100g_protein >= 0 and per_100g_carbs >= 0 and
    per_100g_fat >= 0 and per_100g_fiber >= 0 and per_100g_caffeine >= 0
  );

create index if not exists ingredients_user_updated_idx
  on public.ingredients (user_id, updated_at desc);

-- Name lookup is a common search path (unique per user for de-dupe).
create index if not exists ingredients_user_name_idx
  on public.ingredients (user_id, lower(name));

alter table public.ingredients enable row level security;

drop policy if exists "Users can view own ingredients" on public.ingredients;
create policy "Users can view own ingredients"
  on public.ingredients for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ingredients" on public.ingredients;
create policy "Users can insert own ingredients"
  on public.ingredients for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own ingredients" on public.ingredients;
create policy "Users can update own ingredients"
  on public.ingredients for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own ingredients" on public.ingredients;
create policy "Users can delete own ingredients"
  on public.ingredients for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Optionally link recipe ingredient lines back to a catalog ingredient
-- ---------------------------------------------------------------------------
alter table public.recipe_ingredients
  add column if not exists ingredient_id uuid references public.ingredients(id) on delete set null;

alter table public.recipe_ingredients
  add column if not exists amount_grams numeric(10, 2);

create index if not exists recipe_ingredients_ingredient_idx
  on public.recipe_ingredients (ingredient_id);