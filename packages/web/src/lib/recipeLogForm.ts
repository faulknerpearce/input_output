import {
  currentTimeInputValue,
  loggedAtFromDayAndTime,
  scaleRecipeToServings,
  todayISOInTimeZone,
  type PortionUnit,
  type RecipeSummary,
  type Totals,
} from '@input_output/shared'

export interface RecipeLogFieldValues {
  entryDate: string
  logTime: string
  portionUnit: PortionUnit
  portionQuantity: string
  /** Grams that equal one recipe serving. Prefills from recipe; editable so grams logging always works. */
  servingWeightGrams: string
}

export interface RecipeLogSubmitOptions {
  portionUnit: PortionUnit
  portionQuantity: number
  entryDate: string
  loggedAt: string
  /** Present when logging by grams (recipe weight or user-entered weight of one serving). */
  servingWeightGrams?: number
}

export function defaultRecipeLogFieldValues(
  timeZone: string,
  recipe?: RecipeSummary | null,
): RecipeLogFieldValues {
  return {
    entryDate: todayISOInTimeZone(timeZone),
    logTime: currentTimeInputValue(timeZone),
    portionUnit: 'servings',
    portionQuantity: '1',
    servingWeightGrams: recipe?.servingWeightGrams ? String(recipe.servingWeightGrams) : '',
  }
}

export function servingWeightFromValues(values: RecipeLogFieldValues): number | null {
  const n = Number.parseFloat(values.servingWeightGrams)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function recipeLogHelperText(
  recipe: RecipeSummary | null | undefined,
  values: RecipeLogFieldValues,
): string {
  if (!recipe) return 'Select a recipe to log.'
  const batch = `Recipe makes ${recipe.defaultServings} servings per batch (${recipe.perServingTotals.calories} kcal per serving)`
  const weight = servingWeightFromValues(values)
  if (weight) {
    return `${batch} · 1 serving = ${weight}g.`
  }
  return `${batch}. Enter the weight of one serving below to log by grams.`
}

export function computeRecipeLogPreview(
  recipe: RecipeSummary | null | undefined,
  values: RecipeLogFieldValues,
): Totals | null {
  if (!recipe) return null
  const quantity = Number.parseFloat(values.portionQuantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  const unit: PortionUnit = values.portionUnit === 'grams' ? 'grams' : 'servings'
  const servingWeight = servingWeightFromValues(values)

  let effectiveServings: number
  if (unit === 'grams') {
    if (!servingWeight) return null
    effectiveServings = quantity / servingWeight
  } else {
    effectiveServings = quantity
  }

  if (!Number.isFinite(effectiveServings) || effectiveServings <= 0) return null
  return scaleRecipeToServings(recipe.batchTotals, recipe.defaultServings, effectiveServings)
}

export function validateRecipeLogFields(
  recipe: RecipeSummary | null | undefined,
  values: RecipeLogFieldValues,
  timeZone: string,
): { ok: true; value: RecipeLogSubmitOptions } | { ok: false; error: string } {
  if (!recipe) {
    return { ok: false, error: 'Select a recipe' }
  }

  const unit: PortionUnit = values.portionUnit === 'grams' ? 'grams' : 'servings'
  const servingWeight = servingWeightFromValues(values)

  if (unit === 'grams' && !servingWeight) {
    return {
      ok: false,
      error: 'Enter the weight of one serving (g) to log by grams.',
    }
  }

  const quantity = Number.parseFloat(values.portionQuantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      ok: false,
      error: unit === 'grams' ? 'Weight must be greater than 0' : 'Servings must be greater than 0',
    }
  }

  if (!values.entryDate) {
    return { ok: false, error: 'Log date is required' }
  }

  const loggedAt = loggedAtFromDayAndTime(values.entryDate, values.logTime, timeZone)
  if (!loggedAt.ok) {
    return { ok: false, error: loggedAt.error }
  }

  return {
    ok: true,
    value: {
      portionUnit: unit,
      portionQuantity: quantity,
      entryDate: values.entryDate,
      loggedAt: loggedAt.value,
      servingWeightGrams: unit === 'grams' ? (servingWeight ?? undefined) : undefined,
    },
  }
}
