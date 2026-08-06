import { parseISODate, type DailyEnergySnapshot } from '@input_output/shared'
import { useMemo } from 'react'
import { neutrals, ZONE_BLUE, ZONE_INPUT, ZONE_OUTPUT } from '../../lib/design-tokens'
import { useMediaQuery } from '../../lib/useMediaQuery'

interface TrendsChartProps {
  rows: DailyEnergySnapshot[]
  /** Midpoint of daily net calorie goal band — thin blue reference (same as In vs Out). */
  targetCalories: number
}

type MarkerStyle = 'hollow' | 'filled' | 'none'

interface ChartSeries {
  key: 'intake' | 'output'
  label: string
  color: string
  /** Point style when dots are shown */
  marker: MarkerStyle
  pick: (row: DailyEnergySnapshot) => number
}

/**
 * Series colors follow zone language: deep input green, output amber.
 * Green is darker than amber so 30-day (line-only) charts stay clear in grayscale.
 * Target: thin blue (DailyIoCard).
 */
const SERIES: ChartSeries[] = [
  {
    key: 'intake',
    label: 'Intake',
    color: ZONE_INPUT,
    marker: 'hollow',
    pick: (row) => row.intakeCalories,
  },
  {
    key: 'output',
    label: 'Output',
    color: ZONE_OUTPUT,
    marker: 'filled',
    pick: (row) => row.totalOutput,
  },
]

const TARGET_COLOR = ZONE_BLUE

/** Hide per-day dots for ~30-day (and longer) ranges — all viewports. */
const HIDE_DOTS_MIN_DAYS = 15

function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCompactKcal(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    const k = value / 1000
    const rounded = Math.abs(k) >= 10 ? Math.round(k) : Math.round(k * 10) / 10
    return `${rounded}k`
  }
  return value.toLocaleString()
}

function niceAxisMax(value: number): number {
  if (value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

function buildYAxisTicks(min: number, max: number): number[] {
  const span = max - min
  if (span <= 0) return [min, max]
  const step = niceAxisMax(Math.ceil(span / 4))
  const ticks: number[] = []
  const start = Math.floor(min / step) * step
  for (let value = start; value <= max + step * 0.01; value += step) {
    ticks.push(Math.round(value))
  }
  return ticks.length > 0 ? ticks : [min, max]
}

interface ChartLayout {
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
  axisFontSize: number
  labelFontSize: number
  lineWidth: number
  targetLineWidth: number
  pointRadius: number
  maxXLabels: number
}

const DESKTOP_LAYOUT: ChartLayout = {
  width: 720,
  height: 260,
  padding: { top: 16, right: 16, bottom: 40, left: 52 },
  axisFontSize: 12,
  labelFontSize: 11,
  lineWidth: 2.5,
  targetLineWidth: 1.5,
  pointRadius: 4.5,
  maxXLabels: 10,
}

/** Mobile: native phone width so SVG text stays ~13–15px when rendered full-bleed. */
const MOBILE_LAYOUT: ChartLayout = {
  width: 360,
  height: 300,
  padding: { top: 18, right: 12, bottom: 48, left: 48 },
  axisFontSize: 13,
  labelFontSize: 12,
  lineWidth: 3,
  targetLineWidth: 1.75,
  pointRadius: 6,
  maxXLabels: 5,
}

export default function TrendsChart({ rows, targetCalories }: TrendsChartProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const layout = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT
  const target = Math.max(0, Math.round(targetCalories))

  const chart = useMemo(() => {
    if (rows.length === 0) return null

    const { width, height, padding, maxXLabels } = layout
    const values = rows.flatMap((row) => [row.intakeCalories, row.totalOutput])
    const rawMin = Math.min(...values, 0)
    const rawMax = Math.max(...values, target, 0)
    const paddedMin = rawMin < 0 ? -niceAxisMax(Math.abs(rawMin)) : 0
    const paddedMax = niceAxisMax(rawMax * 1.1)
    const yMin = paddedMin
    const yMax = Math.max(paddedMax, 100)
    const yTicks = buildYAxisTicks(yMin, yMax)

    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const xStep = rows.length > 1 ? plotWidth / (rows.length - 1) : 0

    const scaleY = (value: number) => {
      const ratio = (value - yMin) / (yMax - yMin)
      return padding.top + plotHeight - ratio * plotHeight
    }

    const scaleX = (index: number) => padding.left + index * xStep

    const labelStride =
      rows.length <= maxXLabels
        ? 1
        : Math.max(1, Math.ceil((rows.length - 1) / (maxXLabels - 1)))

    const paths = SERIES.map((series) => {
      const points = rows.map((row, index) => ({
        x: scaleX(index),
        y: scaleY(series.pick(row)),
      }))
      const line = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ')
      return { series, points, line }
    })

    const targetY = scaleY(target)

    return {
      yMin,
      yMax,
      yTicks,
      paths,
      labelStride,
      scaleX,
      scaleY,
      targetY,
      width,
      height,
      padding,
    }
  }, [rows, layout, target])

  if (!chart || rows.length === 0) {
    return (
      <p style={{ color: neutrals.textFaint, fontSize: 14, margin: 0 }}>
        No trend data for this period.
      </p>
    )
  }

  const formatYTick = isMobile ? formatCompactKcal : (v: number) => v.toLocaleString()
  const showPoints = rows.length < HIDE_DOTS_MIN_DAYS

  return (
    <div className={isMobile ? 'trends-chart trends-chart-mobile' : 'trends-chart'}>
      <div
        role="img"
        aria-label={`Line chart of daily intake and output calories with target ${target.toLocaleString()} kilocalories`}
        className="trends-chart-canvas"
      >
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          width="100%"
          style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {chart.yTicks.map((tick) => {
            const y = chart.scaleY(tick)
            return (
              <g key={tick}>
                <line
                  x1={chart.padding.left}
                  x2={chart.width - chart.padding.right}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? '#C4C4C8' : '#ECECEE'}
                  strokeWidth={tick === 0 ? 1.5 : 1}
                />
                <text
                  x={chart.padding.left - 8}
                  y={y + layout.axisFontSize * 0.35}
                  textAnchor="end"
                  fontSize={layout.axisFontSize}
                  fontWeight={500}
                  fill={neutrals.textMuted}
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {formatYTick(tick)}
                </text>
              </g>
            )
          })}

          {/* Target reference — thin blue, under series so I/O lines stay on top */}
          {target > 0 && (
            <g>
              <line
                x1={chart.padding.left}
                x2={chart.width - chart.padding.right}
                y1={chart.targetY}
                y2={chart.targetY}
                stroke={TARGET_COLOR}
                strokeWidth={layout.targetLineWidth}
                strokeLinecap="round"
                opacity={0.95}
              >
                <title>{`Target: ${target.toLocaleString()} kcal`}</title>
              </line>
            </g>
          )}

          {chart.paths.map(({ series, points, line }) => {
            const drawMarkers = showPoints && series.marker !== 'none'
            const radius = layout.pointRadius
            const hollow = series.marker === 'hollow'
            // Thin white rim on filled dots so color fill stays prominent
            const filledStroke = isMobile ? 1 : 0.75
            const hollowStroke = isMobile ? 2 : 1.75
            return (
              <g key={series.key}>
                <path
                  d={line}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={layout.lineWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  {!drawMarkers && (
                    <title>{`${series.label} trend over ${rows.length} days`}</title>
                  )}
                </path>
                {drawMarkers &&
                  points.map((point, index) => (
                    <circle
                      key={`${series.key}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={radius}
                      fill={hollow ? '#ffffff' : series.color}
                      stroke={hollow ? series.color : '#ffffff'}
                      strokeWidth={hollow ? hollowStroke : filledStroke}
                    >
                      <title>
                        {`${formatShortDate(rows[index]!.date)} ${series.label}: ${series
                          .pick(rows[index]!)
                          .toLocaleString()} kcal`}
                      </title>
                    </circle>
                  ))}
              </g>
            )
          })}

          {rows.map((row, index) =>
            index % chart.labelStride === 0 || index === rows.length - 1 ? (
              <text
                key={row.date}
                x={chart.scaleX(index)}
                y={chart.height - (isMobile ? 14 : 12)}
                textAnchor="middle"
                fontSize={layout.labelFontSize}
                fontWeight={600}
                fill={neutrals.textMuted}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {formatShortDate(row.date)}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <div className="trends-chart-legend" aria-label="Chart legend">
        {SERIES.map((series) => (
          <span key={series.key} className="trends-chart-legend-item">
            <span className="trends-chart-legend-mark" aria-hidden="true">
              <span
                className="trends-chart-legend-line"
                style={{ backgroundColor: series.color }}
              />
              {series.marker === 'hollow' && (
                <span
                  className="trends-chart-legend-dot trends-chart-legend-dot-hollow"
                  style={{ borderColor: series.color }}
                />
              )}
              {series.marker === 'filled' && (
                <span
                  className="trends-chart-legend-dot trends-chart-legend-dot-filled"
                  style={{ backgroundColor: series.color, borderColor: series.color }}
                />
              )}
            </span>
            {series.label}
          </span>
        ))}
        {target > 0 && (
          <span className="trends-chart-legend-item">
            <span className="trends-chart-legend-mark" aria-hidden="true">
              <span
                className="trends-chart-legend-line trends-chart-legend-line-target"
                style={{ backgroundColor: TARGET_COLOR }}
              />
            </span>
            Target
          </span>
        )}
      </div>

      {rows.length > 0 && !showPoints && (
        <p className="trends-chart-mobile-hint">
          Longer ranges show lines only (no day dots). Intake · Output · thin blue Target
          {isMobile ? '. Y-axis k = thousands.' : '.'}
        </p>
      )}
      {isMobile && rows.length > 0 && showPoints && (
        <p className="trends-chart-mobile-hint">
          Intake: open green · Output: filled amber · Target: thin blue. Tap a point for exact kcal.
        </p>
      )}
    </div>
  )
}
