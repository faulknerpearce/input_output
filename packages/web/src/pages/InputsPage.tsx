import {
  detectBrowserTimeZone,
  formatDayLabel,
  shiftISODate,
  sumTotals,
  todayISOInTimeZone,
} from '@input_output/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNutritionGoals, useProfile } from '../context/useProfile'
import AddEntryModal from '../components/AddEntryModal'
import BarcodeScannerModal from '../components/BarcodeScannerModal'
import CollapsiblePanel from '../components/layout/CollapsiblePanel'
import DayNavigator from '../components/layout/DayNavigator'

import { PageError, PageLoading } from '../components/layout/PageState'
import FoodLogEntryStats from '../components/FoodLogEntryStats'
import FoodLogSection from '../components/FoodLogSection'
import HourlyConsumptionChart from '../components/charts/HourlyConsumptionChart'
import MetricCard from '../components/MetricCard'
import type { MappedBarcodeProduct } from '../lib/openFoodFacts'
import {
  addEntry,
  deleteEntry,
  fetchDaySummaries,
  fetchEntries,
  updateEntry,
  type DaySummary,
  type FoodEntry,
  type FoodEntryWrite,
} from '../lib/entries'
import { logRecipe, saveRecipe } from '../lib/recipes'
import { buildMetricConfigs } from '../lib/metrics'

function updateDayEntries(days: DaySummary[], date: string, entries: FoodEntry[]): DaySummary[] {
  return days.map((day) =>
    day.date === date ? { ...day, entries, totals: sumTotals(entries) } : day,
  )
}

function emptyDaySummary(date: string): DaySummary {
  return { date, entries: [], totals: sumTotals([]) }
}

interface InputsPageProps {
  onOpenAddEntryReady?: (openAddEntry: () => void) => void
  onOpenBarcodeScannerReady?: (openBarcodeScanner: () => void) => void
}

export default function InputsPage({
  onOpenAddEntryReady,
  onOpenBarcodeScannerReady,
}: InputsPageProps) {
  const nutritionGoals = useNutritionGoals()
  const { profile, loading: profileLoading } = useProfile()
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() =>
    todayISOInTimeZone(detectBrowserTimeZone()),
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [prefillEntry, setPrefillEntry] = useState<FoodEntryWrite | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const resolvedTimeZone = profileLoading ? detectBrowserTimeZone() : profile.timeZone
  const today = todayISOInTimeZone(resolvedTimeZone)
  const isToday = selectedDate === today

  const activeDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? emptyDaySummary(selectedDate),
    [days, selectedDate],
  )

  useEffect(() => {
    fetchDaySummaries()
      .then((data) => {
        setDays(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load food logs')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (loading) return
    if (days.some((day) => day.date === selectedDate)) return

    let cancelled = false
    fetchEntries(selectedDate)
      .then((entries) => {
        if (cancelled) return
        setDays((prev) => {
          if (prev.some((day) => day.date === selectedDate)) return prev
          return [...prev, { date: selectedDate, entries, totals: sumTotals(entries) }].sort(
            (a, b) => b.date.localeCompare(a.date),
          )
        })
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load food log for', selectedDate, err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [loading, selectedDate, days])

  const openAddEntry = useCallback(() => {
    setPrefillEntry(null)
    setShowAddForm(true)
  }, [])

  const openBarcodeScanner = useCallback(() => {
    setShowScanner(true)
  }, [])

  useEffect(() => {
    onOpenAddEntryReady?.(openAddEntry)
  }, [onOpenAddEntryReady, openAddEntry])

  useEffect(() => {
    onOpenBarcodeScannerReady?.(openBarcodeScanner)
  }, [onOpenBarcodeScannerReady, openBarcodeScanner])

  async function persistAdd(
    input: FoodEntryWrite,
    options?: {
      saveAsRecipe?: boolean
      perServing?: FoodEntryWrite
      servingWeightGrams?: number
      entryDate?: string
    },
  ) {
    const entryDate = options?.entryDate ?? selectedDate
    const entry = await addEntry(input, { entryDate })
    if (options?.saveAsRecipe) {
      const recipeSource = options.perServing ?? input
      await saveRecipe({
        name: recipeSource.name,
        description: recipeSource.description,
        icon: recipeSource.icon,
        iconBg: recipeSource.iconBg,
        iconColor: recipeSource.iconColor,
        defaultServings: 1,
        servingWeightGrams: options.servingWeightGrams,
        ingredients: [
          {
            name: recipeSource.name,
            amount: '',
            sortOrder: 0,
            calories: recipeSource.calories,
            protein: recipeSource.protein,
            carbs: recipeSource.carbs,
            fat: recipeSource.fat,
            fiber: recipeSource.fiber,
            caffeine: recipeSource.caffeine,
          },
        ],
      })
    }
    setDays((prev) => {
      const existing = prev.find((day) => day.date === entryDate)
      if (existing) {
        return updateDayEntries(prev, entryDate, [entry, ...existing.entries])
      }
      return [{ date: entryDate, entries: [entry], totals: sumTotals([entry]) }, ...prev].sort(
        (a, b) => b.date.localeCompare(a.date),
      )
    })
    setSelectedDate(entryDate)
  }

  async function persistLogRecipe(
    recipeId: string,
    options: {
      portionUnit: import('@input_output/shared').PortionUnit
      portionQuantity: number
      servingWeightGrams?: number
      loggedAt?: string
      entryDate?: string
    },
  ) {
    const entryDate = options.entryDate ?? selectedDate
    const entry = await logRecipe({
      recipeId,
      portionUnit: options.portionUnit,
      portionQuantity: options.portionQuantity,
      servingWeightGrams: options.servingWeightGrams,
      loggedAt: options.loggedAt,
      entryDate,
    })
    setDays((prev) => {
      const existing = prev.find((day) => day.date === entryDate)
      if (existing) {
        return updateDayEntries(prev, entryDate, [entry, ...existing.entries])
      }
      return [{ date: entryDate, entries: [entry], totals: sumTotals([entry]) }, ...prev].sort(
        (a, b) => b.date.localeCompare(a.date),
      )
    })
    setSelectedDate(entryDate)
  }

  async function persistUpdate(id: string, input: FoodEntryWrite) {
    const updated = await updateEntry(id, input)
    setDays((prev) =>
      prev.map((day) => {
        if (!day.entries.some((entry) => entry.id === id)) return day
        const entries = day.entries
          .map((entry) => (entry.id === id ? updated : entry))
          .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
        return { ...day, entries, totals: sumTotals(entries) }
      }),
    )
  }

  async function persistDelete(id: string) {
    setDeleteError(null)
    try {
      await deleteEntry(id)
      setDays((prev) =>
        prev.map((day) => {
          const entries = day.entries.filter((entry) => entry.id !== id)
          return entries.length === day.entries.length
            ? day
            : { ...day, entries, totals: sumTotals(entries) }
        }),
      )
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete entry')
      throw err
    }
  }

  if (loading) return <PageLoading message="Loading food logs..." />
  if (error) return <PageError message="Failed to load food logs" detail={error} />

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
          title="Nutrition Stats"
          subtitle={`Goal progress and entry insights for ${formatDayLabel(selectedDate).toLowerCase()}`}
        >
          <div className="metric-grid-2" style={{ paddingTop: 20 }}>
            {buildMetricConfigs(activeDay.entries, nutritionGoals).map((metric) => (
              <MetricCard key={metric.label} config={metric} />
            ))}
          </div>
          <FoodLogEntryStats entries={activeDay.entries} />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Eating Times"
          subtitle={`When food was logged on ${formatDayLabel(selectedDate).toLowerCase()}`}
        >
          <HourlyConsumptionChart entries={activeDay.entries} timeZone={profile.timeZone} />
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Food Log"
          subtitle={(() => {
            const count = activeDay.entries.length
            const countLabel = `${count} ${count === 1 ? 'entry' : 'entries'}`
            return isToday
              ? `${countLabel} · Add, edit, or remove entries for today`
              : `${countLabel} · Edit or remove entries from this day`
          })()}
        >
          {deleteError && (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: 13,
              }}
            >
              {deleteError}
            </div>
          )}
          <FoodLogSection
            entries={activeDay.entries}
            logDate={selectedDate}
            timeZone={profile.timeZone}
            onAdd={isToday ? persistAdd : undefined}
            onLogRecipe={isToday ? persistLogRecipe : undefined}
            onEdit={persistUpdate}
            onDelete={persistDelete}
            onRelog={persistAdd}
            collapsible={false}
            showActions={false}
            showEntryStats={false}
          />
        </CollapsiblePanel>
      </div>

      {showScanner && (
        <BarcodeScannerModal
          onProductFound={(product: MappedBarcodeProduct) => {
            setPrefillEntry({
              ...product.entry,
              referenceWeightGrams: product.referenceWeightGrams,
              nutritionBasisNote: product.servingNote,
            })
            setShowScanner(false)
            setShowAddForm(true)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
      {showAddForm && (
        <AddEntryModal
          prefill={prefillEntry ?? undefined}
          logDate={selectedDate}
          timeZone={profile.timeZone}
          onAdd={persistAdd}
          onLogRecipe={persistLogRecipe}
          onClose={() => {
            setShowAddForm(false)
            setPrefillEntry(null)
          }}
        />
      )}
    </>
  )
}