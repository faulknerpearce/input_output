import type { FoodEntry, NutritionGoals } from '@input_output/shared'
import { buildMetricConfigs } from '../../lib/metrics'
import { cardSurface } from '../../lib/styles'
import ProgressRing from '../charts/ProgressRing'

interface NutritionRingsPanelProps {
  entries: readonly FoodEntry[]
  goals: NutritionGoals
}

export default function NutritionRingsPanel({ entries, goals }: NutritionRingsPanelProps) {
  const metrics = buildMetricConfigs(entries, goals)

  return (
    <div className="dashboard-rings-grid">
      {metrics.map((metric) => {
        const unitSuffix = metric.unit ? ` ${metric.unit}` : ''
        const valueLabel = `${metric.formatValue(metric.value)}${unitSuffix}`
        const pct = metric.goal > 0 ? Math.round((metric.value / metric.goal) * 100) : 0

        return (
          <div
            key={metric.label}
            style={{
              ...cardSurface,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <ProgressRing
              value={metric.value}
              goal={metric.goal}
              color={metric.color}
              size={88}
              strokeWidth={8}
              centerSubLabel={`${pct}%`}
              ariaLabel={`${metric.label}: ${valueLabel}, ${pct} percent of goal`}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 9999,
                    background: metric.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i
                    className={`fa-solid ${metric.iconClass}`}
                    style={{ color: metric.color, fontSize: 11 }}
                  />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#71717a' }}>
                  {metric.label}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk','Inter',system-ui,sans-serif",
                  fontSize: 24,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  color: '#18181b',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {valueLabel}
              </div>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
                {metric.formatValue(metric.value)} / {metric.formatGoal(metric.goal)}
                {metric.unit ? metric.unit : ''}
              </div>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                Remaining:{' '}
                <span style={{ fontWeight: 500, color: '#3f3f46' }}>
                  {metric.remaining(metric.value, metric.goal)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}