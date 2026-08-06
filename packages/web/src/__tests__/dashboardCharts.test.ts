import { describe, expect, it } from 'vitest'
import { computeNetBalance } from '@input_output/shared'
import {
  macroCalorieSplit,
  macroTotalCalories,
  netRingProgress,
  ringProgress,
} from '../lib/dashboardCharts'

describe('ringProgress', () => {
  it('computes percentage toward a goal', () => {
    expect(ringProgress(50, 100)).toEqual({ pct: 50, capped: 50, overGoal: false })
  })

  it('caps progress at 100% and flags over-goal values', () => {
    expect(ringProgress(150, 100)).toEqual({ pct: 150, capped: 100, overGoal: true })
  })

  it('handles a zero goal safely', () => {
    expect(ringProgress(100, 0)).toEqual({ pct: 0, capped: 0, overGoal: false })
  })
})

describe('netRingProgress', () => {
  it('uses net calories against the high goal', () => {
    const balance = computeNetBalance(2500, 200, 2800, 3200)
    expect(netRingProgress(balance)).toEqual({ pct: 72, capped: 71.875, overGoal: false })
  })
})

describe('macroCalorieSplit', () => {
  it('converts macro grams into calorie segments', () => {
    const segments = macroCalorieSplit({
      calories: 500,
      protein: 25,
      carbs: 50,
      fat: 10,
      caffeine: 0,
      fiber: 5,
    })

    expect(segments).toEqual([
      { label: 'Protein', grams: 25, calories: 100, color: '#059669' },
      { label: 'Carbs', grams: 50, calories: 200, color: '#d97706' },
      { label: 'Fat', grams: 10, calories: 90, color: '#db2777' },
    ])
    expect(macroTotalCalories(segments)).toBe(390)
  })
})
