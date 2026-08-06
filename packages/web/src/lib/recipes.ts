import {
  buildForkRecipeInput,
  buildRecipeIngredientInsertPayload,
  buildRecipeInsertPayload,
  mapRecipeIngredientRow,
  mapRecipeRow,
  mapRow,
  detectBrowserTimeZone,
  perServingTotals,
  scaleRecipeToServings,
  sumRecipeIngredients,
  validateRecipeInput,
  todayISOInTimeZone,
  validateServingsLogged,
  type NewRecipeIngredient,
  type PortionUnit,
  type RecipeInput,
  type RecipeSummary,
  type RecipeWithIngredients,
} from '@input_output/shared'
import type { FoodEntry } from './entries'
import { markRecipeShareSaved } from './sharing'
import { supabase } from './supabase'

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

function toSummary(
  recipe: ReturnType<typeof mapRecipeRow>,
  ingredients: ReturnType<typeof mapRecipeIngredientRow>[],
): RecipeSummary {
  const batchTotals = sumRecipeIngredients(ingredients)
  return {
    ...recipe,
    batchTotals,
    perServingTotals: perServingTotals(batchTotals, recipe.defaultServings),
    ingredientCount: ingredients.length,
  }
}

export async function fetchRecipeSummaries(): Promise<RecipeSummary[]> {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!recipes?.length) return []

  const { data: ingredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in(
      'recipe_id',
      recipes.map((recipe) => recipe.id),
    )
    .order('sort_order', { ascending: true })
  if (ingredientError) throw new Error(ingredientError.message)

  const ingredientsByRecipe = new Map<string, ReturnType<typeof mapRecipeIngredientRow>[]>()
  for (const row of ingredients ?? []) {
    const mapped = mapRecipeIngredientRow(row)
    const list = ingredientsByRecipe.get(row.recipe_id) ?? []
    list.push(mapped)
    ingredientsByRecipe.set(row.recipe_id, list)
  }

  return recipes.map((row) =>
    toSummary(mapRecipeRow(row), ingredientsByRecipe.get(row.id) ?? []),
  )
}

export async function fetchRecipe(id: string): Promise<RecipeWithIngredients> {
  const { data: recipeRow, error } = await supabase.from('recipes').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', id)
    .order('sort_order', { ascending: true })
  if (ingredientError) throw new Error(ingredientError.message)

  const recipe = mapRecipeRow(recipeRow)
  const ingredients = (ingredientRows ?? []).map(mapRecipeIngredientRow)
  const batchTotals = sumRecipeIngredients(ingredients)

  return {
    ...recipe,
    ingredients,
    batchTotals,
    perServingTotals: perServingTotals(batchTotals, recipe.defaultServings),
  }
}

async function replaceRecipeIngredients(
  recipeId: string,
  userId: string,
  ingredients: NewRecipeIngredient[],
) {
  const { error: deleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
  if (deleteError) throw new Error(deleteError.message)

  if (ingredients.length === 0) return

  const rows = ingredients.map((ingredient, index) =>
    buildRecipeIngredientInsertPayload(recipeId, userId, {
      ...ingredient,
      sortOrder: index,
    }, crypto.randomUUID()),
  )

  const { error: insertError } = await supabase.from('recipe_ingredients').insert(rows)
  if (insertError) throw new Error(insertError.message)
}

export async function saveRecipe(input: RecipeInput, id?: string): Promise<RecipeWithIngredients> {
  const validated = validateRecipeInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const userId = await requireUserId()
  const recipeId = id ?? crypto.randomUUID()
  const payload = buildRecipeInsertPayload(validated.value, userId, recipeId)

  if (id) {
    // Keep in sync with buildRecipeInsertPayload fields (including serving_weight_grams).
    const { error } = await supabase
      .from('recipes')
      .update({
        name: payload.name,
        description: payload.description,
        icon: payload.icon,
        icon_bg: payload.icon_bg,
        icon_color: payload.icon_color,
        default_servings: payload.default_servings,
        serving_weight_grams: payload.serving_weight_grams,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('recipes').insert(payload)
    if (error) throw new Error(error.message)
  }

  await replaceRecipeIngredients(recipeId, userId, validated.value.ingredients)
  return fetchRecipe(recipeId)
}

export async function deleteRecipe(id: string): Promise<void> {
  const { data, error } = await supabase.from('recipes').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Recipe not found or not owned by you')
}

export async function forkRecipe(
  sourceRecipeId: string,
  shareId?: string,
): Promise<RecipeWithIngredients> {
  const source = await fetchRecipe(sourceRecipeId)
  const input = buildForkRecipeInput(source)
  const userId = await requireUserId()
  const recipeId = crypto.randomUUID()
  const payload = buildRecipeInsertPayload(input, userId, recipeId)

  const { error } = await supabase.from('recipes').insert({
    ...payload,
    forked_from_recipe_id: sourceRecipeId,
  })
  if (error) throw new Error(error.message)

  await replaceRecipeIngredients(recipeId, userId, input.ingredients)
  const saved = await fetchRecipe(recipeId)

  if (shareId) {
    await markRecipeShareSaved(shareId, saved.id)
  }

  return saved
}

export async function logRecipe(options: {
  recipeId: string
  servings?: number
  portionUnit?: PortionUnit
  portionQuantity?: number
  servingWeightGrams?: number
  entryDate?: string
  /** IANA timezone used only when entryDate is omitted (defaults to browser TZ). */
  timeZone?: string
  loggedAt?: string
}): Promise<FoodEntry> {
  const recipe = await fetchRecipe(options.recipeId)
  const portionUnit = options.portionUnit ?? 'servings'
  const portionQuantity = validateServingsLogged(
    options.portionQuantity ?? options.servings ?? 1,
  )
  const referenceWeightGrams =
    portionUnit === 'grams'
      ? options.servingWeightGrams ?? recipe.servingWeightGrams
      : recipe.servingWeightGrams

  if (portionUnit === 'grams' && !referenceWeightGrams) {
    throw new Error('Enter a serving weight greater than 0 to log by grams.')
  }

  const effectiveServings =
    portionUnit === 'grams'
      ? portionQuantity / (referenceWeightGrams as number)
      : portionQuantity
  const totals = scaleRecipeToServings(
    recipe.batchTotals,
    recipe.defaultServings,
    effectiveServings,
  )
  const userId = await requireUserId()
  const entryDate =
    options.entryDate ?? todayISOInTimeZone(options.timeZone ?? detectBrowserTimeZone())

  const baseRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    icon: recipe.icon,
    icon_bg: recipe.iconBg,
    icon_color: recipe.iconColor,
    name: recipe.name,
    description: recipe.description,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    caffeine: totals.caffeine,
    entry_date: entryDate,
    servings_logged: portionUnit === 'servings' ? portionQuantity : null,
    portion_unit: portionUnit,
    portion_quantity: portionQuantity,
    reference_weight_grams: referenceWeightGrams,
    ...(options.loggedAt ? { created_at: options.loggedAt } : {}),
  }

  // Prefer linking recipe_id. For shared (non-owned) recipes some policies may reject
  // the foreign key; fall back to a snapshotted entry without the link.
  const withRecipe = await supabase
    .from('food_entries')
    .insert({ ...baseRow, recipe_id: recipe.id })
    .select()
    .single()

  if (!withRecipe.error) return mapRow(withRecipe.data)

  const withoutRecipe = await supabase
    .from('food_entries')
    .insert({ ...baseRow, recipe_id: null })
    .select()
    .single()

  if (withoutRecipe.error) throw new Error(withRecipe.error.message)
  return mapRow(withoutRecipe.data)
}