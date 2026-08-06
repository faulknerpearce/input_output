import { useEffect, useState } from 'react'
import type { WorkoutWithExercises } from '@input_output/shared'
import { fetchWorkout } from '../lib/workouts'
import { catalogItemCard, modalFooterButton, modalPrimaryButton } from '../lib/styles'
import CatalogListSection from './catalog/CatalogListSection'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import Modal from './Modal'

interface WorkoutViewModalProps {
  workoutId: string
  onClose: () => void
  mode?: 'owned' | 'shared'
  ownerDisplayName?: string
  savedCopyId?: string | null
  savingCopy?: boolean
  onShare?: (workout: WorkoutWithExercises) => void
  onEdit?: (workout: WorkoutWithExercises) => void
  onSaveCopy?: () => void
}

const repBadgeStyle = {
  flex: '0 0 96px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 14px',
  borderRadius: 12,
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  fontSize: 13,
  fontWeight: 500,
  color: '#065f46',
  whiteSpace: 'nowrap' as const,
}

export default function WorkoutViewModal({
  workoutId,
  onClose,
  mode = 'owned',
  ownerDisplayName,
  savedCopyId,
  savingCopy = false,
  onShare,
  onEdit,
  onSaveCopy,
}: WorkoutViewModalProps) {
  const [workout, setWorkout] = useState<WorkoutWithExercises | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)

    fetchWorkout(workoutId)
      .then((data) => {
        setWorkout(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workout')
        setLoading(false)
      })

    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId])

  return (
    <Modal titleId="workout-view-title" onClose={onClose} size="wide">
      {loading ? (
        <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>Loading workout...</p>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : workout ? (
        <>
          <CatalogModalHeader
            titleId="workout-view-title"
            icon={workout.icon}
            iconBg={workout.iconBg}
            iconColor={workout.iconColor}
            title={workout.name}
            subtitle={
              <>
                {mode === 'shared' && ownerDisplayName ? `Shared by ${ownerDisplayName} · ` : ''}
                {workout.exercises.length} exercises
                {workout.defaultDurationMinutes !== null && ` · ${workout.defaultDurationMinutes} min/set`}
                {workout.defaultCalories !== null && ` · ${workout.defaultCalories} kcal/set`}
              </>
            }
            description={workout.description || undefined}
          />

          <CatalogListSection title="Exercises">
            {workout.exercises.map((exercise) => (
              <div
                key={exercise.id}
                style={{
                  ...catalogItemCard,
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 8,
                  padding: '10px 12px',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#18181b',
                  }}
                >
                  {exercise.name}
                </span>
                <span style={repBadgeStyle}>
                  {exercise.targetReps} {exercise.targetReps === 1 ? 'rep' : 'reps'}
                </span>
              </div>
            ))}
          </CatalogListSection>
        </>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {mode === 'owned' && workout && onEdit && (
          <button type="button" onClick={() => onEdit(workout)} style={modalFooterButton}>
            Edit
          </button>
        )}
        {mode === 'owned' && workout && onShare && (
          <button
            type="button"
            onClick={() => onShare(workout)}
            style={{ ...modalFooterButton, color: 'var(--zone-accent)' }}
          >
            Share
          </button>
        )}
        {mode === 'shared' && onSaveCopy && (
          <button
            type="button"
            onClick={onSaveCopy}
            disabled={!!savedCopyId || savingCopy}
            style={{
              ...modalPrimaryButton,
              background: savedCopyId ? '#e4e4e7' : savingCopy ? '#6b7280' : 'var(--zone-accent)',
              cursor: savedCopyId ? 'default' : 'pointer',
              color: savedCopyId ? '#71717a' : 'white',
            }}
          >
            {savedCopyId ? 'Already saved' : savingCopy ? 'Saving...' : 'Save to my library'}
          </button>
        )}
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Close
        </button>
      </div>
    </Modal>
  )
}