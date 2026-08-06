import { describe, expect, it } from 'vitest'
import type { Activity } from '@input_output/shared'
import { buildActivityMetricConfigs } from '../lib/activityMetrics'

function activity(partial: Partial<Activity> & Pick<Activity, 'id' | 'name'>): Activity {
  return {
    activityType: 'Run',
    activityDate: '2026-06-25',
    loggedAt: '2026-06-25T12:00:00Z',
    distanceMeters: null,
    movingTimeSeconds: 0,
    averageHeartrate: null,
    maxHeartrate: null,
    calories: null,
    workoutId: null,
    workoutSetsLogged: null,
    exercises: [],
    ...partial,
  }
}

describe('buildActivityMetricConfigs', () => {
  it('returns empty-state metrics when no activities exist', () => {
    const metrics = buildActivityMetricConfigs([])
    expect(metrics).toHaveLength(4)
    expect(metrics[0]).toMatchObject({ label: 'Calories Burned', value: '0' })
    expect(metrics[3]).toMatchObject({ label: 'Activities', value: '0', detail: 'workouts logged' })
  })

  it('aggregates totals across activities', () => {
    const metrics = buildActivityMetricConfigs([
      activity({
        id: '1',
        name: 'Run',
        calories: 300,
        movingTimeSeconds: 1800,
        distanceMeters: 5000,
      }),
      activity({
        id: '2',
        name: 'Walk',
        calories: 100,
        movingTimeSeconds: 1200,
        distanceMeters: 1500,
      }),
    ])

    expect(metrics[0].value).toBe('400')
    expect(metrics[1].value).toBe('50m')
    expect(metrics[2].value).toBe('6.5 km')
    expect(metrics[3]).toMatchObject({ value: '2', detail: 'workouts logged' })
  })
})
