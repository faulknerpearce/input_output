import { describe, expect, it } from 'vitest'
import type { RecipeSummary } from '@input_output/shared'
import {
  filterAndSortRecipes,
  filterRecipesForPicker,
  recipeMatchesQuery,
  recipeOptionLabel,
  sortRecipesByName,
} from '../lib/recipeFilters'

const emptyTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  caffeine: 0,
}

function recipe(
  partial: Partial<RecipeSummary> & Pick<RecipeSummary, 'id' | 'name'>,
): RecipeSummary {
  return {
    description: '',
    icon: 'fa-utensils',
    iconBg: '#f4f4f5',
    iconColor: '#71717a',
    defaultServings: 1,
    servingWeightGrams: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    batchTotals: emptyTotals,
    perServingTotals: emptyTotals,
    ingredientCount: 1,
    ...partial,
  }
}

describe('recipeMatchesQuery', () => {
  it('matches recipe name and description', () => {
    const item = recipe({ id: '1', name: 'Overnight Oats', description: 'High fiber breakfast' })
    expect(recipeMatchesQuery(item, 'oats')).toBe(true)
    expect(recipeMatchesQuery(item, 'fiber')).toBe(true)
    expect(recipeMatchesQuery(item, 'pizza')).toBe(false)
  })
})

describe('filterAndSortRecipes', () => {
  const items = [
    recipe({
      id: '1',
      name: 'Beta Bowl',
      updatedAt: '2026-06-02T00:00:00Z',
      perServingTotals: { ...emptyTotals, calories: 500 },
      ingredientCount: 4,
    }),
    recipe({
      id: '2',
      name: 'Alpha Salad',
      updatedAt: '2026-06-03T00:00:00Z',
      perServingTotals: { ...emptyTotals, calories: 300 },
      ingredientCount: 6,
    }),
    recipe({
      id: '3',
      name: 'Gamma Shake',
      updatedAt: '2026-06-01T00:00:00Z',
      perServingTotals: { ...emptyTotals, calories: 700 },
      ingredientCount: 2,
    }),
  ]

  it('sorts by calories descending', () => {
    const result = filterAndSortRecipes(items, '', 'calories-desc')
    expect(result.map((item) => item.perServingTotals.calories)).toEqual([700, 500, 300])
  })

  it('sorts by ingredient count ascending', () => {
    const result = filterAndSortRecipes(items, '', 'ingredients-asc')
    expect(result.map((item) => item.ingredientCount)).toEqual([2, 4, 6])
  })
})

describe('sortRecipesByName', () => {
  it('returns recipes in case-insensitive alphabetical order', () => {
    const items = [
      recipe({ id: '1', name: 'Zucchini Bowl' }),
      recipe({ id: '2', name: 'apple crisp' }),
      recipe({ id: '3', name: 'Mango Shake' }),
    ]

    expect(sortRecipesByName(items).map((item) => item.name)).toEqual([
      'apple crisp',
      'Mango Shake',
      'Zucchini Bowl',
    ])
  })
})

describe('filterRecipesForPicker', () => {
  const items = [
    recipe({ id: '1', name: 'Apple Crisp' }),
    recipe({ id: '2', name: 'Apricot Bowl' }),
    recipe({ id: '3', name: 'Banana Tart' }),
  ]

  it('returns all recipes alphabetically when the query is empty', () => {
    expect(filterRecipesForPicker(items, '').map((item) => item.name)).toEqual([
      'Apple Crisp',
      'Apricot Bowl',
      'Banana Tart',
    ])
  })

  it('ranks prefix matches ahead of substring matches', () => {
    expect(filterRecipesForPicker(items, 'a').map((item) => item.name)).toEqual([
      'Apple Crisp',
      'Apricot Bowl',
      'Banana Tart',
    ])
  })
})

describe('recipeOptionLabel', () => {
  it('includes calories per serving', () => {
    const item = recipe({
      id: '1',
      name: 'Overnight Oats',
      perServingTotals: { ...emptyTotals, calories: 420 },
    })

    expect(recipeOptionLabel(item)).toBe('Overnight Oats (420 kcal/serving)')
  })
})
