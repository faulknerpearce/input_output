import { describe, expect, it, vi } from 'vitest'
import type { InputOutputSupabase } from '../supabase.js'
import {
  deleteFoodEntry,
  FOOD_ENTRY_DELETE_FORBIDDEN,
  listFoodEntriesForDate,
} from '../toolHandlers.js'

const USER_ID = 'user-123'

function createMockSupabase(options: {
  deleteData?: { id: string }[] | null
  deleteError?: { message: string } | null
  listData?: unknown[]
  listError?: { message: string } | null
}) {
  const eqCalls: [string, string][] = []

  const chain = {
    eq(column: string, value: string) {
      eqCalls.push([column, value])
      return chain
    },
    order() {
      return Promise.resolve({
        data: options.listData ?? [],
        error: options.listError ?? null,
      })
    },
  }

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: USER_ID } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => chain),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(async () => ({
            data: options.deleteData ?? [],
            error: options.deleteError ?? null,
          })),
        })),
      })),
    })),
  } as unknown as InputOutputSupabase

  return { supabase, eqCalls }
}

describe('listFoodEntriesForDate', () => {
  it('scopes queries to the signed-in user', async () => {
    const { supabase, eqCalls } = createMockSupabase({ listData: [] })

    await listFoodEntriesForDate(supabase, '2026-06-27')

    expect(eqCalls).toContainEqual(['user_id', USER_ID])
    expect(eqCalls).toContainEqual(['entry_date', '2026-06-27'])
  })
})

describe('deleteFoodEntry', () => {
  it('succeeds when a row is deleted', async () => {
    const { supabase } = createMockSupabase({
      deleteData: [{ id: 'entry-1' }],
    })

    await expect(deleteFoodEntry(supabase, { id: 'entry-1' })).resolves.toEqual({ ok: true })
  })

  it('throws when no row is deleted', async () => {
    const { supabase } = createMockSupabase({ deleteData: [] })

    await expect(deleteFoodEntry(supabase, { id: 'entry-1' })).rejects.toThrow(
      FOOD_ENTRY_DELETE_FORBIDDEN,
    )
  })
})