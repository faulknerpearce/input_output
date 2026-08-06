import { createContext } from 'react'
import type { NutritionGoals } from '@input_output/shared'
import type { ProfileUpdate, UserProfile } from '../lib/profile'

export interface ProfileContextValue {
  profile: UserProfile
  loading: boolean
  updateProfile: (update: ProfileUpdate) => Promise<{ error: string | null }>
  updateGoals: (goals: NutritionGoals) => Promise<{ error: string | null }>
}

export const ProfileContext = createContext<ProfileContextValue | null>(null)