import {
  buildRecipeIngredientInsertPayload,
  buildRecipeInsertPayload,
  mapRecipeIngredientRow,
  mapRecipeRow,
  mapRow,
  parseLogDate,
  perServingTotals,
  scaleRecipeToServings,
  sumRecipeIngredients,
  todayISOInTimeZone,
  validateRecipeInput,
  validateServingsLogged,
  type RecipeInput,
  type RecipeSummary,
  type RecipeWithIngredients,
} from '@input_output/shared'
import type { InputOutputSupabase } from './supabase.js'
import { fetchUserTimeZone } from './toolHandlers.js'
import { requireUserId } from './toolHandlers.js'

export type RecipeToolArgs = Record<string, unknown>

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

export async function listRecipes(supabase: InputOutputSupabase): Promise<RecipeSummary[]> {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  if (!recipes?.length) return []

  const { data: ingredients, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in(
      'recipe_id',
      recipes.map((recipe) => recipe.id),
    )
    .order('sort_order', { ascending: true })
  if (ingredientError) throw ingredientError

  const ingredientsByRecipe = new Map<string, ReturnType<typeof mapRecipeIngredientRow>[]>()
  for (const row of ingredients ?? []) {
    const mapped = mapRecipeIngredientRow(row)
    const list = ingredientsByRecipe.get(row.recipe_id) ?? []
    list.push(mapped)
    ingredientsByRecipe.set(row.recipe_id, list)
  }

  return recipes.map((row) => toSummary(mapRecipeRow(row), ingredientsByRecipe.get(row.id) ?? []))
}

export async function getRecipe(
  supabase: InputOutputSupabase,
  recipeId: string,
): Promise<RecipeWithIngredients> {
  const { data: recipeRow, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single()
  if (error) throw error

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('sort_order', { ascending: true })
  if (ingredientError) throw ingredientError

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
  supabase: InputOutputSupabase,
  recipeId: string,
  userId: string,
  ingredients: RecipeInput['ingredients'],
) {
  const { error: deleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
  if (deleteError) throw deleteError

  if (ingredients.length === 0) return

  const rows = ingredients.map((ingredient, index) =>
    buildRecipeIngredientInsertPayload(
      recipeId,
      userId,
      { ...ingredient, sortOrder: index },
      crypto.randomUUID(),
    ),
  )

  const { error: insertError } = await supabase.from('recipe_ingredients').insert(rows)
  if (insertError) throw insertError
}

function parseRecipeInput(args: RecipeToolArgs): RecipeInput {
  const ingredients = Array.isArray(args.ingredients) ? args.ingredients : []
  const servingWeightRaw = args.servingWeightGrams ?? args.serving_weight_grams
  const servingWeightGrams =
    servingWeightRaw === null || servingWeightRaw === undefined
      ? undefined
      : typeof servingWeightRaw === 'number'
        ? servingWeightRaw
        : typeof servingWeightRaw === 'string' && servingWeightRaw.trim() !== ''
          ? Number.parseFloat(servingWeightRaw)
          : undefined

  return {
    name: typeof args.name === 'string' ? args.name : '',
    description: typeof args.description === 'string' ? args.description : '',
    icon: typeof args.icon === 'string' ? args.icon : undefined,
    iconBg: typeof args.iconBg === 'string' ? args.iconBg : undefined,
    iconColor: typeof args.iconColor === 'string' ? args.iconColor : undefined,
    defaultServings:
      typeof args.defaultServings === 'number'
        ? args.defaultServings
        : typeof args.default_servings === 'number'
          ? args.default_servings
          : undefined,
    servingWeightGrams:
      servingWeightGrams !== undefined && Number.isFinite(servingWeightGrams)
        ? servingWeightGrams
        : servingWeightRaw === null
          ? null
          : undefined,
    ingredients: ingredients as RecipeInput['ingredients'],
  }
}

export async function saveRecipe(
  supabase: InputOutputSupabase,
  args: RecipeToolArgs,
): Promise<RecipeWithIngredients> {
  const input = parseRecipeInput(args)
  const validated = validateRecipeInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const userId = await requireUserId(supabase)
  const recipeId =
    typeof args.id === 'string' && args.id !== '' ? args.id : crypto.randomUUID()
  const payload = buildRecipeInsertPayload(validated.value, userId, recipeId)

  if (typeof args.id === 'string' && args.id !== '') {
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
    if (error) throw error
  } else {
    const { error } = await supabase.from('recipes').insert(payload)
    if (error) throw error
  }

  await replaceRecipeIngredients(supabase, recipeId, userId, validated.value.ingredients)
  return getRecipe(supabase, recipeId)
}

export async function deleteRecipe(supabase: InputOutputSupabase, recipeId: string) {
  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
  if (error) throw error
  return { ok: true as const }
}

export async function logRecipeEntry(supabase: InputOutputSupabase, args: RecipeToolArgs) {
  if (typeof args.recipeId !== 'string' && typeof args.recipe_id !== 'string') {
    throw new Error('recipeId is required')
  }
  const recipeId =
    typeof args.recipeId === 'string' ? args.recipeId : (args.recipe_id as string)
  const recipe = await getRecipe(supabase, recipeId)
  const portionUnit = args.portionUnit === 'grams' ? 'grams' : 'servings'
  const portionQuantity = validateServingsLogged(args.portionQuantity ?? args.servings ?? 1)

  if (portionUnit === 'grams' && !recipe.servingWeightGrams) {
    throw new Error(
      'This recipe has no serving weight. Log by servings or add a serving weight in the recipe editor.',
    )
  }

  const effectiveServings =
    portionUnit === 'grams'
      ? portionQuantity / (recipe.servingWeightGrams as number)
      : portionQuantity
  const totals = scaleRecipeToServings(
    recipe.batchTotals,
    recipe.defaultServings,
    effectiveServings,
  )
  const userId = await requireUserId(supabase)
  const timeZone = await fetchUserTimeZone(supabase)
  const dateParsed = parseLogDate(args.date, {
    fallback: todayISOInTimeZone(timeZone),
    timeZone,
  })
  if (!dateParsed.ok) throw new Error(dateParsed.error)

  const { data, error } = await supabase
    .from('food_entries')
    .insert({
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
      entry_date: dateParsed.value,
      recipe_id: recipe.id,
      servings_logged: portionUnit === 'servings' ? portionQuantity : null,
      portion_unit: portionUnit,
      portion_quantity: portionQuantity,
      reference_weight_grams: recipe.servingWeightGrams,
    })
    .select()
    .single()
  if (error) throw error
  return mapRow(data)
}