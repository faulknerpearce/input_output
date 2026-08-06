import { describe, expect, it } from 'vitest'
import type { FoodEntry } from '@input_output/shared'
import { buildMetricConfigs } from '../lib/metrics'

function entry(partial: Partial<FoodEntry> & Pick<FoodEntry, 'id' | 'name'>): FoodEntry {
  return {
    icon: 'fa-utensils',
    iconBg: '#f4f4f5',
    iconColor: '#71717a',
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    caffeine: 0,
    loggedAt: '2026-06-22T08:00:00Z',
    ...partial,
  }
}

describe('buildMetricConfigs', () => {
  it('builds six nutrition metrics from food entries', () => {
    const configs = buildMetricConfigs([
      entry({ id: '1', name: 'Oats', calories: 300, protein: 12, carbs: 54, fat: 5, fiber: 8 }),
      entry({ id: '2', name: 'Coffee', calories: 5, protein: 0, carbs: 1, fat: 0, caffeine: 95 }),
    ])

    expect(configs).toHaveLength(6)
    expect(configs[0]).toMatchObject({ label: 'Calories', value: 305 })
    expect(configs[1]).toMatchObject({ label: 'Protein', value: 12 })
    expect(configs[5]).toMatchObject({ label: 'Caffeine', value: 95 })
  })

  it('computes remaining amounts against goals', () => {
    const configs = buildMetricConfigs([
      entry({ id: '1', name: 'Chicken', calories: 500, protein: 40, carbs: 0, fat: 10 }),
    ])

    expect(configs[0].remaining(500, 2800)).toBe('2,300 kcal')
    expect(configs[1].remaining(40, 150)).toBe('110 g')
  })
})
