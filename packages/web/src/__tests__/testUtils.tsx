import { render, type RenderOptions } from '@testing-library/react'
import {
  DEFAULT_NUTRITION_GOALS,
  DEFAULT_PROFILE_GENDER,
  DEFAULT_TIMEZONE,
  type UserProfile,
} from '@input_output/shared'
import type { User } from '@supabase/supabase-js'
import type { ReactElement, ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../context/auth-context'
import { ProfileContext, type ProfileContextValue } from '../context/profile-context'

export const mockProfile: UserProfile = {
  displayName: 'Alex',
  age: 30,
  heightCm: 170,
  weightKg: 68,
  gender: DEFAULT_PROFILE_GENDER,
  bmrOverride: null,
  usesWearable: false,
  nutritionGoals: DEFAULT_NUTRITION_GOALS,
  timeZone: DEFAULT_TIMEZONE,
}

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'alex@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User
}

export function createAuthContextValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    session: null,
    user: createMockUser(),
    loading: false,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    ...overrides,
  }
}

export function createProfileContextValue(
  overrides: Partial<ProfileContextValue> = {},
): ProfileContextValue {
  return {
    profile: mockProfile,
    loading: false,
    updateProfile: async () => ({ error: null }),
    updateGoals: async () => ({ error: null }),
    ...overrides,
  }
}

interface ProvidersProps {
  auth?: AuthContextValue | null
  profile?: ProfileContextValue | null
  children: ReactNode
}

function TestProviders({ auth, profile, children }: ProvidersProps) {
  let content = children
  if (profile) {
    content = <ProfileContext.Provider value={profile}>{content}</ProfileContext.Provider>
  }
  if (auth) {
    content = <AuthContext.Provider value={auth}>{content}</AuthContext.Provider>
  }
  return content
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  auth?: AuthContextValue | null
  profile?: ProfileContextValue | null
}

export function renderWithProviders(
  ui: ReactElement,
  { auth = createAuthContextValue(), profile = null, ...options }: RenderWithProvidersOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders auth={auth} profile={profile}>
        {children}
      </TestProviders>
    ),
    ...options,
  })
}
