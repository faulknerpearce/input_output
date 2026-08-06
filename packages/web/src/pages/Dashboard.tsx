import {
  computeNetBalance,
  formatDuration,
  formatPortionLabel,
  resolveBmr,
  resolveTrendsDateRange,
  shiftISODate,
  sumActivityTotals,
  sumTotals,
  todayISO,
  type DailyEnergySnapshot,
  type TrendsRangePreset,
} from '@input_output/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNutritionGoals, useProfile } from '../context/useProfile'
import { sectionHeader as sectionLabelStyle } from '../lib/styles'
import ActivityOverviewPanel from '../components/dashboard/ActivityOverviewPanel'
import DailyIoCard from '../components/dashboard/DailyIoCard'

import NutritionRingsPanel from '../components/dashboard/NutritionRingsPanel'
import TrendsPanel from '../components/dashboard/TrendsPanel'
import DashboardPreviewList, { PreviewEmpty, PreviewRow } from '../components/DashboardPreviewList'
import PageHeader from '../components/layout/PageHeader'
import { PageError, PageLoading } from '../components/layout/PageState'
import { fetchActivities, type Activity } from '../lib/activities'
import { fetchDailyEnergySnapshots } from '../lib/dailyEnergy'
import {
  clearDeviceTotal,
  fetchDeviceTotal,
  saveDeviceTotal,
} from '../lib/deviceTotals'
import { type FoodEntry, fetchEntries } from '../lib/entries'
import { routeHref } from '../lib/routing'

function formatMealWeightPreview(entry: FoodEntry): string | null {
  if (entry.portionUnit === 'grams' && entry.portionQuantity != null) {
    return formatPortionLabel(entry)
  }
  if (
    entry.portionUnit === 'servings' &&
    entry.portionQuantity != null &&
    entry.referenceWeightGrams != null &&
    entry.referenceWeightGrams > 0
  ) {
    const grams = entry.portionQuantity * entry.referenceWeightGrams
    return grams % 1 === 0 ? `${grams}g total` : `${grams.toFixed(1)}g total`
  }
  return formatPortionLabel(entry)
}

function formatMealMacrosPreview(entry: FoodEntry): string {
  const parts = [
    `${entry.calories} kcal`,
    `${entry.protein}g protein`,
    `${entry.carbs}g carbs`,
    `${entry.fat}g fat`,
  ]
  if (entry.fiber > 0) parts.push(`${entry.fiber}g fiber`)
  if (entry.caffeine > 0) parts.push(`${entry.caffeine}mg caffeine`)
  return parts.join(' · ')
}

function SectionHeader({
  label,
  title,
  href,
  linkLabel,
}: {
  label: string
  title: string
  href: string
  linkLabel: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
      }}
    >
      <div>
        <p className="on-sky-text-muted" style={{ ...sectionLabelStyle, color: undefined }}>
          {label}
        </p>
        <h3
          className="on-sky-text"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            margin: 0,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h3>
      </div>
      <a href={href} className="on-sky-link" style={{ fontSize: 12, flexShrink: 0 }}>
        {linkLabel} →
      </a>
    </div>
  )
}

export default function Dashboard() {
  const nutritionGoals = useNutritionGoals()
  const { profile } = useProfile()
  const today = todayISO()
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Energy card day browser (independent of rest of dashboard, which stays on today). */
  const [energyDate, setEnergyDate] = useState(today)
  const [energyEntries, setEnergyEntries] = useState<FoodEntry[]>([])
  const [energyActivities, setEnergyActivities] = useState<Activity[]>([])
  const [energyDeviceTotal, setEnergyDeviceTotal] = useState<number | null>(null)
  const [energyLoading, setEnergyLoading] = useState(true)
  const [trendsPreset, setTrendsPreset] = useState<TrendsRangePreset>('last_7')
  const [customStart, setCustomStart] = useState(() => resolveTrendsDateRange('last_7').start)
  const [customEnd, setCustomEnd] = useState(todayISO())
  const [trendRows, setTrendRows] = useState<DailyEnergySnapshot[]>([])
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [trendsError, setTrendsError] = useState<string | null>(null)

  const { bmr } = useMemo(() => resolveBmr(profile), [profile])
  const energyIsToday = energyDate === today

  const trendsRange = useMemo(
    () =>
      resolveTrendsDateRange(trendsPreset, {
        today: todayISO(),
        customStart,
        customEnd,
      }),
    [trendsPreset, customStart, customEnd],
  )

  useEffect(() => {
    Promise.all([fetchEntries(), fetchActivities()])
      .then(([food, acts]) => {
        setEntries(food)
        setActivities(acts)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    // Defer so the effect does not synchronously set state during render flush (eslint).
    const kickoff = queueMicrotask(() => {
      if (cancelled) return
      setEnergyLoading(true)
      Promise.all([
        fetchEntries(energyDate),
        fetchActivities(energyDate),
        profile.usesWearable ? fetchDeviceTotal(energyDate) : Promise.resolve(null),
      ])
        .then(([food, acts, deviceTotal]) => {
          if (cancelled) return
          setEnergyEntries(food)
          setEnergyActivities(acts)
          setEnergyDeviceTotal(deviceTotal)
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Failed to load energy day', energyDate, err)
            setEnergyEntries([])
            setEnergyActivities([])
            setEnergyDeviceTotal(null)
          }
        })
        .finally(() => {
          if (!cancelled) setEnergyLoading(false)
        })
    })
    void kickoff
    return () => {
      cancelled = true
    }
  }, [energyDate, profile.usesWearable])

  useEffect(() => {
    let cancelled = false
    const kickoff = queueMicrotask(() => {
      if (cancelled) return
      setTrendsLoading(true)
      setTrendsError(null)

      fetchDailyEnergySnapshots(trendsRange.start, trendsRange.end, bmr)
        .then((rows) => {
          if (!cancelled) setTrendRows(rows)
        })
        .catch((err) => {
          if (!cancelled) {
            setTrendsError(err instanceof Error ? err.message : 'Failed to load trends')
            setTrendRows([])
          }
        })
        .finally(() => {
          if (!cancelled) setTrendsLoading(false)
        })
    })
    void kickoff

    return () => {
      cancelled = true
    }
  }, [trendsRange.start, trendsRange.end, bmr])

  const goEnergyPrev = useCallback(() => {
    setEnergyDate((d) => shiftISODate(d, -1))
  }, [])

  const goEnergyNext = useCallback(() => {
    setEnergyDate((d) => {
      if (d >= todayISO()) return d
      return shiftISODate(d, 1)
    })
  }, [])

  const goEnergyToday = useCallback(() => {
    setEnergyDate(todayISO())
  }, [])

  const handleSaveDeviceTotal = useCallback(
    async (kcal: number) => {
      const saved = await saveDeviceTotal(energyDate, kcal)
      setEnergyDeviceTotal(saved)
    },
    [energyDate],
  )

  const handleClearDeviceTotal = useCallback(async () => {
    await clearDeviceTotal(energyDate)
    setEnergyDeviceTotal(null)
  }, [energyDate])

  if (loading) {
    return <PageLoading message="Loading dashboard..." />
  }

  if (error) {
    return (
      <PageError
        message="Failed to load dashboard"
        detail={`${error} Check that you are signed in and Supabase is reachable.`}
      />
    )
  }

  const energyFoodTotals = sumTotals(energyEntries)
  const energyActivityTotals = sumActivityTotals(energyActivities)
  const energyBalance = computeNetBalance(
    energyFoodTotals.calories,
    energyActivityTotals.calories,
    nutritionGoals.calories.low,
    nutritionGoals.calories.high,
    bmr,
    profile.usesWearable ? energyDeviceTotal : null,
  )
  const recentEntries = entries.slice(0, 3)
  const recentActivities = activities.slice(0, 3)

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="Energy balance, multi-day trends, and today's food and activity."
      />

      <div style={{ marginBottom: 16 }}>
        <DailyIoCard
          balance={energyBalance}
          date={energyDate}
          isToday={energyIsToday}
          canGoBack
          canGoForward={!energyIsToday}
          dayLoading={energyLoading}
          onPrevious={goEnergyPrev}
          onNext={goEnergyNext}
          onGoToToday={goEnergyToday}
          usesWearable={profile.usesWearable}
          onSaveDeviceTotal={handleSaveDeviceTotal}
          onClearDeviceTotal={handleClearDeviceTotal}
        />
      </div>

      <section style={{ marginBottom: 28 }}>
        <TrendsPanel
          rows={trendRows}
          targetCalories={Math.round(
            (nutritionGoals.calories.low + nutritionGoals.calories.high) / 2,
          )}
          preset={trendsPreset}
          customStart={customStart}
          customEnd={customEnd}
          loading={trendsLoading}
          error={trendsError}
          onPresetChange={setTrendsPreset}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHeader
          label="Nutrition"
          title="Today's Inputs"
          href={routeHref('inputs')}
          linkLabel="View Inputs"
        />
        <NutritionRingsPanel entries={entries} goals={nutritionGoals} />
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHeader
          label="Activity"
          title="Today's Outputs"
          href={routeHref('outputs')}
          linkLabel="View Outputs"
        />
        <ActivityOverviewPanel activities={activities} />
      </section>

      <section style={{ marginBottom: 32 }}>
        <SectionHeader
          label="Logs"
          title="Today's Logs"
          href={routeHref('inputs')}
          linkLabel="View all"
        />
        <div className="metric-grid-auto">
          <DashboardPreviewList
            title="Recent Food"
            viewAllHref={routeHref('inputs')}
            viewAllLabel="Inputs"
          >
            {recentEntries.length === 0 ? (
              <PreviewEmpty message="No food logged today" />
            ) : (
              recentEntries.map((entry) => (
                <PreviewRow
                  key={entry.id}
                  primary={entry.name}
                  secondary={formatMealWeightPreview(entry) ?? undefined}
                  macros={formatMealMacrosPreview(entry)}
                />
              ))
            )}
          </DashboardPreviewList>

          <DashboardPreviewList
            title="Recent Activities"
            viewAllHref={routeHref('outputs')}
            viewAllLabel="Outputs"
          >
            {recentActivities.length === 0 ? (
              <PreviewEmpty message="No activities logged today" />
            ) : (
              recentActivities.map((activity) => (
                <PreviewRow
                  key={activity.id}
                  primary={activity.name}
                  secondary={activity.activityType}
                  meta={formatDuration(activity.movingTimeSeconds)}
                />
              ))
            )}
          </DashboardPreviewList>
        </div>
      </section>

      <div style={{ textAlign: 'center' }}>
        <p className="on-sky-text-muted" style={{ fontSize: 10, margin: 0 }}>
          Data is estimated using standard nutritional references. Actual values may vary.
        </p>
      </div>
    </div>
  )
}