import { useEffect, useRef, useState } from 'react'
import {
  currentTimeInputValue,
  formatTimeInputValue,
  loggedAtFromDayAndTime,
  resolveLogWorkoutMetrics,
  todayISO,
  validateActivity,
  type Activity,
  type ActivityWrite,
  type WorkoutSummary,
} from '@input_output/shared'
import { fetchWorkoutSummaries } from '../lib/workouts'
import { focusIfDesktop } from '../lib/device'
import { inputBase, labelBase } from '../lib/styles'
import Modal from './Modal'

const ACTIVITY_TYPES = ['Run', 'Ride', 'Swim', 'Walk', 'Hike', 'Workout', 'Other'] as const

type AddMode = 'manual' | 'workout'

interface AddActivityModalProps {
  activity?: Activity
  logDate: string
  timeZone: string
  onAdd: (activity: ActivityWrite, options?: { activityDate?: string }) => Promise<void>
  onLogWorkout?: (options: {
    workoutId: string
    setsLogged: number
    loggedAt?: string
    activityDate?: string
  }) => Promise<void>
  onClose: () => void
}

interface FormState {
  name: string
  activityType: string
  logTime: string
  durationMinutes: string
  distanceKm: string
  averageHeartrate: string
  maxHeartrate: string
  calories: string
}

function initialLogTime(activity: Activity | undefined, timeZone: string): string {
  if (activity?.loggedAt) return formatTimeInputValue(activity.loggedAt, timeZone)
  return currentTimeInputValue(timeZone)
}

function emptyForm(timeZone: string): FormState {
  return {
    name: '',
    activityType: ACTIVITY_TYPES[0],
    logTime: currentTimeInputValue(timeZone),
    durationMinutes: '',
    distanceKm: '',
    averageHeartrate: '',
    maxHeartrate: '',
    calories: '',
  }
}

function formFromActivity(activity: Activity, timeZone: string): FormState {
  return {
    name: activity.name,
    activityType: activity.activityType,
    logTime: initialLogTime(activity, timeZone),
    durationMinutes: String(Math.round(activity.movingTimeSeconds / 60)),
    distanceKm: activity.distanceMeters !== null ? String(activity.distanceMeters / 1000) : '',
    averageHeartrate: activity.averageHeartrate !== null ? String(activity.averageHeartrate) : '',
    maxHeartrate: activity.maxHeartrate !== null ? String(activity.maxHeartrate) : '',
    calories: activity.calories !== null ? String(activity.calories) : '',
  }
}

function parseOptionalInt(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalFloat(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function AddActivityModal({
  activity,
  logDate,
  timeZone,
  onAdd,
  onLogWorkout,
  onClose,
}: AddActivityModalProps) {
  const isEdit = activity !== undefined
  const [mode, setMode] = useState<AddMode>('manual')
  const [activityDate, setActivityDate] = useState(logDate)
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [workoutSetsLogged, setWorkoutSetsLogged] = useState('1')
  const [workoutLogTime, setWorkoutLogTime] = useState(() => currentTimeInputValue(timeZone))
  const [form, setForm] = useState<FormState>(() =>
    activity ? formFromActivity(activity, timeZone) : emptyForm(timeZone),
  )
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    focusIfDesktop(nameRef.current)

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
    // onClose is intentionally captured at mount; the modal unmounts on close
    // so the listener is torn down and the next mount gets the latest value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isEdit || mode !== 'workout') return
    fetchWorkoutSummaries()
      .then((data) => {
        setWorkouts(data)
        setSelectedWorkoutId((current) => current || data[0]?.id || '')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workouts')
      })
  }, [isEdit, mode])

  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId)
  const workoutSetsNum = Number.parseInt(workoutSetsLogged, 10)
  const workoutPreviewMetrics =
    selectedWorkout && Number.isFinite(workoutSetsNum) && workoutSetsNum > 0
      ? resolveLogWorkoutMetrics(selectedWorkout, workoutSetsNum)
      : null

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const close = () => {
    setForm(activity ? formFromActivity(activity, timeZone) : emptyForm(timeZone))
    setWorkoutLogTime(currentTimeInputValue(timeZone))
    setError(null)
    onClose()
  }

  const submit = async () => {
    const durationMinutes = form.durationMinutes === '' ? NaN : parseInt(form.durationMinutes, 10)
    const distanceKm = parseOptionalFloat(form.distanceKm)
    const averageHeartrate = parseOptionalInt(form.averageHeartrate)
    const maxHeartrate = parseOptionalInt(form.maxHeartrate)
    const calories = parseOptionalInt(form.calories)

    const validated = validateActivity({
      name: form.name,
      activityType: form.activityType,
      movingTimeSeconds: Number.isFinite(durationMinutes) ? durationMinutes * 60 : NaN,
      distanceMeters: distanceKm !== null ? Math.round(distanceKm * 1000) : null,
      averageHeartrate,
      maxHeartrate,
      calories,
    })
    if (!validated.ok) {
      setError(validated.error)
      return
    }

    const loggedAt = loggedAtFromDayAndTime(activityDate, form.logTime, timeZone)
    if (!loggedAt.ok) {
      setError(loggedAt.error)
      return
    }

    setAdding(true)
    setError(null)
    try {
      await onAdd(
        {
          name: validated.value.name,
          activityType: validated.value.activityType,
          movingTimeSeconds: validated.value.movingTimeSeconds,
          distanceMeters: validated.value.distanceMeters,
          averageHeartrate: validated.value.averageHeartrate,
          maxHeartrate: validated.value.maxHeartrate,
          calories: validated.value.calories,
          loggedAt: loggedAt.value,
        },
        { activityDate },
      )
      close()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'add'} activity`,
      )
    } finally {
      setAdding(false)
    }
  }

  const submitWorkout = async () => {
    if (!onLogWorkout || !selectedWorkout) {
      setError('Select a workout')
      return
    }

    const setsLogged = Number.parseInt(workoutSetsLogged, 10)
    if (!Number.isFinite(setsLogged) || setsLogged <= 0) {
      setError('Sets must be a positive integer')
      return
    }

    const loggedAt = loggedAtFromDayAndTime(activityDate, workoutLogTime, timeZone)
    if (!loggedAt.ok) {
      setError(loggedAt.error)
      return
    }

    setAdding(true)
    setError(null)
    try {
      await onLogWorkout({
        workoutId: selectedWorkout.id,
        setsLogged,
        loggedAt: loggedAt.value,
        activityDate,
      })
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log workout')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal titleId="activity-form-title" onClose={close}>
        <h3
          id="activity-form-title"
          style={{
            fontFamily: "'Space Grotesk','Inter',sans-serif",
            fontSize: 22,
            fontWeight: 600,
            margin: '0 0 4px 0',
          }}
        >
          {isEdit ? 'Edit Activity' : 'Log Activity'}
        </h3>
        <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 24px 0' }}>
          {isEdit
            ? 'Update this activity, including when you completed it.'
            : "Record a workout or activity for today's outputs."}
        </p>

        {!isEdit && onLogWorkout && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['manual', 'workout'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 9999,
                  border: mode === value ? '1px solid var(--zone-accent)' : '1px solid #e4e4e7',
                  background: mode === value ? 'var(--zone-accent)' : 'white',
                  color: mode === value ? 'white' : '#52525b',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {value === 'manual' ? 'Manual' : 'From Workout'}
              </button>
            ))}
          </div>
        )}

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

        {!isEdit && mode === 'workout' ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="activity-workout" style={labelBase}>
                Saved workout
              </label>
              <select
                id="activity-workout"
                value={selectedWorkoutId}
                onChange={(e) => setSelectedWorkoutId(e.target.value)}
                style={inputBase}
              >
                {workouts.length === 0 ? (
                  <option value="">No workouts saved yet</option>
                ) : (
                  workouts.map((workout) => (
                    <option key={workout.id} value={workout.id}>
                      {workout.name} ({workout.exerciseCount} exercises)
                    </option>
                  ))
                )}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="activity-workout-log-date" style={labelBase}>
                Log date
              </label>
              <input
                id="activity-workout-log-date"
                type="date"
                value={activityDate}
                max={todayISO()}
                onChange={(e) => setActivityDate(e.target.value || activityDate)}
                style={inputBase}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="activity-workout-log-time" style={labelBase}>
                Log time
              </label>
              <input
                id="activity-workout-log-time"
                type="time"
                value={workoutLogTime}
                onChange={(e) => setWorkoutLogTime(e.target.value)}
                style={inputBase}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="activity-workout-sets" style={labelBase}>
                How many sets of this workout did you complete?
              </label>
              <input
                id="activity-workout-sets"
                type="number"
                min="1"
                step="1"
                value={workoutSetsLogged}
                onChange={(e) => setWorkoutSetsLogged(e.target.value)}
                style={inputBase}
              />
              <p style={{ fontSize: 12, color: '#a1a1aa', margin: '8px 0 0 0' }}>
                One set = the full workout from start to finish.
              </p>
            </div>

            {selectedWorkout && (
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
                {selectedWorkout.exerciseCount} exercises in one set
                {Number.isFinite(workoutSetsNum) && workoutSetsNum > 0 &&
                  ` · logging ${workoutSetsNum} ${workoutSetsNum === 1 ? 'set' : 'sets'}`}
                {workoutPreviewMetrics &&
                  (workoutPreviewMetrics.durationMinutes > 0 ||
                    workoutPreviewMetrics.calories !== null) && (
                    <>
                      {' '}
                      · {workoutPreviewMetrics.durationMinutes} min
                      {workoutPreviewMetrics.calories !== null &&
                        ` · ${workoutPreviewMetrics.calories} kcal`}
                    </>
                  )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={close}
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
                onClick={submitWorkout}
                disabled={adding || !selectedWorkout}
                style={{
                  padding: '10px 20px',
                  borderRadius: 9999,
                  border: 'none',
                  background: adding || !selectedWorkout ? '#6b7280' : 'var(--zone-accent)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {adding ? 'Logging...' : 'Log Workout'}
              </button>
            </div>
          </>
        ) : (
          <>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="activity-name" style={labelBase}>
            Name
          </label>
          <input
            id="activity-name"
            ref={nameRef}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Morning Run"
            style={inputBase}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="activity-type" style={labelBase}>
            Activity Type
          </label>
          <select
            id="activity-type"
            value={form.activityType}
            onChange={(e) => update('activityType', e.target.value)}
            style={inputBase}
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {!isEdit && (
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="activity-log-date" style={labelBase}>
              Log date
            </label>
            <input
              id="activity-log-date"
              type="date"
              value={activityDate}
              max={todayISO()}
              onChange={(e) => setActivityDate(e.target.value || activityDate)}
              style={inputBase}
            />
            <p style={{ fontSize: 12, color: '#a1a1aa', margin: '6px 0 0 0' }}>
              Choose today or a previous day if you are catching up.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="activity-log-time" style={labelBase}>
            Log time
          </label>
          <input
            id="activity-log-time"
            type="time"
            value={form.logTime}
            onChange={(e) => update('logTime', e.target.value)}
            style={inputBase}
          />
          <p style={{ fontSize: 12, color: '#a1a1aa', margin: '6px 0 0 0' }}>
            When you completed this activity.
          </p>
        </div>

        <div className="modal-form-grid" style={{ marginBottom: 16 }}>
          <div>
            <label htmlFor="activity-duration" style={labelBase}>
              Duration (min)
            </label>
            <input
              id="activity-duration"
              type="number"
              min="1"
              value={form.durationMinutes}
              onChange={(e) => update('durationMinutes', e.target.value)}
              placeholder="45"
              style={inputBase}
            />
          </div>
          <div>
            <label htmlFor="activity-distance" style={labelBase}>
              Distance (km)
            </label>
            <input
              id="activity-distance"
              type="number"
              min="0"
              step="0.1"
              value={form.distanceKm}
              onChange={(e) => update('distanceKm', e.target.value)}
              placeholder="Optional"
              style={inputBase}
            />
          </div>
          <div>
            <label htmlFor="activity-avg-hr" style={labelBase}>
              Avg Heart Rate
            </label>
            <input
              id="activity-avg-hr"
              type="number"
              min="1"
              value={form.averageHeartrate}
              onChange={(e) => update('averageHeartrate', e.target.value)}
              placeholder="Optional"
              style={inputBase}
            />
          </div>
          <div>
            <label htmlFor="activity-max-hr" style={labelBase}>
              Max Heart Rate
            </label>
            <input
              id="activity-max-hr"
              type="number"
              min="1"
              value={form.maxHeartrate}
              onChange={(e) => update('maxHeartrate', e.target.value)}
              placeholder="Optional"
              style={inputBase}
            />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="activity-calories" style={labelBase}>
            Calories Burned
          </label>
          <input
            id="activity-calories"
            type="number"
            min="0"
            value={form.calories}
            onChange={(e) => update('calories', e.target.value)}
            placeholder="Optional"
            style={inputBase}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={close}
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
            disabled={adding}
            style={{
              padding: '10px 20px',
              borderRadius: 9999,
              border: 'none',
              background: adding ? '#6b7280' : 'var(--zone-accent)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {adding
              ? isEdit
                ? 'Saving...'
                : 'Logging...'
              : isEdit
                ? 'Save Changes'
                : 'Log Activity'}
          </button>
        </div>
          </>
        )}
    </Modal>
  )
}
