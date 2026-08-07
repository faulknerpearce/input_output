import { DEFAULT_ICON_COLOR, DEFAULT_ICON_BG } from './icons.js'
import type { ValidationResult } from './validation.js'
import type { Per100gTotals } from './ingredientTotals.js'

export interface Ingredient {
  id: string
  name: string
  description: string
  icon: string
  iconBg: string
  iconColor: string
  per100g: Per100gTotals
  createdAt: string
  updatedAt: string
}

export interface IngredientInput {
  name: string
  description?: string
  icon?: string
  iconBg?: string
  iconColor?: string
  per100g?: Partial<Per100gTotals>
}

export const DEFAULT_INGREDIENT_ICON = 'fa-seedling'

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
}

const PER_100G_FIELDS: readonly (keyof Per100gTotals)[] = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'caffeine',
]

/**
 * Per-100g macros from a scalar row. Used by both the catalog read path and
 * the legacy backfill where macros were entered per an arbitrary line amount.
 */
export function mapPer100gRow(row: {
  per_100g_calories?: number
  per_100g_protein?: number
  per_100g_carbs?: number
  per_100g_fat?: number
  per_100g_fiber?: number
  per_100g_caffeine?: number
}): Per100gTotals {
  return {
    calories: row.per_100g_calories ?? 0,
    protein: row.per_100g_protein ?? 0,
    carbs: row.per_100g_carbs ?? 0,
    fat: row.per_100g_fat ?? 0,
    fiber: row.per_100g_fiber ?? 0,
    caffeine: row.per_100g_caffeine ?? 0,
  }
}

export function mapIngredientRow(row: {
  id: string
  name: string
  description: string
  icon: string
  icon_bg: string
  icon_color: string
  per_100g_calories?: number
  per_100g_protein?: number
  per_100g_carbs?: number
  per_100g_fat?: number
  per_100g_fiber?: number
  per_100g_caffeine?: number
  created_at: string
  updated_at: string
}): Ingredient {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    icon: row.icon,
    iconBg: row.icon_bg,
    iconColor: row.icon_color,
    per100g: mapPer100gRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function validateIngredientInput(
  input: Partial<IngredientInput>,
): ValidationResult<IngredientInput> {
  if (typeof input.name !== 'string' || input.name.trim() === '') {
    return { ok: false, error: 'Ingredient name is required' }
  }

  const per100g: Per100gTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    caffeine: 0,
  }
  for (const field of PER_100G_FIELDS) {
    const value = input.per100g?.[field]
    if (value !== undefined && !isNonNegativeInt(value)) {
      return {
        ok: false,
        error: `${field[0].toUpperCase()}${field.slice(1)} (per 100g) must be a non-negative integer`,
      }
    }
    if (value !== undefined) per100g[field] = value
  }

  return {
    ok: true,
    value: {
      name: input.name.trim(),
      description:
        typeof input.description === 'string' ? input.description.trim() : '',
      icon: typeof input.icon === 'string' ? input.icon : DEFAULT_INGREDIENT_ICON,
      iconBg: typeof input.iconBg === 'string' ? input.iconBg : DEFAULT_ICON_BG,
      iconColor: typeof input.iconColor === 'string' ? input.iconColor : DEFAULT_ICON_COLOR,
      per100g,
    },
  }
}

export function buildIngredientInsertPayload(
  input: IngredientInput,
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
  per_100g_calories: number
  per_100g_protein: number
  per_100g_carbs: number
  per_100g_fat: number
  per_100g_fiber: number
  per_100g_caffeine: number
} {
  const validated = validateIngredientInput(input)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    id,
    user_id: userId,
    name: value.name,
    description: value.description ?? '',
    ...iconColumns(value),
    ...per100gColumns(value),
  }
}

export function buildIngredientUpdatePayload(input: IngredientInput): {
  name: string
  description: string
  icon: string
  icon_bg: string
  icon_color: string
  per_100g_calories: number
  per_100g_protein: number
  per_100g_carbs: number
  per_100g_fat: number
  per_100g_fiber: number
  per_100g_caffeine: number
  updated_at: string
} {
  const validated = validateIngredientInput(input)
  if (!validated.ok) throw new Error(validated.error)
  const value = validated.value

  return {
    name: value.name,
    description: value.description ?? '',
    ...iconColumns(value),
    ...per100gColumns(value),
    updated_at: new Date().toISOString(),
  }
}

function iconColumns(value: IngredientInput) {
  return {
    icon: value.icon ?? DEFAULT_INGREDIENT_ICON,
    icon_bg: value.iconBg ?? DEFAULT_ICON_BG,
    icon_color: value.iconColor ?? DEFAULT_ICON_COLOR,
  }
}

function per100gColumns(value: IngredientInput) {
  const per100g = value.per100g ?? {}
  return {
    per_100g_calories: per100g.calories ?? 0,
    per_100g_protein: per100g.protein ?? 0,
    per_100g_carbs: per100g.carbs ?? 0,
    per_100g_fat: per100g.fat ?? 0,
    per_100g_fiber: per100g.fiber ?? 0,
    per_100g_caffeine: per100g.caffeine ?? 0,
  }
}