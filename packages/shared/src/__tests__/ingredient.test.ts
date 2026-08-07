import { describe, expect, it } from 'vitest'
import {
  buildIngredientInsertPayload,
  buildIngredientUpdatePayload,
  mapIngredientRow,
  validateIngredientInput,
} from '../ingredient.js'
import {
  parseGramsFromAmount,
  per100gFromGrams,
  scaleMacrosToGrams,
} from '../ingredientTotals.js'

describe('ingredient', () => {
  it('maps a row to an ingredient with per-100g macros', () => {
    const row = {
      id: '1',
      name: 'Chicken breast',
      description: 'Raw',
      icon: 'fa-seedling',
      icon_bg: '#f4f4f5',
      icon_color: '#52525b',
      per_100g_calories: 165,
      per_100g_protein: 31,
      per_100g_carbs: 0,
      per_100g_fat: 3,
      per_100g_fiber: 0,
      per_100g_caffeine: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const ing2 = mapIngredientRow(row)
    expect(ing2.per100g).toEqual({ calories: 165, protein: 31, carbs: 0, fat: 3, fiber: 0, caffeine: 0 })
    expect(ing2.icon).toBe('fa-seedling')
  })

  it('requires a name', () => {
    const res = validateIngredientInput({ name: '' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Ingredient name is required')
  })

  it('rejects negative per-100g macros and accepts valid input', () => {
    expect(validateIngredientInput({ name: 'x', per100g: { calories: -1 } }).ok).toBe(false)
    const ok = validateIngredientInput({ name: 'x', per100g: { calories: 100, protein: 20 } })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.value.per100g).toMatchObject({ calories: 100, protein: 20, carbs: 0 })
    }
  })

  it('builds insert and update payloads with defaults', () => {
    const insert = buildIngredientInsertPayload({ name: 'Rice' }, 'u1', 'id1')
    expect(insert.user_id).toBe('u1')
    expect(insert.name).toBe('Rice')
    expect(insert.icon).toBe('fa-seedling')
    expect(insert.per_100g_calories).toBe(0)

    const update = buildIngredientUpdatePayload({ name: 'Rice', per100g: { fat: 5 } })
    expect(update.per_100g_fat).toBe(5)
    expect(typeof update.updated_at).toBe('string')
  })
})

describe('ingredientTotals', () => {
  it('scales per-100g macros to grams', () => {
    const totals = scaleMacrosToGrams({ calories: 100, protein: 20, carbs: 0, fat: 0, fiber: 0, caffeine: 0 }, 150)
    expect(totals).toEqual({ calories: 150, protein: 30, carbs: 0, caffeine: 0, fat: 0, fiber: 0 })
  })

  it('scales to zero grams and throws on negative/invalid grams', () => {
    expect(scaleMacrosToGrams({ calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, caffeine: 0 }, 0).calories).toBe(0)
    expect(() => scaleMacrosToGrams({ calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, caffeine: 0 }, -1)).toThrow()
  })

  it('derives per-100g macros from a gram-line', () => {
    expect(per100gFromGrams({ calories: 150, protein: 30, carbs: 0, caffeine: 0, fat: 0, fiber: 0 }, 150)).toEqual(
      { calories: 100, protein: 20, carbs: 0, fat: 0, fiber: 0, caffeine: 0 },
    )
  })

  it('parses gram amounts', () => {
    expect(parseGramsFromAmount('150g')).toBe(150)
    expect(parseGramsFromAmount('150 g')).toBe(150)
    expect(parseGramsFromAmount('1 tsp')).toBeNull()
    expect(parseGramsFromAmount('1 cup')).toBeNull()
  })
})