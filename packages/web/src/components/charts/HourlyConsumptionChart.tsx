import {
  annotateMealMarkers,
  formatLogTime,
  mapEntriesToMealMarkers,
  niceCalorieAxisMax,
} from '@input_output/shared'
import { useMemo, useState } from 'react'
import type { FoodEntry } from '../../lib/entries'

interface HourlyConsumptionChartProps {
  entries: FoodEntry[]
  timeZone: string
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function formatAxisHourLabel(hour: number): string {
  if (hour === 0) return '12a'
  if (hour < 12) return `${hour}a`
  if (hour === 12) return '12p'
  return `${hour - 12}p`
}

const DOT_OFFSET_PX = 7

export default function HourlyConsumptionChart({ entries, timeZone }: HourlyConsumptionChartProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  const { markersByHour, axisMax } = useMemo(() => {
    const annotated = annotateMealMarkers(mapEntriesToMealMarkers(entries, timeZone))
    const maxCalories = entries.reduce((max, entry) => Math.max(max, entry.calories), 0)
    const axisMax = niceCalorieAxisMax(maxCalories)
    const grouped = Array.from({ length: 24 }, () => [] as Array<{
      entryId: string
      calories: number
      slotIndex: number
      slotTotal: number
      label: string
    }>)

    annotated.forEach((marker, index) => {
      const entry = entries[index]
      if (!entry || marker.hour < 0 || marker.hour > 23) return
      grouped[marker.hour].push({
        entryId: entry.id,
        calories: marker.calories,
        slotIndex: marker.slotIndex,
        slotTotal: marker.slotTotal,
        label: formatLogTime(entry.loggedAt, timeZone),
      })
    })

    return { markersByHour: grouped, axisMax }
  }, [entries, timeZone])

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  )

  const yAxisLabels = useMemo(() => {
    const mid = Math.round(axisMax / 2)
    return [axisMax, mid, 0]
  }, [axisMax])

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: '32px 0 8px',
          textAlign: 'center',
          color: '#a1a1aa',
          fontSize: 13,
        }}
      >
        No food logged for this day yet.
      </div>
    )
  }

  const ariaLabel = `${entries.length} ${entries.length === 1 ? 'meal' : 'meals'} logged across the day.`

  return (
    <div className="hourly-chart-wrap">
      <div
        className={`hourly-chart-tooltip${selectedEntry ? '' : ' hourly-chart-tooltip-idle'}`}
        aria-live="polite"
      >
        {selectedEntry
          ? `${selectedEntry.name} · ${formatLogTime(selectedEntry.loggedAt, timeZone)} · ${selectedEntry.calories} kcal`
          : 'Select a dot to see meal details'}
      </div>

      <div className="hourly-chart-scroll">
        <div className="hourly-chart-body">
          <div className="hourly-chart-y-axis" aria-hidden="true">
            {yAxisLabels.map((label) => (
              <span key={label} className="hourly-chart-y-axis-label">
                {label}
              </span>
            ))}
          </div>

          <div className="hourly-chart-plot">
            <div role="img" aria-label={ariaLabel} className="hourly-chart-grid hourly-chart-tracks">
              {markersByHour.map((markers, hour) => (
                <div
                  key={hour}
                  className="hourly-chart-hour"
                  aria-label={`${formatHourLabel(hour)}: ${markers.length} ${markers.length === 1 ? 'meal' : 'meals'}`}
                >
                  {markers.map((marker) => {
                    const offset =
                      marker.slotTotal > 1
                        ? (marker.slotIndex - (marker.slotTotal - 1) / 2) * DOT_OFFSET_PX
                        : 0
                    const isSelected = marker.entryId === selectedEntryId

                    return (
                      <button
                        key={marker.entryId}
                        type="button"
                        className={`hourly-chart-dot${isSelected ? ' hourly-chart-dot-selected' : ''}`}
                        style={{
                          bottom: `${(marker.calories / axisMax) * 100}%`,
                          left: `calc(50% + ${offset}px)`,
                        }}
                        aria-label={`${marker.label} meal logged, ${marker.calories} calories`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedEntryId((current) =>
                            current === marker.entryId ? null : marker.entryId,
                          )
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="hourly-chart-grid hourly-chart-axis" aria-hidden="true">
              {markersByHour.map((_, hour) => (
                <span key={hour} className="hourly-chart-axis-label">
                  {formatAxisHourLabel(hour)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}