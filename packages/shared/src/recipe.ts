import { DEFAULT_ICON, DEFAULT_ICON_BG, DEFAULT_ICON_COLOR } from './icons.js'
import type { Totals } from './types.js'
import type { ValidationResult } from './validation.js'

export interface RecipeIngredient {
  id: string
  name: string
  amount: string
  sortOrder: number
  ingredientId?: string | null
  amountGrams?: number | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  caffeine: number
}

export type NewRecipeIngredient = Omit<RecipeIngredient, 'id'>

export interface Recipe {
  id: string
  name: string
  description: string
  icon: string
  iconBg: string
  iconColor: string
  defaultServings: number
  servingWeightGrams: number | null
  createdAt: string
  updatedAt: string
}

export interface RecipeSummary extends Recipe {
  batchTotals: Totals
  perServingTotals: Totals
  ingredientCount: number
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: RecipeIngredient[]
  batchTotals: Totals
  perServingTotals: Totals
}

export interface RecipeInput {
  name: string
  description?: string
  icon?: string
  iconBg?: string
  iconColor?: string
  defaultServings?: number
  servingWeightGrams?: number | null
  ingredients: NewRecipeIngredient[]
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
}

export function mapRecipeRow(row: {
  id: string
  name: string
  description: string
  icon: string
  icon_bg: string
  icon_color: string
  default_servings: number | string
  serving_weight_grams?: number | string | null
  created_at: string
  updated_at: string
}): Recipe {
  const defaultServings =
    typeof row.default_servings === 'number'
      ? row.default_servings
      : Number.parseFloat(String(row.default_servings))
  const servingWeightRaw = row.serving_weight_grams
  const servingWeightGrams =
    servingWeightRaw === null || servingWeightRaw === undefined
      ? null
      : typeof servingWeightRaw === 'number'
        ? servingWeightRaw
        : Number.parseFloat(String(servingWeightRaw))

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    iconBg: row.icon_bg,
    iconColor: row.icon_color,
    defaultServings: Number.isFinite(defaultServings) ? defaultServings : 1,
    servingWeightGrams:
      servingWeightGrams !== null && Number.isFinite(servingWeightGrams) && servingWeightGrams > 0
        ? servingWeightGrams
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapRecipeIngredientRow(row: {
  id: string
  recipe_id?: string
  sort_order: number
  name: string
  amount: string
  ingredient_id?: string | null
  amount_grams?: number | string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  caffeine: number
}): RecipeIngredient {
  const amountGramsRaw = row.amount_grams
  const amountGrams =
    amountGramsRaw === null || amountGramsRaw === undefined || amountGramsRaw === ''
      ? null
      : typeof amountGramsRaw === 'number'
        ? amountGramsRaw
        : Number.parseFloat(String(amountGramsRaw))

  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    sortOrder: row.sort_order,
    ingredientId: row.ingredient_id ?? null,
    amountGrams:
      amountGrams !== null && Number.isFinite(amountGrams) && amountGrams >= 0
        ? amountGrams
        : null,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    caffeine: row.caffeine,
  }
}

export function validateRecipeIngredientInput(
  input: Partial<NewRecipeIngredient>,
): ValidationResult<NewRecipeIngredient> {
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    return { ok: false, error: 'Ingredient name is required' }
  }
  if (!isNonNegativeInt(input.calories)) {
    return { ok: false, error: 'Ingredient calories must be a non-negative integer' }
  }
  if (!isNonNegativeInt(input.protein)) {
    return { ok: false, error: 'Ingredient protein must be a non-negative integer' }
  }
  if (input.carbs !== undefined && !isNonNegativeInt(input.carbs)) {
    return { ok: false, error: 'Ingredient carbs must be a non-negative integer' }
  }
  if (input.fat !== undefined && !isNonNegativeInt(input.fat)) {
    return { ok: false, error: 'Ingredient fat must be a non-negative integer' }
  }
  if (input.fiber !== undefined && !isNonNegativeInt(input.fiber)) {
    return { ok: false, error: 'Ingredient fiber must be a non-negative integer' }
  }
  if (input.caffeine !== undefined && !isNonNegativeInt(input.caffeine)) {
    return { ok: false, error: 'Ingredient caffeine must be a non-negative integer' }
  }

  return {
    ok: true,
    value: {
      name: input.name.trim(),
      amount: typeof input.amount === 'string' ? input.amount.trim() : '',
      sortOrder:
        typeof input.sortOrder === 'number' && Number.isInteger(input.sortOrder)
          ? input.sortOrder
          : 0,
      ingredientId:
        typeof input.ingredientId === 'string' && input.ingredientId.trim() !== ''
          ? input.ingredientId.trim()
          : null,
      amountGrams:
        typeof input.amountGrams === 'number' && input.amountGrams >= 0
          ? input.amountGrams
          : null,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs ?? 0,
      fat: input.fat ?? 0,
      fiber: input.fiber ?? 0,
      caffeine: input.caffeine ?? 0,
    },
  }
}

export function validateRecipeInput(input: RecipeInput): ValidationResult<RecipeInput> {
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    return { ok: false, error: 'Recipe name is required' }
  }
  if (input.name.trim().length > 120) {
    return { ok: false, error: 'Recipe name must be 120 characters or fewer' }
  }

  const defaultServings = input.defaultServings ?? 1
  if (!Number.isFinite(defaultServings) || defaultServings <= 0) {
    return { ok: false, error: 'Default servings must be greater than 0' }
  }

  let servingWeightGrams: number | null = null
  if (input.servingWeightGrams !== undefined && input.servingWeightGrams !== null) {
    if (!Number.isFinite(input.servingWeightGrams) || input.servingWeightGrams <= 0) {
      return { ok: false, error: 'Serving weight must be greater than 0' }
    }
    servingWeightGrams = input.servingWeightGrams
  }

  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    return { ok: false, error: 'At least one ingredient is required' }
  }

  const ingredients: NewRecipeIngredient[] = []
  for (const ingredient of input.ingredients) {
    const validated = validateRecipeIngredientInput(ingredient)
    if (!validated.ok) return validated
    ingredients.push(validated.value)
  }

  return {
    ok: true,
    value: {
      name: input.name.trim(),
      description: typeof input.description === 'string' ? input.description.trim() : '',
      icon: typeof input.icon === 'string' ? input.icon : DEFAULT_ICON,
      iconBg: typeof input.iconBg === 'string' ? input.iconBg : DEFAULT_ICON_BG,
      iconColor: typeof input.iconColor === 'string' ? input.iconColor : DEFAULT_ICON_COLOR,
      defaultServings,
      servingWeightGrams,
      ingredients,
    },
  }
}

export function buildRecipeInsertPayload(
  input: RecipeInput,
  userId: string,
  id?: string,
): {
  id?: string
  user_id: string
  name: string
  description: string
  icon: string
  icon_bg: string
  icon_color: string
  default_servings: number
  serving_weight_grams: number | null
} {
  const validated = validateRecipeInput(input)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    id,
    user_id: userId,
    name: value.name,
    description: value.description ?? '',
    icon: value.icon ?? DEFAULT_ICON,
    icon_bg: value.iconBg ?? DEFAULT_ICON_BG,
    icon_color: value.iconColor ?? DEFAULT_ICON_COLOR,
    default_servings: value.defaultServings ?? 1,
    serving_weight_grams: value.servingWeightGrams ?? null,
  }
}

export function buildRecipeIngredientInsertPayload(
  recipeId: string,
  userId: string,
  ingredient: NewRecipeIngredient,
  id?: string,
): {
  id?: string
  recipe_id: string
  user_id: string
  sort_order: number
  name: string
  amount: string
  ingredient_id: string | null
  amount_grams: number | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  caffeine: number
} {
  const validated = validateRecipeIngredientInput(ingredient)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    id,
    recipe_id: recipeId,
    user_id: userId,
    sort_order: value.sortOrder,
    name: value.name,
    amount: value.amount,
    ingredient_id: value.ingredientId ?? null,
    amount_grams: value.amountGrams ?? null,
    calories: value.calories,
    protein: value.protein,
    carbs: value.carbs,
    fat: value.fat,
    fiber: value.fiber,
    caffeine: value.caffeine,
  }
}