-- 0022_extend_backfill_ingredients.sql
-- Extends 0021: link recipe lines whose grams are embedded inside a larger
-- amount string (e.g. "20g (1 serving)", "1 tbsp (13g)", "~250 g drained",
-- "1 can (~427g drained)") instead of only plain "150g"-style amounts.
--
-- Also back-fills accurate per-100g catalog macros for ingredient names whose
-- derived-grams came from these embedded lines (real = line macros scaled to
-- 100g). Names with no gram-bearing line at all (purely volumetric, e.g.
-- "1 cup", "to taste") are left untouched and stay unlinked.
--
-- Run in the Supabase SQL editor after 0021_backfill_ingredients.sql.
-- Idempotent with respect to recipe_ingredients.ingredient_id (already-linked
-- lines are never touched).

-- ---------------------------------------------------------------------------
-- A. Recompute accurate per-100g macros for catalog ingredients that can be
--    tied to any gram-bearing recipe line (plain or embedded). Prefer a line
--    with grams closest to 100 to minimise rounding error.
-- ---------------------------------------------------------------------------
with gram_lines as (
  select
    ri.user_id,
    ri.name,
    ri.calories,
    ri.protein,
    ri.carbs,
    ri.fat,
    ri.fiber,
    ri.caffeine,
    (regexp_match(trim(ri.amount), '([0-9]+(?:\.[0-9]+)?)[[:space:]]*g', 'i'))[1]::numeric as grams
  from public.recipe_ingredients ri
  where ri.amount ~* '([0-9]+(?:\.[0-9]+)?)[[:space:]]*g'
),
rep as (
  select distinct on (user_id, lower(name))
    user_id,
    name,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    caffeine,
    grams
  from gram_lines
  where grams is not null and grams > 0
  order by user_id, lower(name), abs(grams - 100), grams
)
update public.ingredients i
set per_100g_calories = round(r.calories * 100.0 / r.grams)::int,
    per_100g_protein  = round(r.protein  * 100.0 / r.grams)::int,
    per_100g_carbs    = round(r.carbs    * 100.0 / r.grams)::int,
    per_100g_fat      = round(r.fat      * 100.0 / r.grams)::int,
    per_100g_fiber    = round(r.fiber    * 100.0 / r.grams)::int,
    per_100g_caffeine = round(r.caffeine * 100.0 / r.grams)::int,
    updated_at = now()
from rep r
where i.user_id = r.user_id
  and lower(i.name) = lower(r.name);

-- ---------------------------------------------------------------------------
-- B. Link every recipe line with a taggable gram value (embedded or plain)
--    that is not yet linked, and record the gram weight.
-- ---------------------------------------------------------------------------
with target_lines as (
  select
    ri.id,
    ri.recipe_id,
    ri.user_id,
    ri.name,
    (regexp_match(trim(ri.amount), '([0-9]+(?:\.[0-9]+)?)[[:space:]]*g', 'i'))[1]::numeric as grams
  from public.recipe_ingredients ri
  where ri.ingredient_id is null
    and ri.amount ~* '([0-9]+(?:\.[0-9]+)?)[[:space:]]*g'
)
update public.recipe_ingredients ri
set ingredient_id = i.id,
    amount_grams  = round(t.grams::numeric, 2)
from target_lines t
join public.ingredients i
  on i.user_id = t.user_id
 and lower(i.name) = lower(t.name)
where ri.id = t.id
  and t.grams is not null
  and t.grams > 0;