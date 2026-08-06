import {
  DEFAULT_NUTRITION_GOALS,
  type GoalRange,
  type NutritionGoals,
} from '@input_output/shared'

export type GoalKey = keyof NutritionGoals

export const GOAL_FIELDS: {
  key: GoalKey
  label: string
  unit: string
  showRange: boolean
}[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', showRange: true },
  { key: 'protein', label: 'Protein', unit: 'g', showRange: true },
  { key: 'carbs', label: 'Carbs', unit: 'g', showRange: false },
  { key: 'fat', label: 'Fat', unit: 'g', showRange: false },
  { key: 'fiber', label: 'Fiber', unit: 'g', showRange: false },
  { key: 'caffeine', label: 'Caffeine', unit: 'mg', showRange: false },
]

export function normalizeGoals(source: NutritionGoals): NutritionGoals {
  const next = structuredClone(source)
  for (const { key, showRange } of GOAL_FIELDS) {
    if (!showRange) {
      next[key] = { value: next[key].value, low: next[key].value, high: next[key].value }
    }
    if (key === 'caffeine') {
      next.caffeine = {
        value: next.caffeine.value,
        low: 0,
        high: Math.max(next.caffeine.value, next.caffeine.high),
      }
    }
  }
  return next
}

export function defaultGoalsForm(): NutritionGoals {
  return structuredClone(DEFAULT_NUTRITION_GOALS)
}

export function parseGoalField(value: string): number {
  if (value.trim() === '') return NaN
  return parseInt(value, 10)
}

export type { GoalRange }