import type { WorkoutSummary } from '@input_output/shared'

export type WorkoutSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'exercises-desc'
  | 'exercises-asc'

export const WORKOUT_SORT_OPTIONS: { value: WorkoutSortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'updated-asc', label: 'Oldest first' },
  { value: 'exercises-desc', label: 'Most exercises' },
  { value: 'exercises-asc', label: 'Fewest exercises' },
]

export function workoutMatchesQuery(workout: WorkoutSummary, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    workout.name.toLowerCase().includes(normalized) ||
    workout.description.toLowerCase().includes(normalized)
  )
}

function compareWorkouts(a: WorkoutSummary, b: WorkoutSummary, sort: WorkoutSortOption): number {
  switch (sort) {
    case 'name-asc':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    case 'name-desc':
      return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    case 'updated-desc':
      return b.updatedAt.localeCompare(a.updatedAt)
    case 'updated-asc':
      return a.updatedAt.localeCompare(b.updatedAt)
    case 'exercises-desc':
      return b.exerciseCount - a.exerciseCount
    case 'exercises-asc':
      return a.exerciseCount - b.exerciseCount
    default:
      return 0
  }
}

export function filterAndSortWorkouts(
  workouts: WorkoutSummary[],
  query: string,
  sort: WorkoutSortOption,
): WorkoutSummary[] {
  return workouts
    .filter((workout) => workoutMatchesQuery(workout, query))
    .sort((a, b) => compareWorkouts(a, b, sort))
}