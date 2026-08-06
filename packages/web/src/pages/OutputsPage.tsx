import { formatDayLabel, shiftISODate, sumActivityTotals, todayISO } from '@input_output/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AddActivityModal from '../components/AddActivityModal'
import ActivityLogSection from '../components/ActivityLogSection'
import ActivityMetricCard from '../components/ActivityMetricCard'
import CollapsiblePanel from '../components/layout/CollapsiblePanel'
import DayNavigator from '../components/layout/DayNavigator'

import { PageError, PageLoading } from '../components/layout/PageState'
import { useProfile } from '../context/useProfile'
import { buildActivityMetricConfigs } from '../lib/activityMetrics'
import {
  addActivity,
  deleteActivity,
  fetchActivities,
  fetchActivityDaySummaries,
  updateActivity,
  type Activity,
  type ActivityDaySummary,
  type ActivityWrite,
} from '../lib/activities'
import { logWorkout } from '../lib/workouts'

function updateDayActivities(
  days: ActivityDaySummary[],
  date: string,
  activities: Activity[],
): ActivityDaySummary[] {
  return days.map((day) =>
    day.date === date ? { ...day, activities, totals: sumActivityTotals(activities) } : day,
  )
}

function emptyDaySummary(date: string): ActivityDaySummary {
  return { date, activities: [], totals: sumActivityTotals([]) }
}

interface OutputsPageProps {
  onOpenLogActivityReady?: (openLogActivity: () => void) => void
}

export default function OutputsPage({ onOpenLogActivityReady }: OutputsPageProps) {
  const { profile } = useProfile()
  const [days, setDays] = useState<ActivityDaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [showAddForm, setShowAddForm] = useState(false)

  const today = todayISO()
  const isToday = selectedDate === today

  const activeDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? emptyDaySummary(selectedDate),
    [days, selectedDate],
  )

  useEffect(() => {
    fetchActivityDaySummaries()
      .then((data) => {
        setDays(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load activities')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (loading) return
    if (days.some((day) => day.date === selectedDate)) return

    let cancelled = false
    fetchActivities(selectedDate)
      .then((activities) => {
        if (cancelled) return
        setDays((prev) => {
          if (prev.some((day) => day.date === selectedDate)) return prev
          return [
            ...prev,
            { date: selectedDate, activities, totals: sumActivityTotals(activities) },
          ].sort((a, b) => b.date.localeCompare(a.date))
        })
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load activities for', selectedDate, err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loading, selectedDate, days])

  const openLogActivity = useCallback(() => {
    setShowAddForm(true)
  }, [])

  useEffect(() => {
    onOpenLogActivityReady?.(openLogActivity)
  }, [onOpenLogActivityReady, openLogActivity])

  async function persistAdd(input: ActivityWrite, options?: { activityDate?: string }) {
    const activityDate = options?.activityDate ?? selectedDate
    const activity = await addActivity(input, { activityDate })
    setDays((prev) => {
      const existing = prev.find((day) => day.date === activityDate)
      if (existing) {
        return updateDayActivities(prev, activityDate, [activity, ...existing.activities])
      }
      return [
        { date: activityDate, activities: [activity], totals: sumActivityTotals([activity]) },
        ...prev,
      ].sort((a, b) => b.date.localeCompare(a.date))
    })
    setSelectedDate(activityDate)
  }

  async function persistLogWorkout(options: {
    workoutId: string
    setsLogged: number
    loggedAt?: string
    activityDate?: string
  }) {
    const activityDate = options.activityDate ?? selectedDate
    const activity = await logWorkout({ ...options, activityDate })
    setDays((prev) => {
      const existing = prev.find((day) => day.date === activityDate)
      if (existing) {
        return updateDayActivities(prev, activityDate, [activity, ...existing.activities])
      }
      return [
        { date: activityDate, activities: [activity], totals: sumActivityTotals([activity]) },
        ...prev,
      ].sort((a, b) => b.date.localeCompare(a.date))
    })
    setSelectedDate(activityDate)
  }

  async function persistUpdate(id: string, input: ActivityWrite) {
    const updated = await updateActivity(id, input)
    setDays((prev) =>
      prev.map((day) => {
        if (!day.activities.some((activity) => activity.id === id)) return day
        const activities = day.activities
          .map((activity) => (activity.id === id ? updated : activity))
          .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
        return { ...day, activities, totals: sumActivityTotals(activities) }
      }),
    )
  }

  async function persistDelete(id: string) {
    await deleteActivity(id)
    setDays((prev) =>
      prev.map((day) => {
        const activities = day.activities.filter((activity) => activity.id !== id)
        return activities.length === day.activities.length
          ? day
          : { ...day, activities, totals: sumActivityTotals(activities) }
      }),
    )
  }

  if (loading) return <PageLoading message="Loading activities..." />
  if (error) return <PageError message="Failed to load activities" detail={error} />

  return (
    <>
      <DayNavigator
        date={selectedDate}
        isToday={isToday}
        compact
        canGoForward={selectedDate < today}
        onPrevious={() => setSelectedDate((date) => shiftISODate(date, -1))}
        onNext={() => setSelectedDate((date) => shiftISODate(date, 1))}
        onGoToToday={() => setSelectedDate(today)}
      />

      <div className={`inputs-day-content${isToday ? ' inputs-day-content-today' : ''}`}>
        <CollapsiblePanel
          title="Activity Stats"
          subtitle={`Performance summary for ${formatDayLabel(selectedDate).toLowerCase()}`}
        >
          <div className="metric-grid-2" style={{ paddingTop: 20 }}>
            {buildActivityMetricConfigs(activeDay.activities).map((metric) => (
              <ActivityMetricCard key={metric.label} config={metric} />
            ))}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Activities"
          subtitle={(() => {
            const count = activeDay.activities.length
            const countLabel = `${count} ${count === 1 ? 'activity' : 'activities'}`
            return isToday
              ? `${countLabel} · Log, edit, or remove activities for today`
              : `${countLabel} · Edit or remove activities from this day`
          })()}
        >
          <ActivityLogSection
            activities={activeDay.activities}
            logDate={selectedDate}
            timeZone={profile.timeZone}
            onAdd={persistAdd}
            onLogWorkout={persistLogWorkout}
            onEdit={persistUpdate}
            onDelete={persistDelete}
            collapsible={false}
            showActions={false}
          />
        </CollapsiblePanel>
      </div>

      {showAddForm && (
        <AddActivityModal
          logDate={selectedDate}
          timeZone={profile.timeZone}
          onAdd={persistAdd}
          onLogWorkout={async (options) => {
            await persistLogWorkout(options)
            setShowAddForm(false)
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </>
  )
}