import type { NetBalance } from '@input_output/shared'
import { netRingProgress } from '../../lib/dashboardCharts'
import { neutrals, radius, type as typeScale } from '../../lib/design-tokens'
import ProgressRing from '../charts/ProgressRing'
import DayNavigator from '../layout/DayNavigator'
import Card from '../ui/Card'
import DeviceTotalControl from './DeviceTotalControl'
import OutputComposition from './OutputComposition'

interface EnergyOverviewPanelProps {
  balance: NetBalance
  /** ISO date shown in this card (supports day browsing). */
  date: string
  isToday: boolean
  canGoBack?: boolean
  canGoForward?: boolean
  dayLoading?: boolean
  onPrevious: () => void
  onNext: () => void
  onGoToToday: () => void
  /** When true, show device total input (profile.usesWearable). */
  usesWearable?: boolean
  onSaveDeviceTotal?: (kcal: number) => Promise<void>
  onClearDeviceTotal?: () => Promise<void>
}

/** Status of net kcal vs the daily goal band (low–high). */
const statusLabel: Record<NetBalance['status'], string> = {
  under: 'Under goal',
  in_range: 'In range',
  over: 'Over goal',
}

/** Theme-aligned chart colors (golden hour wellness palette). */
const GOAL_GREEN = '#5BA88A'
const GOAL_GREEN_SOFT = 'rgba(91, 168, 138, 0.28)'
const GOAL_GREEN_BORDER = '#4A9A7A'

const statusColor: Record<NetBalance['status'], string> = {
  under: '#0C4197', // dashboard blue
  in_range: GOAL_GREEN,
  over: '#E89830', // outputs yellow
}

const statusBadgeBg: Record<NetBalance['status'], string> = {
  under: 'rgba(12, 65, 151, 0.16)',
  in_range: 'rgba(91, 168, 138, 0.18)',
  over: 'rgba(232, 152, 48, 0.18)',
}

/** Net position on a track with the goal low–high band and a Target mark. */
function GoalZoneTrack({ balance }: { balance: NetBalance }) {
  // Floor display at 0 so BMR-driven negative net does not show below the track origin
  const displayNet = Math.max(balance.net, 0)
  const max = Math.max(balance.goalHigh, displayNet, 1)
  const lowPct = max > 0 ? (balance.goalLow / max) * 100 : 0
  const highPct = max > 0 ? (balance.goalHigh / max) * 100 : 0
  // Target sits in the green zone — midpoint of low–high band
  const targetValue = (balance.goalLow + balance.goalHigh) / 2
  const targetPct = max > 0 ? Math.min((targetValue / max) * 100, 100) : 0
  const netPct = max > 0 ? Math.min((displayNet / max) * 100, 100) : 0
  const color = statusColor[balance.status]
  const trackTop = 10
  const trackHeight = 12
  const dotSize = 14
  const targetMarkH = 20
  const trackCenterY = trackTop + trackHeight / 2

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${neutrals.border}` }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: neutrals.textMuted,
            textTransform: 'uppercase',
          }}
        >
          Net vs goal
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: statusColor.in_range,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {balance.goalLow.toLocaleString()}–{balance.goalHigh.toLocaleString()} kcal
        </span>
      </div>

      <div style={{ position: 'relative', height: 40, marginBottom: 4 }}>
        <div
          style={{
            position: 'absolute',
            top: trackTop,
            left: 0,
            right: 0,
            height: trackHeight,
            borderRadius: 9999,
            background: neutrals.surfaceHover,
            border: `1px solid ${neutrals.borderStrong}`,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
          }}
        />
        {displayNet > 0 && (
          <div
            style={{
              position: 'absolute',
              top: trackTop,
              left: 0,
              height: trackHeight,
              width: `${netPct}%`,
              borderRadius: 9999,
              background: `linear-gradient(90deg, ${color}55, ${color}99)`,
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}
        {/* Green target zone (goal low → high) */}
        <div
          style={{
            position: 'absolute',
            top: trackTop,
            left: `${lowPct}%`,
            height: trackHeight,
            width: `${Math.max(highPct - lowPct, 0)}%`,
            borderRadius: 9999,
            background: GOAL_GREEN_SOFT,
            border: `2px solid ${GOAL_GREEN_BORDER}`,
            boxSizing: 'border-box',
          }}
        />
        {/* Target mark — center of green zone */}
        <div
          title={`Target ${Math.round(targetValue).toLocaleString()} kcal`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: trackCenterY,
            left: `${targetPct}%`,
            width: 3,
            height: targetMarkH,
            marginLeft: -1.5,
            borderRadius: 2,
            background: GOAL_GREEN,
            boxShadow: '0 0 0 2px #ffffff, 0 1px 3px rgba(0,0,0,0.18)',
            transform: 'translateY(-50%)',
            zIndex: 2,
          }}
        />
        {/* Always show marker; floors to left edge when net ≤ 0 */}
        <div
          title={
            balance.net < 0
              ? `Current net ${balance.net.toLocaleString()} kcal (shown at 0)`
              : `Current net ${displayNet.toLocaleString()} kcal`
          }
          style={{
            position: 'absolute',
            top: trackCenterY,
            left: `calc(${netPct}% - ${dotSize / 2}px)`,
            width: dotSize,
            height: dotSize,
            borderRadius: 9999,
            background: color,
            border: '3px solid white',
            boxShadow: `0 2px 8px ${color}66, 0 0 0 1px ${color}`,
            transform: 'translateY(-50%)',
            transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 3,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}
          title={
            balance.net < 0
              ? 'True net is negative; marker stays at 0 on the track'
              : undefined
          }
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: neutrals.textFaint,
            }}
          >
            Current
          </span>
          <span style={{ color }}>{balance.net.toLocaleString()}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: GOAL_GREEN,
            }}
          >
            Target
          </span>
          <span style={{ color: GOAL_GREEN }}>{Math.round(targetValue).toLocaleString()}</span>
        </span>
      </div>
    </div>
  )
}

export default function EnergyOverviewPanel({
  balance,
  date,
  isToday,
  canGoBack = true,
  canGoForward = false,
  dayLoading = false,
  onPrevious,
  onNext,
  onGoToToday,
  usesWearable = false,
  onSaveDeviceTotal,
  onClearDeviceTotal,
}: EnergyOverviewPanelProps) {
  const color = statusColor[balance.status]
  const ring = netRingProgress(balance)
  // Fill only when net is positive; still show true % (including negative) in the center
  const ringFillValue = balance.net > 0 ? balance.net : 0
  const ringCenterLabel = `${ring.pct}%`

  return (
    <Card tone="neutral" style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <p
          style={{
            fontSize: typeScale.eyebrow,
            fontWeight: 600,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: neutrals.textPrimary,
            margin: 0,
          }}
        >
          Daily energy
        </p>
        <span
          title={
            balance.status === 'under'
              ? 'Net kcal is below your low goal — still building toward the target range'
              : balance.status === 'over'
                ? 'Net kcal is above your high goal'
                : 'Net kcal is within your low–high goal range'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: radius.pill,
            background: statusBadgeBg[balance.status],
            color,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {statusLabel[balance.status]}
        </span>
      </div>

      <div className="energy-day-nav" style={{ marginBottom: 12 }}>
        <DayNavigator
          date={date}
          isToday={isToday}
          compact
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onPrevious={onPrevious}
          onNext={onNext}
          onGoToToday={onGoToToday}
          itemLabel={{ singular: 'log day', plural: 'log days' }}
        />
      </div>

      <div
        className="energy-overview-ring-row"
        style={{
          marginBottom: 12,
          opacity: dayLoading ? 0.55 : 1,
          transition: 'opacity 0.15s ease',
          pointerEvents: dayLoading ? 'none' : undefined,
        }}
      >
        {/* Net balance (in − out) — title sits above kcal so it mirrors Total output */}
        <div className="energy-overview-net-section">
          <div className="energy-overview-net-body">
            <div className="energy-overview-ring">
              <ProgressRing
                value={ringFillValue}
                goal={balance.goalHigh}
                color={color}
                size={112}
                strokeWidth={10}
                centerLabel={ringCenterLabel}
                ariaLabel={
                  balance.net < 0
                    ? `Net energy ${balance.net} kilocalories, ring empty while net is negative`
                    : `Net energy ${balance.net} kilocalories, ${ring.pct} percent of high goal`
                }
              />
            </div>

            <div className="energy-overview-stats">
              <p className="energy-overview-section-title">Net energy</p>
              <div className="energy-overview-net">
                <span className="energy-overview-net-value">{balance.net.toLocaleString()}</span>
                <span className="energy-overview-net-unit">kcal net</span>
              </div>
              <div className="energy-overview-io energy-overview-io-stacked">
                <span>
                  <strong>{balance.consumed.toLocaleString()}</strong> in
                </span>
                <span>
                  <strong>{balance.burned.toLocaleString()}</strong> out
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="energy-overview-section-divider" aria-hidden="true" />

        {/* Right of net stats — fills trailing blank space on the row */}
        <OutputComposition balance={balance} />
      </div>

      <div style={{ opacity: dayLoading ? 0.55 : 1, transition: 'opacity 0.15s ease' }}>
        <GoalZoneTrack balance={balance} />
      </div>

      {usesWearable && onSaveDeviceTotal && onClearDeviceTotal && (
        <div style={{ marginTop: 12 }}>
          <DeviceTotalControl
            key={`${date}-${balance.deviceTotal ?? 'none'}`}
            deviceTotal={balance.deviceTotal}
            bmr={balance.bmr}
            activityCalories={balance.activityCalories}
            dayLoading={dayLoading}
            onSave={onSaveDeviceTotal}
            onClear={onClearDeviceTotal}
          />
        </div>
      )}
    </Card>
  )
}
