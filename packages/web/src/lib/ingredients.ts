import {
  buildIngredientInsertPayload,
  buildIngredientUpdatePayload,
  mapIngredientRow,
  validateIngredientInput,
  type Ingredient,
  type IngredientInput,
} from '@input_output/shared'
import { supabase } from './supabase'

export type { Ingredient, IngredientInput }

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

export async function fetchIngredients(): Promise<Ingredient[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapIngredientRow)
}

export async function addIngredient(input: IngredientInput): Promise<Ingredient> {
  const userId = await requireUserId()
  const validated = validateIngredientInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const payload = buildIngredientInsertPayload(validated.value, userId, crypto.randomUUID())
  const { data, error } = await supabase.from('ingredients').insert(payload).select('*').single()
  if (error) throw new Error(error.message)
  return mapIngredientRow(data)
}

export async function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  await requireUserId()
  const validated = validateIngredientInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const payload = buildIngredientUpdatePayload(validated.value)
  const { data, error } = await supabase
    .from('ingredients')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapIngredientRow(data)
}

export async function deleteIngredient(id: string): Promise<void> {
  await requireUserId()
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}