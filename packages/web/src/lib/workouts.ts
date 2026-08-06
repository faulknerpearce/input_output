import {
  buildActivityExerciseInsertPayload,
  buildForkWorkoutInput,
  buildWorkoutExerciseInsertPayload,
  buildWorkoutInsertPayload,
  mapActivityExerciseRow,
  mapActivityRow,
  mapWorkoutExerciseRow,
  mapWorkoutRow,
  buildWorkoutExerciseSnapshot,
  todayISO,
  validateWorkoutInput,
  resolveLogWorkoutMetrics,
  validateWorkoutSetsLogged,
  type Activity,
  type LogWorkoutInput,
  type NewWorkoutExercise,
  type WorkoutInput,
  type WorkoutSummary,
  type WorkoutWithExercises,
} from '@input_output/shared'
import { markWorkoutShareSaved } from './sharing'
import { supabase } from './supabase'

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

function toSummary(
  workout: ReturnType<typeof mapWorkoutRow>,
  exercises: ReturnType<typeof mapWorkoutExerciseRow>[],
): WorkoutSummary {
  return {
    ...workout,
    exerciseCount: exercises.length,
  }
}

export async function fetchWorkoutSummaries(): Promise<WorkoutSummary[]> {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!workouts?.length) return []

  const { data: exercises, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select('*')
    .in(
      'workout_id',
      workouts.map((workout) => workout.id),
    )
    .order('sort_order', { ascending: true })
  if (exerciseError) throw new Error(exerciseError.message)

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

export async function fetchWorkout(id: string): Promise<WorkoutWithExercises> {
  const { data: workoutRow, error } = await supabase.from('workouts').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select('*')
    .eq('workout_id', id)
    .order('sort_order', { ascending: true })
  if (exerciseError) throw new Error(exerciseError.message)

  const workout = mapWorkoutRow(workoutRow)
  const exercises = (exerciseRows ?? []).map(mapWorkoutExerciseRow)

  return {
    ...workout,
    exercises,
  }
}

async function replaceWorkoutExercises(
  workoutId: string,
  userId: string,
  exercises: NewWorkoutExercise[],
) {
  const { error: deleteError } = await supabase
    .from('workout_exercises')
    .delete()
    .eq('workout_id', workoutId)
  if (deleteError) throw new Error(deleteError.message)

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
  if (insertError) throw new Error(insertError.message)
}

export async function saveWorkout(input: WorkoutInput, id?: string): Promise<WorkoutWithExercises> {
  const validated = validateWorkoutInput(input)
  if (!validated.ok) throw new Error(validated.error)

  const userId = await requireUserId()
  const workoutId = id ?? crypto.randomUUID()
  const payload = buildWorkoutInsertPayload(validated.value, userId, workoutId)

  if (id) {
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
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('workouts').insert(payload)
    if (error) throw new Error(error.message)
  }

  await replaceWorkoutExercises(workoutId, userId, validated.value.exercises)
  return fetchWorkout(workoutId)
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function forkWorkout(
  sourceWorkoutId: string,
  shareId?: string,
): Promise<WorkoutWithExercises> {
  const source = await fetchWorkout(sourceWorkoutId)
  const input = buildForkWorkoutInput(source)
  const userId = await requireUserId()
  const workoutId = crypto.randomUUID()
  const payload = buildWorkoutInsertPayload(input, userId, workoutId)

  const { error } = await supabase.from('workouts').insert({
    ...payload,
    forked_from_workout_id: sourceWorkoutId,
  })
  if (error) throw new Error(error.message)

  await replaceWorkoutExercises(workoutId, userId, input.exercises)
  const saved = await fetchWorkout(workoutId)

  if (shareId) {
    await markWorkoutShareSaved(shareId, saved.id)
  }

  return saved
}

export async function logWorkout(options: LogWorkoutInput): Promise<Activity> {
  const workout = await fetchWorkout(options.workoutId)
  const userId = await requireUserId()
  const setsLogged = validateWorkoutSetsLogged(options.setsLogged)
  const snapshot = buildWorkoutExerciseSnapshot(workout)
  const activityId = crypto.randomUUID()
  const metrics = resolveLogWorkoutMetrics(workout, setsLogged, {
    durationMinutes: options.durationMinutes,
    calories: options.calories,
  })
  const movingTimeSeconds = Math.max(0, Math.round(metrics.durationMinutes * 60))

  const { data: activityRow, error: activityError } = await supabase
    .from('activities')
    .insert({
      id: activityId,
      user_id: userId,
      name: workout.name,
      activity_type: 'Workout',
      activity_date: options.activityDate ?? todayISO(),
      distance_meters: null,
      moving_time_seconds: movingTimeSeconds,
      average_heartrate: null,
      max_heartrate: null,
      calories: metrics.calories,
      workout_id: workout.id,
      workout_sets_logged: setsLogged,
      ...(options.loggedAt ? { created_at: options.loggedAt } : {}),
    })
    .select()
    .single()
  if (activityError) throw new Error(activityError.message)

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
  if (exerciseError) throw new Error(exerciseError.message)

  const activity = mapActivityRow(activityRow)
  activity.exercises = (loggedExercises ?? []).map(mapActivityExerciseRow)
  return activity
}