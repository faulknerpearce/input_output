import { useEffect, useRef, useState } from 'react'
import {
  resolveLogWorkoutMetrics,
  type WorkoutSummary,
  type WorkoutWithExercises,
} from '@input_output/shared'
import { fetchWorkout } from '../lib/workouts'
import { focusIfDesktop } from '../lib/device'
import { inputBase, labelBase } from '../lib/styles'
import Modal from './Modal'

interface LogWorkoutModalProps {
  workout: WorkoutSummary
  onLog: (options: {
    setsLogged: number
    durationMinutes?: number
    calories?: number | null
  }) => Promise<void>
  onClose: () => void
}

export default function LogWorkoutModal({ workout, onLog, onClose }: LogWorkoutModalProps) {
  const [details, setDetails] = useState<WorkoutWithExercises | null>(null)
  const [setsLogged, setSetsLogged] = useState('1')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [calories, setCalories] = useState('')
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setsRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const setsNum = Number.parseInt(setsLogged, 10)
  const previewMetrics =
    details && Number.isFinite(setsNum) && setsNum > 0
      ? resolveLogWorkoutMetrics(details, setsNum, {
          durationMinutes:
            durationMinutes.trim() === '' ? undefined : Number.parseFloat(durationMinutes),
          calories: calories.trim() === '' ? undefined : Number.parseInt(calories, 10),
        })
      : null

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    focusIfDesktop(setsRef.current)

    fetchWorkout(workout.id)
      .then((loaded) => {
        setDetails(loaded)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workout')
        setLoading(false)
      })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!Number.isFinite(setsNum) || setsNum <= 0) {
      setError('Sets must be a positive integer')
      return
    }

    const durationOverride =
      durationMinutes.trim() === '' ? undefined : Number.parseFloat(durationMinutes)
    if (durationOverride !== undefined && (!Number.isFinite(durationOverride) || durationOverride < 0)) {
      setError('Duration must be a non-negative number')
      return
    }

    const caloriesOverride =
      calories.trim() === '' ? undefined : Number.parseInt(calories, 10)
    if (
      caloriesOverride !== undefined &&
      (!Number.isFinite(caloriesOverride) || caloriesOverride < 0)
    ) {
      setError('Calories must be a non-negative integer')
      return
    }

    setLogging(true)
    setError(null)
    try {
      await onLog({
        setsLogged: setsNum,
        durationMinutes: durationOverride,
        calories: caloriesOverride,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log workout')
    } finally {
      setLogging(false)
    }
  }

  return (
    <Modal titleId="log-workout-title" onClose={onClose}>
      <h3
        id="log-workout-title"
        style={{
          fontFamily: "'Space Grotesk','Inter',sans-serif",
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 4px 0',
        }}
      >
        Log Workout
      </h3>
      <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 24px 0' }}>
        Log <strong style={{ color: '#18181b' }}>{workout.name}</strong> to today&apos;s outputs.
      </p>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: '#71717a' }}>Loading exercises...</p>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="workout-sets-logged" style={labelBase}>
              How many sets of this workout did you complete?
            </label>
            <input
              id="workout-sets-logged"
              ref={setsRef}
              type="number"
              min="1"
              step="1"
              value={setsLogged}
              onChange={(e) => setSetsLogged(e.target.value)}
              style={inputBase}
            />
            <p style={{ fontSize: 12, color: '#a1a1aa', margin: '8px 0 0 0' }}>
              One set = the full workout from start to finish.
            </p>
          </div>

          {details && details.exercises.length > 0 && (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                borderRadius: 16,
                background: '#fafafa',
                border: '1px solid #f4f4f5',
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: '#52525b', margin: '0 0 10px 0' }}>
                Exercises in one set
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {details.exercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: 8,
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: 0,
                        padding: '8px 14px',
                        borderRadius: 12,
                        background: 'white',
                        border: '1px solid #e4e4e7',
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#18181b',
                      }}
                    >
                      {exercise.name}
                    </span>
                    <span
                      style={{
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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {exercise.targetReps} {exercise.targetReps === 1 ? 'rep' : 'reps'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-form-grid" style={{ marginBottom: 20 }}>
            <div>
              <label htmlFor="workout-duration" style={labelBase}>
                Duration (minutes, optional)
              </label>
              <input
                id="workout-duration"
                type="number"
                min="0"
                step="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="0"
                style={inputBase}
              />
            </div>
            <div>
              <label htmlFor="workout-calories" style={labelBase}>
                Calories burned (optional)
              </label>
              <input
                id="workout-calories"
                type="number"
                min="0"
                step="1"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="Optional"
                style={inputBase}
              />
            </div>
          </div>

          {Number.isFinite(setsNum) && setsNum > 0 && (
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                borderRadius: 16,
                background: '#ecfdf5',
                color: '#065f46',
                fontSize: 13,
              }}
            >
              Logging {setsNum} {setsNum === 1 ? 'set' : 'sets'} of {workout.name}
              {previewMetrics &&
                (previewMetrics.durationMinutes > 0 || previewMetrics.calories !== null) && (
                  <>
                    {' '}
                    · {previewMetrics.durationMinutes} min
                    {previewMetrics.calories !== null && ` · ${previewMetrics.calories} kcal`}
                  </>
                )}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 20px',
            borderRadius: 9999,
            border: '1px solid #e4e4e7',
            background: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            color: '#52525b',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={logging || loading}
          style={{
            padding: '10px 20px',
            borderRadius: 9999,
            border: 'none',
            background: logging || loading ? '#6b7280' : 'var(--zone-accent)',
            color: 'white',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {logging ? 'Logging...' : 'Add to Log'}
        </button>
      </div>
    </Modal>
  )
}