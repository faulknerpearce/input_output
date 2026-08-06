import { useEffect, useMemo, useState } from 'react'
import {
  canComputeBmrFromBodyStats,
  computeMifflinStJeorBmr,
  resolveBmr,
  type NutritionGoals,
  type ProfileGender,
  type ProfileUpdate,
  type UserProfile,
} from '@input_output/shared'
import GoalsFormFields from '../components/GoalsFormFields'
import Modal from '../components/Modal'
import PageHeader from '../components/layout/PageHeader'
import { PageLoading } from '../components/layout/PageState'
import ZoneButton from '../components/layout/ZoneButton'
import { useAuth } from '../context/useAuth'
import { useProfile } from '../context/useProfile'
import { defaultGoalsForm, normalizeGoals } from '../lib/goalsForm'
import { inputBase, labelBase } from '../lib/styles'

type BodyUnitSystem = 'metric' | 'imperial'

function optionalInt(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function optionalWeight(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null
}

function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54
  let feet = Math.floor(totalInches / 12)
  let inches = Math.round(totalInches - feet * 12)
  if (inches === 12) {
    feet += 1
    inches = 0
  }
  return { feet, inches }
}

function feetInchesToCm(feet: number, inches: number): number {
  return Math.round(feet * 30.48 + inches * 2.54)
}

function kgToLb(kg: number): number {
  return Math.round(kg * 2.2046226218 * 10) / 10
}

function lbToKg(lb: number): number {
  return Math.round((lb / 2.2046226218) * 10) / 10
}

const GENDER_OPTIONS: { value: ProfileGender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

function goalsEqual(a: NutritionGoals, b: NutritionGoals): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

interface ProfileFormProps {
  profile: UserProfile
  updateProfile: (update: ProfileUpdate) => Promise<{ error: string | null }>
  onSignOut: () => void
}

function ProfileForm({ profile, updateProfile, onSignOut }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [age, setAge] = useState(profile.age === null ? '' : String(profile.age))
  const [unitSystem, setUnitSystem] = useState<BodyUnitSystem>('metric')
  const [heightCm, setHeightCm] = useState(profile.heightCm === null ? '' : String(profile.heightCm))
  const [heightFt, setHeightFt] = useState(() =>
    profile.heightCm === null ? '' : String(cmToFeetInches(profile.heightCm).feet),
  )
  const [heightIn, setHeightIn] = useState(() =>
    profile.heightCm === null ? '' : String(cmToFeetInches(profile.heightCm).inches),
  )
  const [weightKg, setWeightKg] = useState(profile.weightKg === null ? '' : String(profile.weightKg))
  const [weightLb, setWeightLb] = useState(() =>
    profile.weightKg === null ? '' : String(kgToLb(profile.weightKg)),
  )
  const [gender, setGender] = useState<ProfileGender>(profile.gender)
  const [bmrOverride, setBmrOverride] = useState(
    profile.bmrOverride === null ? '' : String(profile.bmrOverride),
  )
  const [usesWearable, setUsesWearable] = useState(profile.usesWearable)
  const [goalsForm, setGoalsForm] = useState(() => structuredClone(profile.nutritionGoals))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const resolvedHeightCm = useMemo(() => {
    if (unitSystem === 'metric') return optionalInt(heightCm)
    const ft = optionalInt(heightFt)
    const inches = optionalWeight(heightIn)
    if (ft === null && (inches === null || inches === 0)) return null
    return feetInchesToCm(ft ?? 0, inches ?? 0)
  }, [unitSystem, heightCm, heightFt, heightIn])

  const resolvedWeightKg = useMemo(() => {
    if (unitSystem === 'metric') return optionalWeight(weightKg)
    const lb = optionalWeight(weightLb)
    if (lb === null) return null
    return lbToKg(lb)
  }, [unitSystem, weightKg, weightLb])

  const draftProfile = useMemo(
    () => ({
      age: optionalInt(age),
      heightCm: resolvedHeightCm,
      weightKg: resolvedWeightKg,
      gender,
      bmrOverride: optionalWeight(bmrOverride),
      usesWearable,
    }),
    [age, resolvedHeightCm, resolvedWeightKg, gender, bmrOverride, usesWearable],
  )

  const isDirty = useMemo(() => {
    if (displayName.trim() !== profile.displayName.trim()) return true
    if (draftProfile.age !== profile.age) return true
    if (draftProfile.heightCm !== profile.heightCm) return true
    if (draftProfile.weightKg !== profile.weightKg) return true
    if (draftProfile.gender !== profile.gender) return true
    if (draftProfile.bmrOverride !== profile.bmrOverride) return true
    if (draftProfile.usesWearable !== profile.usesWearable) return true
    if (!goalsEqual(normalizeGoals(goalsForm), profile.nutritionGoals)) return true
    return false
  }, [displayName, draftProfile, goalsForm, profile])

  const calculatedBmr = useMemo(() => {
    if (!canComputeBmrFromBodyStats(draftProfile)) return null
    return computeMifflinStJeorBmr({
      weightKg: draftProfile.weightKg!,
      heightCm: draftProfile.heightCm!,
      age: draftProfile.age!,
      gender: draftProfile.gender,
    })
  }, [draftProfile])

  const activeBmr = useMemo(() => resolveBmr(draftProfile), [draftProfile])

  const markDirty = () => {
    setError(null)
    setSaved(false)
  }

  const resetGoalsDefaults = () => {
    setGoalsForm(defaultGoalsForm())
    markDirty()
  }

  const switchUnitSystem = (next: BodyUnitSystem) => {
    if (next === unitSystem) return
    if (next === 'imperial') {
      if (resolvedHeightCm !== null) {
        const { feet, inches } = cmToFeetInches(resolvedHeightCm)
        setHeightFt(String(feet))
        setHeightIn(String(inches))
      } else {
        setHeightFt('')
        setHeightIn('')
      }
      if (resolvedWeightKg !== null) {
        setWeightLb(String(kgToLb(resolvedWeightKg)))
      } else {
        setWeightLb('')
      }
    } else {
      if (resolvedHeightCm !== null) setHeightCm(String(resolvedHeightCm))
      else setHeightCm('')
      if (resolvedWeightKg !== null) setWeightKg(String(resolvedWeightKg))
      else setWeightKg('')
    }
    setUnitSystem(next)
  }

  const submit = async (): Promise<boolean> => {
    setSaving(true)
    setError(null)
    setSaved(false)

    const result = await updateProfile({
      displayName,
      age: draftProfile.age,
      heightCm: draftProfile.heightCm,
      weightKg: draftProfile.weightKg,
      gender: draftProfile.gender,
      bmrOverride: draftProfile.bmrOverride,
      usesWearable: draftProfile.usesWearable,
      nutritionGoals: normalizeGoals(goalsForm),
    })

    setSaving(false)
    if (result.error) {
      setError(result.error)
      return false
    }
    setSaved(true)
    return true
  }

  // Browser refresh / close
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // In-app hash links (SPA)
  useEffect(() => {
    if (!isDirty) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('javascript:')) return
      if (href.startsWith('#') || href.startsWith('/') || href.startsWith(window.location.origin)) {
        // Same-page anchors without route change
        if (href === '#' || href === window.location.hash) return
        e.preventDefault()
        e.stopPropagation()
        setPendingHref(href)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [isDirty])

  const leaveWithoutSaving = () => {
    const href = pendingHref
    setPendingHref(null)
    if (href) window.location.assign(href)
  }

  const saveAndLeave = async () => {
    const ok = await submit()
    if (!ok) return
    const href = pendingHref
    setPendingHref(null)
    if (href) window.location.assign(href)
  }

  const saveBar = (
    <div
      style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        marginBottom: 20,
      }}
    >
      <ZoneButton variant="primary" onClick={() => void submit()} disabled={saving || !isDirty}>
        {saving ? 'Saving...' : 'Save Profile'}
      </ZoneButton>
    </div>
  )

  return (
    <>
      {saveBar}

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {saved && !isDirty && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#ecfdf5',
            color: '#047857',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Your profile has been saved.
        </div>
      )}

      {isDirty && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#fff7ed',
            color: '#9a3412',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          You have unsaved changes. Tap <strong>Save Profile</strong> to keep them.
        </div>
      )}

      <section className="day-accordion" style={{ padding: 24, marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 600,
            margin: '0 0 4px 0',
          }}
        >
          Basic Information
        </h3>
        <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
          Optional details to keep your account up to date.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="profile-display-name" style={labelBase}>
              Display name
            </label>
            <input
              id="profile-display-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                markDirty()
              }}
              placeholder="How your name appears in the app"
              style={inputBase}
            />
          </div>

          <div className="modal-form-grid">
            <div>
              <label htmlFor="profile-age" style={labelBase}>
                Age
              </label>
              <input
                id="profile-age"
                type="number"
                min="13"
                max="120"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value)
                  markDirty()
                }}
                placeholder="Optional"
                style={inputBase}
              />
            </div>
            <div>
              <label htmlFor="profile-gender" style={labelBase}>
                Gender
              </label>
              <select
                id="profile-gender"
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value as ProfileGender)
                  markDirty()
                }}
                style={inputBase}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ ...labelBase, marginBottom: 0 }}>Height & weight</span>
              <div
                role="group"
                aria-label="Unit system"
                style={{
                  display: 'inline-flex',
                  borderRadius: 9999,
                  border: '1px solid #e4e4e7',
                  overflow: 'hidden',
                }}
              >
                {(
                  [
                    { id: 'metric', label: 'Metric' },
                    { id: 'imperial', label: 'Imperial' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => switchUnitSystem(opt.id)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: unitSystem === opt.id ? 'var(--zone-accent, #008957)' : '#fff',
                      color: unitSystem === opt.id ? '#fff' : '#52525b',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {unitSystem === 'metric' ? (
              <div className="modal-form-grid">
                <div>
                  <label htmlFor="profile-height-cm" style={labelBase}>
                    Height (cm)
                  </label>
                  <input
                    id="profile-height-cm"
                    type="number"
                    min="100"
                    max="250"
                    value={heightCm}
                    onChange={(e) => {
                      setHeightCm(e.target.value)
                      markDirty()
                    }}
                    placeholder="e.g. 170"
                    style={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="profile-weight-kg" style={labelBase}>
                    Weight (kg)
                  </label>
                  <input
                    id="profile-weight-kg"
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => {
                      setWeightKg(e.target.value)
                      markDirty()
                    }}
                    placeholder="e.g. 68"
                    style={inputBase}
                  />
                </div>
              </div>
            ) : (
              <div className="modal-form-grid">
                <div>
                  <label htmlFor="profile-height-ft" style={labelBase}>
                    Height (ft / in)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="profile-height-ft"
                      type="number"
                      min="3"
                      max="8"
                      value={heightFt}
                      onChange={(e) => {
                        setHeightFt(e.target.value)
                        markDirty()
                      }}
                      placeholder="ft"
                      style={{ ...inputBase, flex: 1 }}
                      aria-label="Height feet"
                    />
                    <input
                      id="profile-height-in"
                      type="number"
                      min="0"
                      max="11.9"
                      step="0.1"
                      value={heightIn}
                      onChange={(e) => {
                        setHeightIn(e.target.value)
                        markDirty()
                      }}
                      placeholder="in"
                      style={{ ...inputBase, flex: 1 }}
                      aria-label="Height inches"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="profile-weight-lb" style={labelBase}>
                    Weight (lb)
                  </label>
                  <input
                    id="profile-weight-lb"
                    type="number"
                    min="66"
                    max="660"
                    step="0.1"
                    value={weightLb}
                    onChange={(e) => {
                      setWeightLb(e.target.value)
                      markDirty()
                    }}
                    placeholder="e.g. 150"
                    style={inputBase}
                  />
                </div>
              </div>
            )}
            <p style={{ fontSize: 12, color: '#a1a1aa', margin: '8px 0 0 0' }}>
              Stored as metric for BMR calculations. Switch units anytime — values convert
              automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="day-accordion" style={{ padding: 24, marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 600,
            margin: '0 0 4px 0',
          }}
        >
          Basal Metabolic Rate
        </h3>
        <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
          BMR is the default day base for output on the dashboard. Calculated with Mifflin-St Jeor
          from age, height, weight, and gender. If you use a fitness tracker, you can replace BMR
          with that day&apos;s device total.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f4f4f5' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#71717a', margin: '0 0 6px 0' }}>
                Calculated BMR
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: '#18181b' }}>
                {calculatedBmr !== null ? `${calculatedBmr.toLocaleString()} kcal` : '—'}
              </p>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#ecfdf5' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#047857', margin: '0 0 6px 0' }}>
                Active BMR
              </p>
              <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: '#047857' }}>
                {activeBmr.bmr.toLocaleString()} kcal
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="profile-bmr-override" style={labelBase}>
              Manual BMR override (kcal)
            </label>
            <input
              id="profile-bmr-override"
              type="number"
              min="800"
              max="5000"
              step="1"
              value={bmrOverride}
              onChange={(e) => {
                setBmrOverride(e.target.value)
                markDirty()
              }}
              placeholder="Optional — replaces calculated BMR"
              style={inputBase}
            />
            <p style={{ fontSize: 12, color: '#a1a1aa', margin: '8px 0 0 0' }}>
              {activeBmr.source === 'override'
                ? 'Using your manual override when no device total is set.'
                : activeBmr.source === 'fallback'
                  ? 'Add age, height, and weight to calculate BMR, or set a manual override.'
                  : 'Using calculated BMR when no device total is set.'}
            </p>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid #e4e4e7',
              background: usesWearable ? '#f0fdf4' : '#fafafa',
            }}
          >
            <label
              htmlFor="profile-uses-wearable"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                margin: 0,
              }}
            >
              <input
                id="profile-uses-wearable"
                type="checkbox"
                checked={usesWearable}
                onChange={(e) => {
                  setUsesWearable(e.target.checked)
                  markDirty()
                }}
                style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
              />
              <span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#18181b',
                    marginBottom: 4,
                  }}
                >
                  I use a fitness tracker for daily burn
                </span>
                <span style={{ fontSize: 12, color: '#71717a', lineHeight: 1.45 }}>
                  When on, the Daily energy card lets you enter your watch&apos;s total calories for
                  each day. That replaces resting BMR as the day&apos;s base. Workouts you log still
                  add on top — leave their calories at 0 if the watch already counted them.
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="day-accordion" style={{ padding: 24, marginBottom: 24 }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 600,
            margin: '0 0 4px 0',
          }}
        >
          Daily Goals
        </h3>
        <p style={{ fontSize: 13, color: '#71717a', margin: '0 0 20px 0' }}>
          These targets power the dashboard and inputs panels. Calories and protein ranges also set
          the net energy goal band.
        </p>

        <GoalsFormFields
          form={goalsForm}
          onChange={(next) => {
            setGoalsForm(next)
            markDirty()
          }}
          idPrefix="profile-goal"
        />
      </section>

      {saveBar}

      <div
        style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid #e4e4e7',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <ZoneButton variant="danger" onClick={onSignOut}>
          Log out
        </ZoneButton>
        <ZoneButton onClick={resetGoalsDefaults}>Reset goal defaults</ZoneButton>
      </div>

      {pendingHref && (
        <Modal titleId="unsaved-changes-title" onClose={() => setPendingHref(null)}>
          <h3
            id="unsaved-changes-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 600,
              margin: '0 0 8px 0',
            }}
          >
            Don&apos;t forget to save
          </h3>
          <p style={{ fontSize: 14, color: '#52525b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            You have unsaved profile changes. Save them before leaving this page?
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <ZoneButton onClick={() => setPendingHref(null)}>Keep editing</ZoneButton>
            <ZoneButton onClick={leaveWithoutSaving}>Leave without saving</ZoneButton>
            <ZoneButton variant="primary" onClick={() => void saveAndLeave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save and leave'}
            </ZoneButton>
          </div>
        </Modal>
      )}
    </>
  )
}

export default function ProfilePage() {
  const { profile, loading, updateProfile } = useProfile()
  const { signOut } = useAuth()

  if (loading) return <PageLoading message="Loading profile..." />

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Manage your basic information and daily nutrition targets."
      />

      <ProfileForm
        profile={profile}
        updateProfile={updateProfile}
        onSignOut={() => {
          void signOut()
        }}
      />
    </div>
  )
}
