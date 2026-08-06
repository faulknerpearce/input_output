import {
  DEFAULT_NUTRITION_GOALS,
  DEFAULT_PROFILE_GENDER,
  DEFAULT_TIMEZONE,
  validateNutritionGoals,
  validateProfileUpdate,
  type NutritionGoals,
  type ProfileUpdate,
  type UserProfile,
} from '@input_output/shared'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchUserProfile, saveProfileUpdate } from '../lib/profile'
import { useAuth } from './useAuth'
import { ProfileContext } from './profile-context'

const FALLBACK_PROFILE: UserProfile = {
  displayName: 'Account',
  age: null,
  heightCm: null,
  weightKg: null,
  gender: DEFAULT_PROFILE_GENDER,
  bmrOverride: null,
  usesWearable: false,
  nutritionGoals: DEFAULT_NUTRITION_GOALS,
  timeZone: DEFAULT_TIMEZONE,
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) {
    throw new Error('ProfileProvider requires an authenticated user')
  }

  const userId = user.id
  const fallbackDisplayName = user.email?.split('@')[0] ?? 'Account'
  const [profile, setProfile] = useState<UserProfile>(FALLBACK_PROFILE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchUserProfile(userId)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile)
      })
      .catch((err) => {
        console.error('[ProfileProvider] failed to load profile', err)
        if (!cancelled) {
          setProfile({
            ...FALLBACK_PROFILE,
            displayName: fallbackDisplayName,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, fallbackDisplayName])

  const updateProfile = useCallback(
    async (update: ProfileUpdate) => {
      const validated = validateProfileUpdate(update)
      if (!validated.ok) return { error: validated.error }

      if (update.nutritionGoals) {
        const goalsValidated = validateNutritionGoals(update.nutritionGoals)
        if (!goalsValidated.ok) return { error: goalsValidated.error }
      }

      try {
        const saved = await saveProfileUpdate(userId, validated.value)
        setProfile(saved)
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to save profile' }
      }
    },
    [userId],
  )

  const updateGoals = useCallback(
    async (goals: NutritionGoals) => updateProfile({ nutritionGoals: goals }),
    [updateProfile],
  )

  const value = useMemo(
    () => ({ profile, loading, updateProfile, updateGoals }),
    [profile, loading, updateProfile, updateGoals],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}