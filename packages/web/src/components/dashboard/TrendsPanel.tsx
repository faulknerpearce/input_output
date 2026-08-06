import {
  formatDayLabel,
  summarizeDailyEnergyPeriod,
  type DailyEnergySnapshot,
  type TrendsRangePreset,
} from '@input_output/shared'
import { useState } from 'react'
import {
  neutrals,
  radius,
  status,
  ZONE_INPUT,
  ZONE_OUTPUT,
} from '../../lib/design-tokens'
import { inputBase, labelBase } from '../../lib/styles'
import { useMediaQuery } from '../../lib/useMediaQuery'
import Card from '../ui/Card'
import TrendsChart from './TrendsChart'

interface TrendsPanelProps {
  rows: DailyEnergySnapshot[]
  /** Midpoint of daily net calorie goal band for the chart target line. */
  targetCalories: number
  preset: TrendsRangePreset
  customStart: string
  customEnd: string
  loading: boolean
  error: string | null
  onPresetChange: (preset: TrendsRangePreset) => void
  onCustomStartChange: (value: string) => void
  onCustomEndChange: (value: string) => void
}

type TrendsView = 'table' | 'chart'

const PRESETS: { value: TrendsRangePreset; label: string }[] = [
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
]

const VIEW_OPTIONS: { value: TrendsView; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'chart', label: 'Chart' },
]

/** Theme: surplus (fuel left) input green, deficit/burn-heavy output amber. */
const DELTA_SURPLUS = ZONE_INPUT
const DELTA_DEFICIT = ZONE_OUTPUT

function formatDelta(value: number | null): string {
  if (value === null) return '—'
  if (value > 0) return `+${value.toLocaleString()}`
  return value.toLocaleString()
}

function deltaColor(value: number | null): string {
  if (value === null) return neutrals.textFaint
  if (value > 0) return DELTA_SURPLUS
  if (value < 0) return DELTA_DEFICIT
  return neutrals.textMuted
}

function netColor(value: number): string {
  if (value > 0) return DELTA_SURPLUS
  if (value < 0) return DELTA_DEFICIT
  return neutrals.textMuted
}

export default function TrendsPanel({
  rows,
  targetCalories,
  preset,
  customStart,
  customEnd,
  loading,
  error,
  onPresetChange,
  onCustomStartChange,
  onCustomEndChange,
}: TrendsPanelProps) {
  const [view, setView] = useState<TrendsView>('chart')
  const isMobile = useMediaQuery('(max-width: 639px)')
  const summary = summarizeDailyEnergyPeriod(rows)
  const displayRows = [...rows].reverse()
  const summaryId = 'trends-period-summary'

  return (
    <Card tone="neutral" style={{ padding: '18px 20px' }}>
      <div className="trends-panel-header">
        <div>
          <p className="trends-panel-eyebrow">Trends</p>
          <h3 className="trends-panel-title">I/O History</h3>
          {rows.length > 0 && !loading && (
            <p id={summaryId} className="trends-panel-summary" aria-label="Period summary">
              Period total{' '}
              <span className="trends-panel-summary-em">
                {summary.netTotal.toLocaleString()} kcal net
              </span>
              <span className="trends-panel-summary-sep" aria-hidden="true">
                ·
              </span>
              Daily avg{' '}
              <span className="trends-panel-summary-em">
                {summary.netAverage.toLocaleString()} kcal net
              </span>
              <span className="trends-panel-summary-meta">
                {' '}
                ({summary.intakeAverage.toLocaleString()} in ·{' '}
                {summary.totalOutputAverage.toLocaleString()} out)
              </span>
            </p>
          )}
        </div>

        <div className="trends-controls">
          <div className="trends-preset-row" role="group" aria-label="Date range">
            {PRESETS.map((option) => {
              const active = preset === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={active ? 'trends-chip trends-chip-active' : 'trends-chip'}
                  aria-pressed={active}
                  onClick={() => onPresetChange(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <div className="trends-view-toggle" role="group" aria-label="Trends view">
            {VIEW_OPTIONS.map((option) => {
              const active = view === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={
                    active
                      ? 'trends-view-toggle-button trends-view-toggle-button-active'
                      : 'trends-view-toggle-button'
                  }
                  aria-pressed={active}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {preset === 'custom' && (
        <div className="modal-form-grid trends-custom-dates">
          <div>
            <label htmlFor="trends-start" style={labelBase}>
              Start date
            </label>
            <input
              id="trends-start"
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
              style={inputBase}
            />
          </div>
          <div>
            <label htmlFor="trends-end" style={labelBase}>
              End date
            </label>
            <input
              id="trends-end"
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
              style={inputBase}
            />
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{
            color: status.danger.text,
            background: status.danger.bg,
            border: `1px solid ${status.danger.border}`,
            borderRadius: radius.md,
            padding: '10px 12px',
            fontSize: 13,
            margin: '0 0 12px 0',
          }}
        >
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ color: neutrals.textMuted, fontSize: 13, margin: 0 }}>Loading trends…</p>
      ) : view === 'chart' ? (
        <TrendsChart rows={rows} targetCalories={targetCalories} />
      ) : isMobile ? (
        <div className="trends-mobile-cards" role="list" aria-label="Daily energy breakdown">
          {displayRows.map((row) => (
            <article
              key={row.date}
              className="trends-mobile-card"
              role="listitem"
              aria-label={`${formatDayLabel(row.date)}: Net ${row.net.toLocaleString()} kilocalories`}
            >
              <div className="trends-mobile-card-header">
                <h4 className="trends-mobile-card-date">{formatDayLabel(row.date)}</h4>
                <span className="trends-mobile-card-net" style={{ color: netColor(row.net) }}>
                  {row.net >= 0 ? '+' : ''}
                  {row.net.toLocaleString()} kcal
                </span>
              </div>
              <div className="trends-mobile-card-fields">
                <div className="trends-mobile-card-field">
                  <p className="trends-mobile-card-field-label">Intake</p>
                  <p className="trends-mobile-card-field-value">
                    {row.intakeCalories.toLocaleString()} kcal
                  </p>
                </div>
                <div className="trends-mobile-card-field">
                  <p className="trends-mobile-card-field-label">
                    {row.baseSource === 'device' ? 'Device' : 'BMR'}
                  </p>
                  <p className="trends-mobile-card-field-value">
                    {row.baseBurn.toLocaleString()} kcal
                  </p>
                </div>
                <div className="trends-mobile-card-field">
                  <p className="trends-mobile-card-field-label">Activity</p>
                  <p className="trends-mobile-card-field-value">
                    {row.activityCalories.toLocaleString()} kcal
                  </p>
                </div>
                <div className="trends-mobile-card-field">
                  <p className="trends-mobile-card-field-label">Total Output</p>
                  <p className="trends-mobile-card-field-value">
                    {row.totalOutput.toLocaleString()} kcal
                  </p>
                </div>
                <div className="trends-mobile-card-delta">
                  <p className="trends-mobile-card-delta-label">Δ Net</p>
                  <span
                    className="trends-mobile-card-delta-value"
                    style={{ color: deltaColor(row.netDelta) }}
                  >
                    {formatDelta(row.netDelta)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            className="trends-table"
            aria-describedby={rows.length > 0 ? summaryId : undefined}
          >
            <caption className="trends-table-caption">Daily input and output breakdown</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Intake</th>
                <th scope="col">Base</th>
                <th scope="col">Activity</th>
                <th scope="col">Total Output</th>
                <th scope="col">Net</th>
                <th scope="col">Δ Net</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{formatDayLabel(row.date)}</th>
                  <td>{row.intakeCalories.toLocaleString()}</td>
                  <td title={row.baseSource === 'device' ? 'Device total' : 'BMR'}>
                    {row.baseBurn.toLocaleString()}
                    {row.baseSource === 'device' ? ' · D' : ''}
                  </td>
                  <td>{row.activityCalories.toLocaleString()}</td>
                  <td>{row.totalOutput.toLocaleString()}</td>
                  <td style={{ color: netColor(row.net), fontWeight: 600 }}>
                    {row.net.toLocaleString()}
                  </td>
                  <td style={{ color: deltaColor(row.netDelta), fontWeight: 600 }}>
                    {formatDelta(row.netDelta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
