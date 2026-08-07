import {
  buildIngredientInsertPayload,
  buildIngredientUpdatePayload,
  mapIngredientRow,
  validateIngredientInput,
  type Ingredient,
  type IngredientInput,
} from '@input_output/shared'
import type { InputOutputSupabase } from './supabase.js'
import { requireUserId } from './toolHandlers.js'

export type IngredientToolArgs = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

function parsePer100g(args: IngredientToolArgs): Partial<IngredientInput['per100g']> {
  const nested = isRecord(args.per100g) ? args.per100g : {}
  const read = (key: string): number | undefined => {
    const value = nested[key] ?? args[key]
    return optNonNegativeInt(value)
  }
  return {
    calories: read('calories'),
    protein: read('protein'),
    carbs: read('carbs'),
    fat: read('fat'),
    fiber: read('fiber'),
    caffeine: read('caffeine'),
  }
}

function parseIngredientInput(args: IngredientToolArgs): IngredientInput {
  return {
    name: typeof args.name === 'string' ? args.name : '',
    description: typeof args.description === 'string' ? args.description : '',
    icon: typeof args.icon === 'string' ? args.icon : undefined,
    iconBg: typeof args.iconBg === 'string' ? args.iconBg : undefined,
    iconColor: typeof args.iconColor === 'string' ? args.iconColor : undefined,
    per100g: parsePer100g(args),
  }
}

export async function listIngredients(supabase: InputOutputSupabase): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapIngredientRow)
}

export async function getIngredient(
  supabase: InputOutputSupabase,
  ingredientId: string,
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', ingredientId)
    .single()
  if (error) throw error
  return mapIngredientRow(data)
}

export async function saveIngredient(
  supabase: InputOutputSupabase,
  args: IngredientToolArgs,
): Promise<Ingredient> {
  const input = parseIngredientInput(args)
  const validated = validateIngredientInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const userId = await requireUserId(supabase)
  const ingredientId =
    typeof args.id === 'string' && args.id !== '' ? args.id : crypto.randomUUID()

  if (typeof args.id === 'string' && args.id !== '') {
    const { error } = await supabase
      .from('ingredients')
      .update(buildIngredientUpdatePayload(validated.value))
      .eq('id', ingredientId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('ingredients')
      .insert(buildIngredientInsertPayload(validated.value, userId, ingredientId))
    if (error) throw error
  }

  return getIngredient(supabase, ingredientId)
}

export async function deleteIngredient(
  supabase: InputOutputSupabase,
  ingredientId: string,
) {
  const { error } = await supabase.from('ingredients').delete().eq('id', ingredientId)
  if (error) throw error
  return { ok: true as const }
}