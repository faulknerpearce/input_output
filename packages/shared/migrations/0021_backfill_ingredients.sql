-- 0021_backfill_ingredients.sql
-- Backfill: promote existing (legacy) recipe ingredient lines into the new
-- ingredient catalog and link gram-based lines back to the catalog.
--
-- Design (confirmed):
--   * Lines whose `amount` is a plain gram value (e.g. "150g", "150 g")
--     derive per-100g macros from line macros + grams, get an `ingredient_id`
--     link, and are written with `amount_grams`.
--   * Non-gram / volumetric lines (e.g. "1 cup") still get a catalog row so
--     every unique ingredient name exists in the catalog, but they stay
--     unlinked and inline (no reliable grams -> no way to scale per 100g).
--
-- Run in the Supabase SQL editor after 0020_ingredients.sql.
-- Idempotent: skips rows already linked and names already catalogued.

-- ---------------------------------------------------------------------------
-- 1. Create catalog rows for every unique (user, lower(name)) recipe line
--    that does not yet have a catalog entry.
--    Per-100g macros: derived from the line macros when the line has grams,
--    otherwise the line macros as-is (raw, best-effort for volumetric lines).
-- ---------------------------------------------------------------------------
with lines as (
  select
    ri.user_id,
    ri.name,
    ri.calories,
    ri.protein,
    ri.carbs,
    ri.fat,
    ri.fiber,
    ri.caffeine,
    nullif(substring(trim(ri.amount) from '^([0-9]+(?:\.[0-9]+)?)\s*g$'), '')::numeric as grams
  from public.recipe_ingredients ri
  where ri.ingredient_id is null
)
insert into public.ingredients (
  user_id, name, description,
  per_100g_calories, per_100g_protein, per_100g_carbs,
  per_100g_fat, per_100g_fiber, per_100g_caffeine
)
select distinct on (user_id, lower(name))
  user_id,
  name,
  '',
  case when grams is not null and grams > 0
       then round(calories * 100.0 / grams)::int else calories end,
  case when grams is not null and grams > 0
       then round(protein * 100.0 / grams)::int else protein end,
  case when grams is not null and grams > 0
       then round(carbs   * 100.0 / grams)::int else carbs   end,
  case when grams is not null and grams > 0
       then round(fat     * 100.0 / grams)::int else fat     end,
  case when grams is not null and grams > 0
       then round(fiber   * 100.0 / grams)::int else fiber   end,
  case when grams is not null and grams > 0
       then round(caffeine* 100.0 / grams)::int else caffeine end
from lines
where not exists (
  select 1
  from public.ingredients existing
  where existing.user_id = lines.user_id
    and lower(existing.name) = lower(lines.name)
)
order by user_id, lower(name),
  -- Prefer gram-based lines for the most accurate per-100g derivation.
  case when grams is not null and grams > 0 then 0 else 1 end,
  grams::double precision nulls last;

-- ---------------------------------------------------------------------------
-- 2. Link gram-based recipe lines to their catalog ingredient and record the
--    gram weight. Volumetric lines remain unlinked (inline) by design.
-- ---------------------------------------------------------------------------
update public.recipe_ingredients ri
set ingredient_id = ingredients.id,
    amount_grams = nullif(substring(trim(ri.amount) from '^([0-9]+(?:\.[0-9]+)?)\s*g$'), '')::numeric
from public.ingredients
where ri.ingredient_id is null
  and ingredients.user_id = ri.user_id
  and lower(ingredients.name) = lower(ri.name)
  and nullif(substring(trim(ri.amount) from '^([0-9]+(?:\.[0-9]+)?)\s*g$'), '')::numeric is not null;