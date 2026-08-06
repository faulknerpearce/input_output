import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@input_output/shared'

export type InputOutputSupabase = SupabaseClient<Database>

export function createAuthenticatedSupabase(
  url: string,
  anonKey: string,
  accessToken: string,
): InputOutputSupabase {
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}