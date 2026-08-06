import {
  buildProfileUpdatePayload,
  detectBrowserTimeZone,
  mapProfileRow,
  type ProfileUpdate,
  type UserProfile,
} from '@input_output/shared'
import { supabase } from './supabase'

export type { ProfileUpdate, UserProfile }

/** True when PostgREST/Postgres reports a missing profiles column. */
function isMissingProfileColumnError(message: string): boolean {
  const m = message.toLowerCase()
  if (/daily_device_totals|activities|food_entries/i.test(message)) return false
  return (
    /could not find the '?(gender|bmr_override|uses_wearable|time_zone)'? column/i.test(message) ||
    /column ['"]?profiles?\.(gender|bmr_override|uses_wearable|time_zone)/i.test(message) ||
    (/schema cache/i.test(m) &&
      /(gender|bmr_override|uses_wearable|time_zone)/i.test(message) &&
      /column|profiles?/i.test(m)) ||
    // Postgres undefined_column
    (/42703/.test(message) &&
      /(gender|bmr_override|uses_wearable|time_zone)/i.test(message))
  )
}

function isMissingUsesWearableError(message: string): boolean {
  return (
    /could not find the '?uses_wearable'? column/i.test(message) ||
    /column ['"]?profiles?\.uses_wearable/i.test(message) ||
    (/schema cache/i.test(message) && /uses_wearable/i.test(message)) ||
    (/42703/.test(message) && /uses_wearable/i.test(message))
  )
}

function readUsesWearableFlag(data: Record<string, unknown> | null | undefined): boolean | null {
  if (!data || !('uses_wearable' in data)) return null
  const raw = data.uses_wearable
  if (raw === true || raw === 'true' || raw === 1 || raw === '1' || raw === 't') return true
  if (raw === false || raw === 'false' || raw === 0 || raw === '0' || raw === 'f') return false
  return null
}

/**
 * Load the full profiles row with select('*').
 * Requesting explicit newer columns (uses_wearable, bmr_override, …) returns HTTP 400
 * when those migrations have not been applied — which shows up as console errors on every load.
 * select('*') returns whatever columns exist; mapProfileRow defaults missing fields.
 */
async function loadProfileRow(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Profile not found')
  return data as Record<string, unknown>
}

/** Persist uses_wearable alone and verify the value read back. */
async function saveUsesWearableOnly(
  userId: string,
  usesWearable: boolean,
): Promise<{ ok: true; value: boolean } | { ok: false; error: string }> {
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ uses_wearable: usesWearable })
    .eq('id', userId)

  if (updateError) {
    return {
      ok: false,
      error: isMissingUsesWearableError(updateError.message)
        ? 'Fitness tracker setting could not be saved (run migration 0018_wearable_day_total.sql).'
        : updateError.message,
    }
  }

  const { data, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (selectError) {
    return { ok: false, error: selectError.message }
  }

  const verified = readUsesWearableFlag(data as Record<string, unknown> | null)
  if (verified === null) {
    return {
      ok: false,
      error:
        'Fitness tracker setting was written but could not be verified. Run migration 0018 if needed, then refresh.',
    }
  }
  if (verified !== usesWearable) {
    return {
      ok: false,
      error: `Fitness tracker setting did not stick (expected ${usesWearable}, got ${verified}).`,
    }
  }
  return { ok: true, value: verified }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const row = await loadProfileRow(userId)
  const profile = mapProfileRow(row as Parameters<typeof mapProfileRow>[0])
  const browserTimeZone = detectBrowserTimeZone()
  if (profile.timeZone !== browserTimeZone) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ time_zone: browserTimeZone })
      .eq('id', userId)

    if (updateError && !isMissingProfileColumnError(updateError.message)) {
      throw new Error(updateError.message)
    }

    const refreshed = await loadProfileRow(userId)
    return mapProfileRow({
      ...refreshed,
      time_zone: browserTimeZone,
    } as Parameters<typeof mapProfileRow>[0])
  }

  return profile
}

export async function saveProfileUpdate(
  userId: string,
  update: ProfileUpdate,
): Promise<UserProfile> {
  const usesWearable = update.usesWearable
  const coreUpdate: ProfileUpdate = { ...update, usesWearable: undefined }
  const payload = buildProfileUpdatePayload(coreUpdate)

  type ProfileUpdateRow = {
    display_name?: string
    nutrition_goals?: ProfileUpdate['nutritionGoals']
    age?: number | null
    height_cm?: number | null
    weight_kg?: number | null
    gender?: string
    bmr_override?: number | null
    uses_wearable?: boolean
    time_zone?: string
  }

  // Strip optional newer fields on retry if the DB is missing those columns.
  const attemptSave = async (body: ProfileUpdateRow) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(body)
      .eq('id', userId)
      .select('*')
      .single()
    return { data: data as Record<string, unknown> | null, error }
  }

  let saved = await attemptSave(payload as ProfileUpdateRow)

  if (saved.error && isMissingProfileColumnError(saved.error.message)) {
    const legacy: ProfileUpdateRow = { ...payload }
    if (isMissingUsesWearableError(saved.error.message)) {
      delete legacy.uses_wearable
    } else {
      delete legacy.gender
      delete legacy.bmr_override
      delete legacy.uses_wearable
    }
    saved = await attemptSave(legacy)
  }

  if (saved.error) throw new Error(saved.error.message)
  if (!saved.data) throw new Error('Profile not found')

  if (usesWearable !== undefined) {
    const wear = await saveUsesWearableOnly(userId, usesWearable)
    if (!wear.ok) throw new Error(wear.error)
  }

  if (update.displayName !== undefined) {
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: update.displayName.trim() },
    })
    if (authError) throw new Error(authError.message)
  }

  const reloaded = await loadProfileRow(userId)
  return mapProfileRow(reloaded as Parameters<typeof mapProfileRow>[0])
}
