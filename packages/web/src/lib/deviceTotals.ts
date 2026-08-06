import { validateDeviceTotalKcal } from '@input_output/shared'
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

/** Fetch device total for a single energy date, or null if unset. */
export async function fetchDeviceTotal(energyDate: string): Promise<number | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('daily_device_totals')
    .select('device_total_kcal')
    .eq('user_id', userId)
    .eq('energy_date', energyDate)
    .maybeSingle()

  if (error) {
    if (/daily_device_totals|schema cache|does not exist/i.test(error.message)) {
      return null
    }
    throw new Error(error.message)
  }
  if (!data) return null
  return data.device_total_kcal
}

/** Map energy_date → device_total_kcal for a date range (inclusive). */
export async function fetchDeviceTotalsByDate(
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('daily_device_totals')
    .select('energy_date, device_total_kcal')
    .eq('user_id', userId)
    .gte('energy_date', startDate)
    .lte('energy_date', endDate)

  if (error) {
    if (/daily_device_totals|schema cache|does not exist/i.test(error.message)) {
      return {}
    }
    throw new Error(error.message)
  }

  const byDate: Record<string, number> = {}
  for (const row of data ?? []) {
    byDate[row.energy_date] = row.device_total_kcal
  }
  return byDate
}

/** Upsert device total for a day. */
export async function saveDeviceTotal(energyDate: string, kcal: number): Promise<number> {
  const validated = validateDeviceTotalKcal(kcal)
  if (!validated.ok) throw new Error(validated.error)

  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('daily_device_totals')
    .upsert(
      {
        user_id: userId,
        energy_date: energyDate,
        device_total_kcal: validated.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,energy_date' },
    )
    .select('device_total_kcal')
    .single()

  if (error) throw new Error(error.message)
  return data.device_total_kcal
}

/** Remove device total for a day (revert base to BMR). */
export async function clearDeviceTotal(energyDate: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('daily_device_totals')
    .delete()
    .eq('user_id', userId)
    .eq('energy_date', energyDate)

  if (error) throw new Error(error.message)
}
