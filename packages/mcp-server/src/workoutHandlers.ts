import {
  buildActivityExerciseInsertPayload,
  buildWorkoutExerciseInsertPayload,
  buildWorkoutInsertPayload,
  mapActivityExerciseRow,
  mapActivityRow,
  mapWorkoutExerciseRow,
  mapWorkoutRow,
  parseLogDate,
  buildWorkoutExerciseSnapshot,

  todayISOInTimeZone,
  validateWorkoutInput,
  resolveLogWorkoutMetrics,
  validateWorkoutSetsLogged,
  type LogWorkoutInput,
  type WorkoutInput,
  type WorkoutSummary,
  type WorkoutWithExercises,
} from '@input_output/shared'
import type { InputOutputSupabase } from './supabase.js'
import { fetchUserTimeZone, requireUserId } from './toolHandlers.js'

export type WorkoutToolArgs = Record<string, unknown>

function toSummary(
  workout: ReturnType<typeof mapWorkoutRow>,
  exercises: ReturnType<typeof mapWorkoutExerciseRow>[],
): WorkoutSummary {
  return {
    ...workout,
    exerciseCount: exercises.length,
  }
}

export async function listWorkouts(supabase: InputOutputSupabase): Promise<WorkoutSummary[]> {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  if (!workouts?.length) return []

  const { data: exercises, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select('*')
    .in(
      'workout_id',
      workouts.map((workout) => workout.id),
    )
    .order('sort_order', { ascending: true })
  if (exerciseError) throw exerciseError

  const exercisesByWorkout = new Map<string, ReturnType<typeof mapWorkoutExerciseRow>[]>()
  for (const row of exercises ?? []) {
    const mapped = mapWorkoutExerciseRow(row)
    const list = exercisesByWorkout.get(row.workout_id) ?? []
    list.push(mapped)
    exercisesByWorkout.set(row.workout_id, list)
  }

  return workouts.map((row) =>
    toSummary(mapWorkoutRow(row), exercisesByWorkout.get(row.id) ?? []),
  )
}

export async function getWorkout(
  supabase: InputOutputSupabase,
  workoutId: string,
): Promise<WorkoutWithExercises> {
  const { data: workoutRow, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .single()
  if (error) throw error

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('workout_id', workoutId)
    .order('sort_order', { ascending: true })
  if (exerciseError) throw exerciseError

  const workout = mapWorkoutRow(workoutRow)
  const exercises = (exerciseRows ?? []).map(mapWorkoutExerciseRow)

  return {
    ...workout,
    exercises,
  }
}

async function replaceWorkoutExercises(
  supabase: InputOutputSupabase,
  workoutId: string,
  userId: string,
  exercises: WorkoutInput['exercises'],
) {
  const { error: deleteError } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('workout_id', workoutId)
  if (deleteError) throw deleteError

  if (exercises.length === 0) return

  const rows = exercises.map((exercise, index) =>
    buildWorkoutExerciseInsertPayload(
      workoutId,
      userId,
      { ...exercise, sortOrder: index },
      crypto.randomUUID(),
    ),
  )

  const { error: insertError } = await supabase.from('workout_exercises').insert(rows)
  if (insertError) throw insertError
}

function parseWorkoutInput(args: WorkoutToolArgs): WorkoutInput {
  const exercisesRaw = Array.isArray(args.exercises) ? args.exercises : []
  const exercises = exercisesRaw.map((item, index) => {
    const row = item as Record<string, unknown>
    return {
      name: typeof row.name === 'string' ? row.name : '',
      sortOrder:
        typeof row.sortOrder === 'number'
          ? row.sortOrder
          : typeof row.sort_order === 'number'
            ? row.sort_order
            : index,
      targetReps:
        typeof row.targetReps === 'number'
          ? row.targetReps
          : typeof row.target_reps === 'number'
            ? row.target_reps
            : NaN,
    }
  })

  const defaultDurationMinutes =
    typeof args.defaultDurationMinutes === 'number'
      ? args.defaultDurationMinutes
      : typeof args.default_duration_minutes === 'number'
        ? args.default_duration_minutes
        : undefined

  const defaultCalories =
    typeof args.defaultCalories === 'number'
      ? args.defaultCalories
      : typeof args.default_calories === 'number'
        ? args.default_calories
        : undefined

  return {
    name: typeof args.name === 'string' ? args.name : '',
    description: typeof args.description === 'string' ? args.description : '',
    icon: typeof args.icon === 'string' ? args.icon : undefined,
    iconBg: typeof args.iconBg === 'string' ? args.iconBg : undefined,
    iconColor: typeof args.iconColor === 'string' ? args.iconColor : undefined,
    defaultDurationMinutes,
    defaultCalories,
    exercises,
  }
}

export async function saveWorkout(supabase: InputOutputSupabase, args: WorkoutToolArgs) {
  const input = parseWorkoutInput(args)
  const validated = validateWorkoutInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const userId = await requireUserId(supabase)
  const workoutId =
    typeof args.id === 'string' && args.id !== '' ? args.id : crypto.randomUUID()
  const payload = buildWorkoutInsertPayload(validated.value, userId, workoutId)

  if (typeof args.id === 'string' && args.id !== '') {
    const { error } = await supabase
      .from('workouts')
      .update({
        name: payload.name,
        description: payload.description,
        icon: payload.icon,
        icon_bg: payload.icon_bg,
        icon_color: payload.icon_color,
        default_duration_minutes: payload.default_duration_minutes,
        default_calories: payload.default_calories,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workoutId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('workouts').insert(payload)
    if (error) throw error
  }

  await replaceWorkoutExercises(supabase, workoutId, userId, validated.value.exercises)
  return getWorkout(supabase, workoutId)
}

export async function deleteWorkout(supabase: InputOutputSupabase, workoutId: string) {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
  if (error) throw error
  return { ok: true as const }
}

function parseLogWorkoutInput(args: WorkoutToolArgs): LogWorkoutInput {
  if (typeof args.workoutId !== 'string' && typeof args.workout_id !== 'string') {
    throw new Error('workoutId is required')
  }

  const setsLogged =
    typeof args.setsLogged === 'number'
      ? args.setsLogged
      : typeof args.sets_logged === 'number'
        ? args.sets_logged
        : undefined

  const durationMinutes =
    typeof args.durationMinutes === 'number'
      ? args.durationMinutes
      : typeof args.duration_minutes === 'number'
        ? args.duration_minutes
        : undefined

  return {
    workoutId:
      typeof args.workoutId === 'string' ? args.workoutId : (args.workout_id as string),
    setsLogged,
    durationMinutes,
    calories: typeof args.calories === 'number' ? args.calories : null,
    activityDate: typeof args.date === 'string' ? args.date : undefined,
  }
}

export async function logWorkoutEntry(supabase: InputOutputSupabase, args: WorkoutToolArgs) {
  const input = parseLogWorkoutInput(args)
  const workout = await getWorkout(supabase, input.workoutId)
  const userId = await requireUserId(supabase)
  const setsLogged = validateWorkoutSetsLogged(input.setsLogged)
  const snapshot = buildWorkoutExerciseSnapshot(workout)
  const metrics = resolveLogWorkoutMetrics(workout, setsLogged, {
    durationMinutes: input.durationMinutes,
    calories: input.calories,
  })
  const activityId = crypto.randomUUID()
  const movingTimeSeconds = Math.max(0, Math.round(metrics.durationMinutes * 60))
  const timeZone = await fetchUserTimeZone(supabase)
  const dateParsed = parseLogDate(input.activityDate, {
    fallback: todayISOInTimeZone(timeZone),
    timeZone,
  })
  if (!dateParsed.ok) throw new Error(dateParsed.error)

  const { data: activityRow, error: activityError } = await supabase
    .from('activities')
    .insert({
      id: activityId,
      user_id: userId,
      name: workout.name,
      activity_type: 'Workout',
      activity_date: dateParsed.value,
      distance_meters: null,
      moving_time_seconds: movingTimeSeconds,
      average_heartrate: null,
      max_heartrate: null,
      calories: metrics.calories,
      workout_id: workout.id,
      workout_sets_logged: setsLogged,
    })
    .select()
    .single()
  if (activityError) throw activityError

  const exerciseRows = snapshot.map((exercise, index) =>
    buildActivityExerciseInsertPayload(
      activityId,
      userId,
      {
        workoutExerciseId: exercise.workoutExerciseId,
        name: exercise.name,
        sortOrder: index,
        repsCompleted: exercise.repsCompleted,
      },
      crypto.randomUUID(),
    ),
  )

  const { data: loggedExercises, error: exerciseError } = await supabase
    .from('activity_exercises')
    .insert(exerciseRows)
    .select()
  if (exerciseError) throw exerciseError

  const activity = mapActivityRow(activityRow)
  activity.exercises = (loggedExercises ?? []).map(mapActivityExerciseRow)
  return activity
}