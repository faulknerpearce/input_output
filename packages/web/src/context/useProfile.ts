import { useContext } from 'react'
import { DEFAULT_NUTRITION_GOALS } from '@input_output/shared'
import { ProfileContext } from './profile-context'

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return context
}

export function useProfileOptional() {
  return useContext(ProfileContext)
}

export function useNutritionGoals() {
  return useProfileOptional()?.profile.nutritionGoals ?? DEFAULT_NUTRITION_GOALS
}