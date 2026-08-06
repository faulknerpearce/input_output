import {
  mapActivityExerciseRow,
  mapActivityRow,
  mapActivityShareRow,
  mapEntryShareRow,
  mapRecipeIngredientRow,
  mapRecipeRow,
  mapRecipeShareRow,
  mapRow,
  mapShareUserRow,
  mapWorkoutExerciseRow,
  mapWorkoutRow,
  mapWorkoutShareRow,
  perServingTotals,
  sumRecipeIngredients,
  type Activity,
  type ActivityShareRecord,
  type EntryShareRecord,
  type FoodEntry,
  type RecipeShareRecord,
  type RecipeSummary,
  type ShareUserResult,
  type WorkoutShareRecord,
  type WorkoutSummary,
} from '@input_output/shared'
import { supabase } from './supabase'

export interface SharedRecipeItem {
  share: RecipeShareRecord
  recipe: RecipeSummary
}

export interface SharedWorkoutItem {
  share: WorkoutShareRecord
  workout: WorkoutSummary
}

export interface SharedEntryItem {
  share: EntryShareRecord
  entry: FoodEntry
}

export interface SharedActivityItem {
  share: ActivityShareRecord
  activity: Activity
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

async function requireDisplayName(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)
  return data.display_name
}

export async function findUsersForShare(query: string): Promise<ShareUserResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const { data, error } = await supabase.rpc('find_users_for_share', {
    search_query: trimmed,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapShareUserRow)
}

export async function shareRecipe(
  recipeId: string,
  recipientUserId: string,
  recipientDisplayName: string,
): Promise<RecipeShareRecord> {
  const userId = await requireUserId()
  if (recipientUserId === userId) throw new Error('You cannot share with yourself')

  const ownerDisplayName = await requireDisplayName(userId)
  const { data, error } = await supabase
    .from('recipe_shares')
    .insert({
      recipe_id: recipeId,
      owner_id: userId,
      shared_with_user_id: recipientUserId,
      owner_display_name: ownerDisplayName,
      shared_with_display_name: recipientDisplayName,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRecipeShareRow(data)
}

export async function shareEntry(
  foodEntryId: string,
  recipientUserId: string,
  recipientDisplayName: string,
): Promise<EntryShareRecord> {
  const userId = await requireUserId()
  if (recipientUserId === userId) throw new Error('You cannot share with yourself')

  const ownerDisplayName = await requireDisplayName(userId)
  const { data, error } = await supabase
    .from('food_entry_shares')
    .insert({
      food_entry_id: foodEntryId,
      owner_id: userId,
      shared_with_user_id: recipientUserId,
      owner_display_name: ownerDisplayName,
      shared_with_display_name: recipientDisplayName,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapEntryShareRow(data)
}

export async function shareActivity(
  activityId: string,
  recipientUserId: string,
  recipientDisplayName: string,
): Promise<ActivityShareRecord> {
  const userId = await requireUserId()
  if (recipientUserId === userId) throw new Error('You cannot share with yourself')

  const ownerDisplayName = await requireDisplayName(userId)
  const { data, error } = await supabase
    .from('activity_shares')
    .insert({
      activity_id: activityId,
      owner_id: userId,
      shared_with_user_id: recipientUserId,
      owner_display_name: ownerDisplayName,
      shared_with_display_name: recipientDisplayName,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapActivityShareRow(data)
}

export async function shareWorkout(
  workoutId: string,
  recipientUserId: string,
  recipientDisplayName: string,
): Promise<WorkoutShareRecord> {
  const userId = await requireUserId()
  if (recipientUserId === userId) throw new Error('You cannot share with yourself')

  const ownerDisplayName = await requireDisplayName(userId)
  const { data, error } = await supabase
    .from('workout_shares')
    .insert({
      workout_id: workoutId,
      owner_id: userId,
      shared_with_user_id: recipientUserId,
      owner_display_name: ownerDisplayName,
      shared_with_display_name: recipientDisplayName,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapWorkoutShareRow(data)
}

export async function revokeRecipeShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('recipe_shares').delete().eq('id', shareId)
  if (error) throw new Error(error.message)
}

const SHARE_DISMISS_FORBIDDEN = 'Share not found or you do not have permission to remove it'

async function dismissShareForRecipient(
  table: 'recipe_shares' | 'food_entry_shares' | 'activity_shares' | 'workout_shares',
  shareId: string,
): Promise<void> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', shareId)
    .eq('shared_with_user_id', userId)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error(SHARE_DISMISS_FORBIDDEN)
}

/** Remove a recipe share from the recipient's Shared With Me list. */
export async function dismissRecipeShare(shareId: string): Promise<void> {
  await dismissShareForRecipient('recipe_shares', shareId)
}

export async function dismissEntryShare(shareId: string): Promise<void> {
  await dismissShareForRecipient('food_entry_shares', shareId)
}

export async function dismissActivityShare(shareId: string): Promise<void> {
  await dismissShareForRecipient('activity_shares', shareId)
}

export async function dismissWorkoutShare(shareId: string): Promise<void> {
  await dismissShareForRecipient('workout_shares', shareId)
}

export async function revokeEntryShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('food_entry_shares').delete().eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function revokeActivityShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('activity_shares').delete().eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function revokeWorkoutShare(shareId: string): Promise<void> {
  const { error } = await supabase.from('workout_shares').delete().eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function fetchRecipeSharesForResource(recipeId: string): Promise<RecipeShareRecord[]> {
  const { data, error } = await supabase
    .from('recipe_shares')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRecipeShareRow)
}

export async function fetchEntrySharesForResource(
  foodEntryId: string,
): Promise<EntryShareRecord[]> {
  const { data, error } = await supabase
    .from('food_entry_shares')
    .select('*')
    .eq('food_entry_id', foodEntryId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapEntryShareRow)
}

export async function fetchActivitySharesForResource(
  activityId: string,
): Promise<ActivityShareRecord[]> {
  const { data, error } = await supabase
    .from('activity_shares')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapActivityShareRow)
}

export async function fetchWorkoutSharesForResource(
  workoutId: string,
): Promise<WorkoutShareRecord[]> {
  const { data, error } = await supabase
    .from('workout_shares')
    .select('*')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapWorkoutShareRow)
}

async function fetchRecipeSummariesByIds(ids: string[]): Promise<Map<string, RecipeSummary>> {
  if (ids.length === 0) return new Map()

  const { data: recipeRows, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .in('id', ids)
  if (recipeError) throw new Error(recipeError.message)

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .in('recipe_id', ids)
    .order('sort_order', { ascending: true })
  if (ingredientError) throw new Error(ingredientError.message)

  const ingredientsByRecipe = new Map<string, ReturnType<typeof mapRecipeIngredientRow>[]>()
  for (const row of ingredientRows ?? []) {
    const mapped = mapRecipeIngredientRow(row)
    const list = ingredientsByRecipe.get(row.recipe_id) ?? []
    list.push(mapped)
    ingredientsByRecipe.set(row.recipe_id, list)
  }

  const summaryById = new Map<string, RecipeSummary>()
  for (const row of recipeRows ?? []) {
    const recipe = mapRecipeRow(row)
    const ingredients = ingredientsByRecipe.get(row.id) ?? []
    const batchTotals = sumRecipeIngredients(ingredients)
    summaryById.set(row.id, {
      ...recipe,
      batchTotals,
      perServingTotals: perServingTotals(batchTotals, recipe.defaultServings),
      ingredientCount: ingredients.length,
    })
  }

  return summaryById
}

async function fetchWorkoutSummariesByIds(ids: string[]): Promise<Map<string, WorkoutSummary>> {
  if (ids.length === 0) return new Map()

  const { data: workoutRows, error: workoutError } = await supabase
    .from('workouts')
    .select('*')
    .in('id', ids)
  if (workoutError) throw new Error(workoutError.message)

  const { data: exerciseRows, error: exerciseError } = await supabase
    .from('workout_exercises')
    .select('*')
    .in('workout_id', ids)
    .order('sort_order', { ascending: true })
  if (exerciseError) throw new Error(exerciseError.message)

  const exercisesByWorkout = new Map<string, ReturnType<typeof mapWorkoutExerciseRow>[]>()
  for (const row of exerciseRows ?? []) {
    const mapped = mapWorkoutExerciseRow(row)
    const list = exercisesByWorkout.get(row.workout_id) ?? []
    list.push(mapped)
    exercisesByWorkout.set(row.workout_id, list)
  }

  const summaryById = new Map<string, WorkoutSummary>()
  for (const row of workoutRows ?? []) {
    const workout = mapWorkoutRow(row)
    const exercises = exercisesByWorkout.get(row.id) ?? []
    summaryById.set(row.id, {
      ...workout,
      exerciseCount: exercises.length,
    })
  }

  return summaryById
}

export async function fetchRecipesSharedWithMe(): Promise<SharedRecipeItem[]> {
  const userId = await requireUserId()
  const { data: shares, error } = await supabase
    .from('recipe_shares')
    .select('*')
    .eq('shared_with_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!shares?.length) return []

  const summaryById = await fetchRecipeSummariesByIds(shares.map((share) => share.recipe_id))

  return shares
    .map((share) => {
      const recipe = summaryById.get(share.recipe_id)
      if (!recipe) return null
      return { share: mapRecipeShareRow(share), recipe }
    })
    .filter((item): item is SharedRecipeItem => item !== null)
}

export async function fetchEntriesSharedWithMe(): Promise<SharedEntryItem[]> {
  const userId = await requireUserId()
  const { data: shares, error } = await supabase
    .from('food_entry_shares')
    .select('*')
    .eq('shared_with_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!shares?.length) return []

  const entryIds = shares.map((share) => share.food_entry_id)
  const { data: entryRows, error: entryError } = await supabase
    .from('food_entries')
    .select('*')
    .in('id', entryIds)
  if (entryError) throw new Error(entryError.message)

  const entryById = new Map((entryRows ?? []).map((row) => [row.id, mapRow(row)]))

  return shares
    .map((share) => {
      const entry = entryById.get(share.food_entry_id)
      if (!entry) return null
      return { share: mapEntryShareRow(share), entry }
    })
    .filter((item): item is SharedEntryItem => item !== null)
}

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

export async function fetchActivitiesSharedWithMe(): Promise<SharedActivityItem[]> {
  const userId = await requireUserId()
  const { data: shares, error } = await supabase
    .from('activity_shares')
    .select('*')
    .eq('shared_with_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!shares?.length) return []

  const activityIds = shares.map((share) => share.activity_id)
  const { data: activityRows, error: activityError } = await supabase
    .from('activities')
    .select('*')
    .in('id', activityIds)
  if (activityError) throw new Error(activityError.message)

  const activityById = new Map(
    (await attachActivityExercises((activityRows ?? []).map(mapActivityRow))).map((activity) => [
      activity.id,
      activity,
    ]),
  )

  return shares
    .map((share) => {
      const activity = activityById.get(share.activity_id)
      if (!activity) return null
      return { share: mapActivityShareRow(share), activity }
    })
    .filter((item): item is SharedActivityItem => item !== null)
}

export async function fetchWorkoutsSharedWithMe(): Promise<SharedWorkoutItem[]> {
  const userId = await requireUserId()
  const { data: shares, error } = await supabase
    .from('workout_shares')
    .select('*')
    .eq('shared_with_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!shares?.length) return []

  const summaryById = await fetchWorkoutSummariesByIds(shares.map((share) => share.workout_id))

  return shares
    .map((share) => {
      const workout = summaryById.get(share.workout_id)
      if (!workout) return null
      return { share: mapWorkoutShareRow(share), workout }
    })
    .filter((item): item is SharedWorkoutItem => item !== null)
}

export async function markRecipeShareSaved(shareId: string, savedCopyId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_shares')
    .update({ saved_copy_id: savedCopyId })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function markActivityShareSaved(shareId: string, savedCopyId: string): Promise<void> {
  const { error } = await supabase
    .from('activity_shares')
    .update({ saved_copy_id: savedCopyId })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function markEntryShareSaved(shareId: string, savedCopyId: string): Promise<void> {
  const { error } = await supabase
    .from('food_entry_shares')
    .update({ saved_copy_id: savedCopyId })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function markWorkoutShareSaved(shareId: string, savedCopyId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_shares')
    .update({ saved_copy_id: savedCopyId })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}