import type { Activity } from '@input_output/shared'
import { buildActivityMetricConfigs } from '../../lib/activityMetrics'
import { cardSurface } from '../../lib/styles'
import { routeHref } from '../../lib/routing'
import ActivityMetricCard from '../ActivityMetricCard'

interface ActivityOverviewPanelProps {
  activities: readonly Activity[]
}

export default function ActivityOverviewPanel({ activities }: ActivityOverviewPanelProps) {
  if (activities.length === 0) {
    return (
      <div
        style={{
          ...cardSurface,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p style={{ fontWeight: 500, color: '#52525b', margin: '0 0 4px 0' }}>
          No activities logged today
        </p>
        <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0 }}>
          <a href={routeHref('outputs')} style={{ color: 'var(--zone-accent)', fontWeight: 500 }}>
            Log an activity
          </a>{' '}
          to track workouts and calories burned.
        </p>
      </div>
    )
  }

  const metricConfigs = buildActivityMetricConfigs(activities)

  return (
    <div className="metric-grid-2">
      {metricConfigs.map((metric) => (
        <ActivityMetricCard key={metric.label} config={metric} />
      ))}
    </div>
  )
}