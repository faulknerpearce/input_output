import { describe, expect, it } from 'vitest'
import type { WorkoutSummary } from '@input_output/shared'
import { filterAndSortWorkouts, workoutMatchesQuery } from '../lib/workoutFilters'

function workout(
  partial: Partial<WorkoutSummary> & Pick<WorkoutSummary, 'id' | 'name'>,
): WorkoutSummary {
  return {
    description: '',
    icon: 'fa-dumbbell',
    iconBg: '#f0f8f4',
    iconColor: '#0d9488',
    defaultDurationMinutes: 30,
    defaultCalories: 200,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    exerciseCount: 1,
    ...partial,
  }
}

describe('workoutMatchesQuery', () => {
  it('matches name and description case-insensitively', () => {
    const item = workout({ id: '1', name: 'Upper Body', description: 'Push focus' })
    expect(workoutMatchesQuery(item, 'upper')).toBe(true)
    expect(workoutMatchesQuery(item, 'push')).toBe(true)
    expect(workoutMatchesQuery(item, 'legs')).toBe(false)
  })
})

describe('filterAndSortWorkouts', () => {
  const items = [
    workout({ id: '1', name: 'Beta', updatedAt: '2026-06-02T00:00:00Z', exerciseCount: 2 }),
    workout({ id: '2', name: 'Alpha', updatedAt: '2026-06-03T00:00:00Z', exerciseCount: 5 }),
    workout({ id: '3', name: 'Gamma', updatedAt: '2026-06-01T00:00:00Z', exerciseCount: 1 }),
  ]

  it('filters by query and sorts by name ascending', () => {
    const result = filterAndSortWorkouts(items, 'a', 'name-asc')
    expect(result.map((item) => item.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('sorts by exercise count descending', () => {
    const result = filterAndSortWorkouts(items, '', 'exercises-desc')
    expect(result.map((item) => item.exerciseCount)).toEqual([5, 2, 1])
  })

  it('sorts by updated date descending', () => {
    const result = filterAndSortWorkouts(items, '', 'updated-desc')
    expect(result.map((item) => item.id)).toEqual(['2', '1', '3'])
  })
})
