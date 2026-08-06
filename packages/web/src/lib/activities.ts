import {
  buildActivityExerciseInsertPayload,
  buildActivityInsertPayload,
  buildActivityUpdatePayload,
  buildForkActivityInput,
  mapActivityExerciseRow,
  mapActivityRow,
  offsetDateISO,
  parseActivityInput,
  sumActivityTotals,
  todayISO,
  type Activity,
  type ActivityTotals,
  type ActivityWrite,
} from '@input_output/shared'
import { markActivityShareSaved } from './sharing'
import { supabase } from './supabase'

async function attachActivityExercises(activities: Activity[]): Promise<Activity[]> {
  if (activities.length === 0) return activities

  const workoutActivityIds = activities
    .filter((activity) => activity.workoutId !== null)
    .map((activity) => activity.id)
  if (workoutActivityIds.length === 0) return activities

  const { data, error } = await supabase
    .from('activity_exercises')
    .select('*')
    .in('activity_id', workoutActivityIds)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)

  const exercisesByActivity = new Map<string, ReturnType<typeof mapActivityExerciseRow>[]>()
  for (const row of data ?? []) {
    const mapped = mapActivityExerciseRow(row)
    const list = exercisesByActivity.get(row.activity_id) ?? []
    list.push(mapped)
    exercisesByActivity.set(row.activity_id, list)
  }

  return activities.map((activity) => ({
    ...activity,
    exercises: exercisesByActivity.get(activity.id) ?? activity.exercises,
  }))
}

export type { Activity, ActivityWrite }

export interface ActivityDaySummary {
  date: string
  activities: Activity[]
  totals: ActivityTotals
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return user.id
}

export async function fetchActivities(date: string = todayISO()): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('activity_date', date)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return attachActivityExercises((data ?? []).map(mapActivityRow))
}

export async function fetchActivityDaySummaries(daysBack = 30): Promise<ActivityDaySummary[]> {
  const today = todayISO()
  const startDate = offsetDateISO(daysBack)

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .gte('activity_date', startDate)
    .lte('activity_date', today)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const activities = await attachActivityExercises((data ?? []).map(mapActivityRow))
  const grouped = new Map<string, Activity[]>()
  for (const activity of activities) {
    const list = grouped.get(activity.activityDate) ?? []
    list.push(activity)
    grouped.set(activity.activityDate, list)
  }

  if (!grouped.has(today)) {
    grouped.set(today, [])
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayActivities]) => ({
      date,
      activities: dayActivities,
      totals: sumActivityTotals(dayActivities),
    }))
}

export async function addActivity(
  input: ActivityWrite,
  options?: { activityDate?: string },
): Promise<Activity> {
  const userId = await requireUserId()
  const parsed = parseActivityInput(input as Record<string, unknown>)
  if (!parsed.ok) throw new Error(parsed.error)

  const activity = {
    ...buildActivityInsertPayload(
      parsed.value,
      crypto.randomUUID(),
      userId,
      options?.activityDate ?? todayISO(),
    ),
    ...(input.loggedAt ? { created_at: input.loggedAt } : {}),
  }
  const { data, error } = await supabase.from('activities').insert(activity).select().single()
  if (error) throw new Error(error.message)
  return mapActivityRow(data)
}

export async function updateActivity(id: string, input: ActivityWrite): Promise<Activity> {
  const parsed = parseActivityInput(input as Record<string, unknown>)
  if (!parsed.ok) throw new Error(parsed.error)

  const { data, error } = await supabase
    .from('activities')
    .update({
      ...buildActivityUpdatePayload(parsed.value),
      ...(input.loggedAt ? { created_at: input.loggedAt } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return mapActivityRow(data)
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

async function fetchActivityById(id: string): Promise<Activity> {
  const { data, error } = await supabase.from('activities').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  const [activity] = await attachActivityExercises([mapActivityRow(data)])
  return activity
}

export async function forkActivity(activityId: string, shareId?: string): Promise<Activity> {
  const source = await fetchActivityById(activityId)
  let activity = await addActivity({ ...buildForkActivityInput(source), loggedAt: source.loggedAt })

  if (source.exercises.length > 0) {
    const userId = await requireUserId()
    const exerciseRows = source.exercises.map((exercise, index) =>
      buildActivityExerciseInsertPayload(
        activity.id,
        userId,
        {
          workoutExerciseId: null,
          name: exercise.name,
          sortOrder: index,
          repsCompleted: exercise.repsCompleted,
        },
        crypto.randomUUID(),
      ),
    )
    const { data: loggedExercises, error } = await supabase
      .from('activity_exercises')
      .insert(exerciseRows)
      .select()
    if (error) throw new Error(error.message)
    activity = {
      ...activity,
      exercises: (loggedExercises ?? []).map(mapActivityExerciseRow),
    }
  }

  if (shareId) {
    await markActivityShareSaved(shareId, activity.id)
  }

  return activity
}
