import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkoutSummary, WorkoutWithExercises } from '@input_output/shared'
import CatalogRow from '../components/layout/CatalogRow'
import { PageLoading } from '../components/layout/PageState'
import ZoneButton from '../components/layout/ZoneButton'
import { EmptyState } from '../components/ui'
import LogWorkoutModal from '../components/LogWorkoutModal'
import ShareModal from '../components/ShareModal'
import WorkoutEditorModal from '../components/WorkoutEditorModal'
import WorkoutViewModal from '../components/WorkoutViewModal'
import {
  filterAndSortWorkouts,
  WORKOUT_SORT_OPTIONS,
  type WorkoutSortOption,
} from '../lib/workoutFilters'
import {
  deleteWorkout,
  fetchWorkoutSummaries,
  logWorkout,
  saveWorkout,
} from '../lib/workouts'
import { inputBase } from '../lib/styles'

interface WorkoutsPageProps {
  onOpenCreateReady?: (openCreate: () => void) => void
}

export default function WorkoutsPage({ onOpenCreateReady }: WorkoutsPageProps) {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutWithExercises | null | undefined>(
    undefined,
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loggingWorkout, setLoggingWorkout] = useState<WorkoutSummary | null>(null)
  const [viewingWorkoutId, setViewingWorkoutId] = useState<string | null>(null)
  const [logSuccess, setLogSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<WorkoutSortOption>('name-asc')
  const [sharingWorkout, setSharingWorkout] = useState<{ id: string; name: string } | null>(null)

  const visibleWorkouts = useMemo(
    () => filterAndSortWorkouts(workouts, searchQuery, sortBy),
    [workouts, searchQuery, sortBy],
  )
  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'name-asc'

  const loadWorkouts = async () => {
    const data = await fetchWorkoutSummaries()
    setWorkouts(data)
  }

  useEffect(() => {
    fetchWorkoutSummaries()
      .then((mine) => {
        setWorkouts(mine)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workouts')
        setLoading(false)
      })
  }, [])

  const openCreate = useCallback(() => setEditingWorkout(null), [])

  useEffect(() => {
    onOpenCreateReady?.(openCreate)
  }, [onOpenCreateReady, openCreate])

  const handleLogWorkout = async (options: {
    setsLogged: number
    durationMinutes?: number
    calories?: number | null
  }) => {
    if (!loggingWorkout) return
    await logWorkout({
      workoutId: loggingWorkout.id,
      setsLogged: options.setsLogged,
      durationMinutes: options.durationMinutes,
      calories: options.calories,
    })
    setLogSuccess(`Added ${loggingWorkout.name} to today's activity log.`)
    setLoggingWorkout(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      await deleteWorkout(id)
      setWorkouts((prev) => prev.filter((workout) => workout.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workout')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <PageLoading message="Loading workouts..." />

  return (
    <div>
      {logSuccess && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#ecfdf5',
            color: '#065f46',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {logSuccess}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {workouts.length > 0 && (
        <div className="day-accordion" style={{ padding: 20, marginBottom: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 220px)',
              gap: 12,
              alignItems: 'end',
            }}
            className="recipe-toolbar"
          >
            <div>
              <label
                htmlFor="workout-search"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#52525b',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Search workouts
              </label>
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#a1a1aa',
                    fontSize: 13,
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="workout-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or description..."
                  style={{ ...inputBase, paddingLeft: 38 }}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="workout-sort"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#52525b',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Sort by
              </label>
              <select
                id="workout-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as WorkoutSortOption)}
                style={{ ...inputBase, paddingRight: 12 }}
              >
                {WORKOUT_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 12,
              color: '#71717a',
              marginTop: 16,
            }}
          >
            <span>
              Showing {visibleWorkouts.length} of {workouts.length}{' '}
              {workouts.length === 1 ? 'workout' : 'workouts'}
            </span>
            {hasActiveFilters && (
              <ZoneButton
                onClick={() => {
                  setSearchQuery('')
                  setSortBy('name-asc')
                }}
              >
                Clear filters
              </ZoneButton>
            )}
          </div>
        </div>
      )}

      {workouts.length === 0 ? (
        <div className="day-accordion">
          <EmptyState
            icon="fa-solid fa-dumbbell"
            title="No workouts yet"
            description="Create one to speed up logging your training sessions."
            action={
              <ZoneButton variant="primary" onClick={() => setEditingWorkout(null)}>
                <i className="fa-solid fa-plus" aria-hidden="true" />
                New Workout
              </ZoneButton>
            }
          />
        </div>
      ) : visibleWorkouts.length === 0 ? (
        <div className="day-accordion" style={{ padding: 32, textAlign: 'center', color: '#71717a' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 500, color: '#52525b' }}>
            No matching workouts
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Try a different search term or{' '}
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--zone-accent)',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              clear your search
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="catalog-list">
          {visibleWorkouts.map((workout) => (
            <CatalogRow
              key={workout.id}
              icon={workout.icon}
              iconBg={workout.iconBg}
              iconColor={workout.iconColor}
              title={workout.name}
              subtitle={[
                `${workout.exerciseCount} exercises`,
                workout.defaultDurationMinutes !== null
                  ? `${workout.defaultDurationMinutes} min/set`
                  : null,
                workout.defaultCalories !== null ? `${workout.defaultCalories} kcal/set` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onView={() => setViewingWorkoutId(workout.id)}
              actions={
                <>
                  <ZoneButton
                    variant="primary"
                    onClick={() => {
                      setLogSuccess(null)
                      setLoggingWorkout(workout)
                    }}
                  >
                    Add to Log
                  </ZoneButton>
                  <ZoneButton onClick={() => setViewingWorkoutId(workout.id)}>View</ZoneButton>
                  <ZoneButton
                    onClick={() => setSharingWorkout({ id: workout.id, name: workout.name })}
                  >
                    Share
                  </ZoneButton>
                  <ZoneButton
                    variant="danger"
                    onClick={() => handleDelete(workout.id)}
                    disabled={deletingId === workout.id}
                  >
                    {deletingId === workout.id ? 'Deleting...' : 'Delete'}
                  </ZoneButton>
                </>
              }
            />
          ))}
        </div>
      )}

      {editingWorkout !== undefined && (
        <WorkoutEditorModal
          workout={editingWorkout ?? undefined}
          onClose={() => setEditingWorkout(undefined)}
          onSave={async (input) => {
            await saveWorkout(input, editingWorkout?.id)
            await loadWorkouts()
          }}
        />
      )}

      {loggingWorkout && (
        <LogWorkoutModal
          workout={loggingWorkout}
          onLog={handleLogWorkout}
          onClose={() => setLoggingWorkout(null)}
        />
      )}

      {viewingWorkoutId && (
        <WorkoutViewModal
          workoutId={viewingWorkoutId}
          onClose={() => setViewingWorkoutId(null)}
          onEdit={(workout) => {
            setViewingWorkoutId(null)
            setEditingWorkout(workout)
          }}
          onShare={(workout) => setSharingWorkout({ id: workout.id, name: workout.name })}
        />
      )}

      {sharingWorkout && (
        <ShareModal
          resourceType="workout"
          resourceId={sharingWorkout.id}
          resourceName={sharingWorkout.name}
          onClose={() => setSharingWorkout(null)}
        />
      )}
    </div>
  )
}