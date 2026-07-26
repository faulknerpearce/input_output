import { describe, expect, it } from 'vitest'
import {
  legacyRedirectPath,
  parseHashRoute,
  primaryNavRoute,
  routeHref,
  routeZone,
} from '../lib/routing'

describe('parseHashRoute', () => {
  it('parses primary routes from hash fragments', () => {
    expect(parseHashRoute('#/inputs')).toBe('inputs')
    expect(parseHashRoute('#/inputs/recipes')).toBe('inputs/recipes')
    expect(parseHashRoute('#/inputs/medications')).toBe('inputs/medications')
    expect(parseHashRoute('#/outputs/workouts')).toBe('outputs/workouts')
    expect(parseHashRoute('#/profile')).toBe('profile')
    expect(parseHashRoute('#/')).toBe('dashboard')
    expect(parseHashRoute('')).toBe('dashboard')
  })

  it('redirects legacy paths', () => {
    expect(parseHashRoute('#/recipes')).toBe('inputs/recipes')
    expect(parseHashRoute('#/workouts')).toBe('outputs/workouts')
  })
})

describe('routeHref', () => {
  it('builds hash links for each route', () => {
    expect(routeHref('inputs')).toBe('#/inputs')
    expect(routeHref('inputs/recipes')).toBe('#/inputs/recipes')
    expect(routeHref('inputs/medications')).toBe('#/inputs/medications')
    expect(routeHref('outputs/workouts')).toBe('#/outputs/workouts')
    expect(routeHref('dashboard')).toBe('#/')
  })
})

describe('routeZone', () => {
  it('maps nested routes to their zone', () => {
    expect(routeZone('inputs/recipes')).toBe('inputs')
    expect(routeZone('inputs/medications')).toBe('profile')
    expect(routeZone('outputs/workouts')).toBe('outputs')
    expect(routeZone('profile')).toBe('profile')
    expect(routeZone('dashboard')).toBe('dashboard')
  })
})

describe('legacyRedirectPath', () => {
  it('returns a replacement href for legacy paths only', () => {
    expect(legacyRedirectPath('#/recipes')).toBe('#/inputs/recipes')
    expect(legacyRedirectPath('#/inputs')).toBeNull()
  })
})

describe('primaryNavRoute', () => {
  it('collapses nested routes to top-level nav tabs', () => {
    expect(primaryNavRoute('inputs/recipes')).toBe('inputs')
    expect(primaryNavRoute('inputs/medications')).toBeNull()
    expect(primaryNavRoute('outputs/workouts')).toBe('outputs')
    expect(primaryNavRoute('profile')).toBeNull()
  })
})
