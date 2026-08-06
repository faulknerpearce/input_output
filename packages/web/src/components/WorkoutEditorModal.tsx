import { useEffect, useRef, useState } from 'react'
import {
  workoutIconOptions,
  type IconOption,
  type NewWorkoutExercise,
  type WorkoutInput,
  type WorkoutWithExercises,
} from '@input_output/shared'
import CatalogListSection from './catalog/CatalogListSection'
import CatalogModalHeader from './catalog/CatalogModalHeader'
import IconPicker from './catalog/IconPicker'
import { focusIfDesktop } from '../lib/device'
import {
  catalogItemCard,
  inputBase,
  labelBase,
  modalFooterButton,
  modalPrimaryButton,
  summaryPanel,
} from '../lib/styles'
import Modal from './Modal'

interface WorkoutEditorModalProps {
  workout?: WorkoutWithExercises
  onSave: (input: WorkoutInput) => Promise<void>
  onClose: () => void
}

interface ExerciseForm {
  name: string
  targetReps: string
}

const EMPTY_EXERCISE: ExerciseForm = {
  name: '',
  targetReps: '10',
}

function iconFromWorkout(workout: WorkoutWithExercises): IconOption {
  return (
    workoutIconOptions.find((opt) => opt.icon === workout.icon) ?? {
      icon: workout.icon,
      label: 'Custom',
      bg: workout.iconBg,
      color: workout.iconColor,
    }
  )
}

function exerciseFormFromWorkout(workout: WorkoutWithExercises): ExerciseForm[] {
  return workout.exercises.map((exercise) => ({
    name: exercise.name,
    targetReps: String(exercise.targetReps),
  }))
}

function parseExercise(form: ExerciseForm, sortOrder: number): NewWorkoutExercise | null {
  const targetReps = form.targetReps === '' ? NaN : parseInt(form.targetReps, 10)
  if (!form.name.trim() || !Number.isFinite(targetReps) || targetReps <= 0) return null

  return {
    name: form.name.trim(),
    sortOrder,
    targetReps,
  }
}

export default function WorkoutEditorModal({ workout, onSave, onClose }: WorkoutEditorModalProps) {
  const isEdit = workout !== undefined
  const [name, setName] = useState(workout?.name ?? '')
  const [description, setDescription] = useState(workout?.description ?? '')
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(
    workout?.defaultDurationMinutes != null ? String(workout.defaultDurationMinutes) : '',
  )
  const [defaultCalories, setDefaultCalories] = useState(
    workout?.defaultCalories != null ? String(workout.defaultCalories) : '',
  )
  const [exercises, setExercises] = useState<ExerciseForm[]>(() =>
    workout ? exerciseFormFromWorkout(workout) : [{ ...EMPTY_EXERCISE }],
  )
  const [selectedIcon, setSelectedIcon] = useState<IconOption>(() =>
    workout ? iconFromWorkout(workout) : workoutIconOptions[0],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    focusIfDesktop(nameRef.current)
  }, [])

  const previewExercises = exercises
    .map((form, index) => parseExercise(form, index))
    .filter((exercise): exercise is NewWorkoutExercise => exercise !== null)

  const updateExercise = (index: number, patch: Partial<ExerciseForm>) => {
    setExercises((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  const addExerciseRow = () => {
    setExercises((prev) => [...prev, { ...EMPTY_EXERCISE }])
  }

  const removeExerciseRow = (index: number) => {
    setExercises((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const submit = async () => {
    const parsedExercises = exercises
      .map((form, index) => parseExercise(form, index))
      .filter((exercise): exercise is NewWorkoutExercise => exercise !== null)

    if (parsedExercises.length === 0) {
      setError('Add at least one exercise with a name and target sets')
      return
    }

    const durationValue =
      defaultDurationMinutes.trim() === '' ? null : Number.parseInt(defaultDurationMinutes, 10)
    if (durationValue !== null && (!Number.isFinite(durationValue) || durationValue < 0)) {
      setError('Duration must be a non-negative integer')
      return
    }

    const caloriesValue =
      defaultCalories.trim() === '' ? null : Number.parseInt(defaultCalories, 10)
    if (caloriesValue !== null && (!Number.isFinite(caloriesValue) || caloriesValue < 0)) {
      setError('Calories must be a non-negative integer')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name,
        description,
        icon: selectedIcon.icon,
        iconBg: selectedIcon.bg,
        iconColor: selectedIcon.color,
        defaultDurationMinutes: durationValue,
        defaultCalories: caloriesValue,
        exercises: parsedExercises,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal titleId="workout-editor-title" onClose={onClose} size="wide">
      <CatalogModalHeader
        titleId="workout-editor-title"
        icon={selectedIcon.icon}
        iconBg={selectedIcon.bg}
        iconColor={selectedIcon.color}
        title={isEdit ? 'Edit Workout' : 'New Workout'}
        subtitle="Build a reusable strength routine. Target sets pre-fill when you log the workout."
      />

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

      <IconPicker
        id="workout-icon"
        label="Icon"
        options={workoutIconOptions}
        selected={selectedIcon}
        onSelect={setSelectedIcon}
      />

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="workout-name" style={labelBase}>
          Workout name
        </label>
        <input
          id="workout-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
          style={inputBase}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="workout-description" style={labelBase}>
          Description
        </label>
        <input
          id="workout-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes"
          style={inputBase}
        />
      </div>

      <div className="modal-form-grid" style={{ marginBottom: 20 }}>
        <div>
          <label htmlFor="workout-default-duration" style={labelBase}>
            Duration per set (minutes)
          </label>
          <input
            id="workout-default-duration"
            type="number"
            min="0"
            step="1"
            value={defaultDurationMinutes}
            onChange={(e) => setDefaultDurationMinutes(e.target.value)}
            placeholder="Optional"
            style={inputBase}
          />
        </div>
        <div>
          <label htmlFor="workout-default-calories" style={labelBase}>
            Calories per set
          </label>
          <input
            id="workout-default-calories"
            type="number"
            min="0"
            step="1"
            value={defaultCalories}
            onChange={(e) => setDefaultCalories(e.target.value)}
            placeholder="Optional"
            style={inputBase}
          />
        </div>
      </div>

      <CatalogListSection
        title="Exercises"
        action={
          <button
            type="button"
            onClick={addExerciseRow}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--zone-accent)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Add exercise
          </button>
        }
      >
        {exercises.map((row, index) => (
          <div key={index} style={catalogItemCard}>
            <div className="modal-form-grid">
              <div>
                <label style={labelBase}>Exercise</label>
                <input
                  value={row.name}
                  onChange={(e) => updateExercise(index, { name: e.target.value })}
                  placeholder="Bench Press"
                  style={inputBase}
                />
              </div>
              <div>
                <label style={labelBase}>Target reps</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.targetReps}
                  onChange={(e) => updateExercise(index, { targetReps: e.target.value })}
                  style={inputBase}
                />
              </div>
            </div>
            {exercises.length > 1 && (
              <button
                type="button"
                onClick={() => removeExerciseRow(index)}
                style={{
                  marginTop: 12,
                  border: 'none',
                  background: 'transparent',
                  color: '#b91c1c',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Remove exercise
              </button>
            )}
          </div>
        ))}
      </CatalogListSection>

      <div style={{ ...summaryPanel, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Workout preview</div>
        {previewExercises.length} {previewExercises.length === 1 ? 'exercise' : 'exercises'}
        {defaultDurationMinutes.trim() !== '' && ` · ${defaultDurationMinutes} min/set`}
        {defaultCalories.trim() !== '' && ` · ${defaultCalories} kcal/set`}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={modalFooterButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{
            ...modalPrimaryButton,
            background: saving ? '#6b7280' : 'var(--zone-accent)',
          }}
        >
          {saving ? 'Saving...' : isEdit ? 'Save Workout' : 'Create Workout'}
        </button>
      </div>
    </Modal>
  )
}