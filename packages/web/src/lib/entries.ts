import {
  buildForkEntryInput,
  buildInsertPayload,
  buildPortionPayload,
  buildUpdatePayload,
  mapRow,
  offsetDateISO,
  parseEntryInput,
  parsePortionMeta,
  sumTotals,
  todayISO,
  type FoodEntry,
  type FoodEntryWrite,
  type Totals,
} from '@input_output/shared'
import { markEntryShareSaved } from './sharing'
import { supabase } from './supabase'

export type { FoodEntry, FoodEntryWrite }

export interface DaySummary {
  date: string
  entries: FoodEntry[]
  totals: Totals
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

export const FOOD_ENTRY_DELETE_FORBIDDEN =
  'Entry not found or you do not have permission to delete it'

export async function fetchEntries(date: string = todayISO()): Promise<FoodEntry[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export async function fetchDaySummaries(daysBack = 30): Promise<DaySummary[]> {
  const userId = await requireUserId()
  const today = todayISO()
  const startDate = offsetDateISO(daysBack)

  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', startDate)
    .lte('entry_date', today)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const byDate = new Map<string, FoodEntry[]>()
  for (const row of data ?? []) {
    const date = row.entry_date
    const list = byDate.get(date) ?? []
    list.push(mapRow(row))
    byDate.set(date, list)
  }

  if (!byDate.has(today)) {
    byDate.set(today, [])
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      date,
      entries,
      totals: sumTotals(entries),
    }))
}

export async function addEntry(
  input: FoodEntryWrite,
  options?: { entryDate?: string },
): Promise<FoodEntry> {
  const userId = await requireUserId()
  const parsed = parseEntryInput(input as Record<string, unknown>)
  if (!parsed.ok) throw new Error(parsed.error)

  const portion = parsePortionMeta(input as Record<string, unknown>)
  const entry = {
    ...buildInsertPayload(parsed.value, crypto.randomUUID(), userId),
    entry_date: options?.entryDate ?? todayISO(),
    ...(input.loggedAt ? { created_at: input.loggedAt } : {}),
    ...(portion ? buildPortionPayload(portion) : {}),
  }
  const { data, error } = await supabase.from('food_entries').insert(entry).select().single()
  if (error) throw new Error(error.message)
  return mapRow(data)
}

export async function updateEntry(id: string, input: FoodEntryWrite): Promise<FoodEntry> {
  const parsed = parseEntryInput(input as Record<string, unknown>)
  if (!parsed.ok) throw new Error(parsed.error)

  const { data, error } = await supabase
    .from('food_entries')
    .update({
      ...buildUpdatePayload(parsed.value),
      ...(input.loggedAt ? { created_at: input.loggedAt } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data)
}

export async function deleteEntry(id: string): Promise<void> {
  const { data, error } = await supabase.from('food_entries').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error(FOOD_ENTRY_DELETE_FORBIDDEN)
}

export async function forkEntry(foodEntryId: string, shareId?: string): Promise<FoodEntry> {
  const { data: row, error: fetchError } = await supabase
    .from('food_entries')
    .select('*')
    .eq('id', foodEntryId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const source = mapRow(row)
  const input = buildForkEntryInput(source)
  const entry = await addEntry(input, { entryDate: todayISO() })

  if (shareId) {
    await markEntryShareSaved(shareId, entry.id)
  }

  return entry
}
