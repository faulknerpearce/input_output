import type { NetBalance } from '@input_output/shared'
import { neutrals, ZONE_OUTPUT } from '../../lib/design-tokens'

interface OutputCompositionProps {
  balance: NetBalance
}

/** Match Daily energy ProgressRing: size 112, stroke 10. */
const DONUT_SIZE = 112
const STROKE = 10

/** Muted gray — base burn (BMR or device total). */
const BASE_RING = '#C7C7CC'
const ACTIVITY_COLOR = ZONE_OUTPUT

function compositionPercents(baseBurn: number, burned: number) {
  if (burned <= 0) {
    return { basePct: 100, activityPct: 0 }
  }
  const basePct = Math.round((baseBurn / burned) * 100)
  return { basePct, activityPct: 100 - basePct }
}

/**
 * Dominant burn mode for the donut center.
 * Resting/Device when base is the larger share; Active when activity wins.
 */
function dominantMode(
  basePct: number,
  activityPct: number,
  baseSource: NetBalance['baseSource'],
): {
  label: string
  pct: number
  color: string
} {
  if (activityPct > basePct) {
    return { label: 'Active', pct: activityPct, color: ACTIVITY_COLOR }
  }
  return {
    label: baseSource === 'device' ? 'Device' : 'Resting',
    pct: basePct,
    color: BASE_RING,
  }
}

/** Two-segment composition donut with mode label in the center. */
function CompositionDonut({
  basePct,
  activityPct,
  baseSource,
  ariaLabel,
}: {
  basePct: number
  activityPct: number
  baseSource: NetBalance['baseSource']
  ariaLabel: string
}) {
  const radius = (DONUT_SIZE - STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const center = DONUT_SIZE / 2

  const baseLen = (basePct / 100) * circumference
  const activityLen = (activityPct / 100) * circumference
  const mode = dominantMode(basePct, activityPct, baseSource)

  return (
    <div
      style={{
        position: 'relative',
        width: DONUT_SIZE,
        height: DONUT_SIZE,
        flexShrink: 0,
      }}
    >
      <svg
        width={DONUT_SIZE}
        height={DONUT_SIZE}
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#f4f4f5"
          strokeWidth={STROKE}
        />
        {basePct > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={BASE_RING}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            strokeDasharray={`${baseLen} ${circumference - baseLen}`}
            strokeDashoffset={0}
            style={{ transition: 'stroke-dasharray 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        )}
        {activityPct > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ACTIVITY_COLOR}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            strokeDasharray={`${activityLen} ${circumference - activityLen}`}
            strokeDashoffset={-baseLen}
            style={{
              transition:
                'stroke-dasharray 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          textAlign: 'center',
          lineHeight: 1.15,
          padding: 8,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: neutrals.textPrimary,
            letterSpacing: '-0.01em',
          }}
        >
          {mode.label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: mode.color,
            fontVariantNumeric: 'tabular-nums',
            marginTop: 2,
          }}
        >
          {mode.pct}%
        </span>
      </div>
    </div>
  )
}

/**
 * Share of total daily burn: base (BMR or device) vs activity.
 * Layout mirrors net energy: title + big kcal, then ring.
 */
export default function OutputComposition({ balance }: OutputCompositionProps) {
  const { baseBurn, baseSource, activityCalories, burned } = balance
  const { basePct, activityPct } = compositionPercents(baseBurn, burned)
  const baseLabel = baseSource === 'device' ? 'Device' : 'BMR'

  const ariaLabel = `Total output ${burned} kilocalories: ${basePct}% ${baseLabel} (${baseBurn}), ${activityPct}% activity (${activityCalories})`

  return (
    <div className="energy-overview-output">
      <div className="energy-overview-output-body">
        <div className="energy-overview-output-stats">
          <p className="energy-overview-section-title">Total output</p>
          <div className="energy-overview-net">
            <span className="energy-overview-net-value">{burned.toLocaleString()}</span>
            <span className="energy-overview-net-unit">kcal out</span>
          </div>
          <div className="energy-overview-output-legend">
            <div className="energy-overview-output-row">
              <span
                className="energy-overview-output-swatch"
                style={{ background: BASE_RING }}
                aria-hidden="true"
              />
              <span className="energy-overview-output-pct">{basePct}%</span>
              <span className="energy-overview-output-label">{baseLabel}</span>
              <span className="energy-overview-output-kcal">{baseBurn.toLocaleString()}</span>
            </div>
            <div className="energy-overview-output-row">
              <span
                className="energy-overview-output-swatch"
                style={{ background: ACTIVITY_COLOR }}
                aria-hidden="true"
              />
              <span className="energy-overview-output-pct">{activityPct}%</span>
              <span className="energy-overview-output-label">Activity</span>
              <span className="energy-overview-output-kcal">
                {activityCalories.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        <CompositionDonut
          basePct={basePct}
          activityPct={activityPct}
          baseSource={baseSource}
          ariaLabel={ariaLabel}
        />
      </div>
    </div>
  )
}
