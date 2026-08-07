export type AppRoute =
  | 'dashboard'
  | 'inputs'
  | 'inputs/recipes'
  | 'inputs/ingredients'
  | 'inputs/medications'
  | 'outputs'
  | 'outputs/workouts'
  | 'profile'
  | 'shared'

export type AppZone = 'dashboard' | 'inputs' | 'outputs' | 'profile'

const LEGACY_REDIRECTS: Record<string, AppRoute> = {
  recipes: 'inputs/recipes',
  workouts: 'outputs/workouts',
}

export function parseHashRoute(hash: string): AppRoute {
  const path = hash.replace(/^#/, '').replace(/^\//, '')
  if (path in LEGACY_REDIRECTS) return LEGACY_REDIRECTS[path]
  if (path === 'inputs/recipes') return 'inputs/recipes'
  if (path === 'inputs/ingredients') return 'inputs/ingredients'
  if (path === 'inputs/medications') return 'inputs/medications'
  if (path === 'outputs/workouts') return 'outputs/workouts'
  if (path === 'inputs') return 'inputs'
  if (path === 'outputs') return 'outputs'
  if (path === 'profile') return 'profile'
  if (path === 'shared') return 'shared'
  return 'dashboard'
}

export function routeHref(route: AppRoute): string {
  if (route === 'inputs') return '#/inputs'
  if (route === 'inputs/recipes') return '#/inputs/recipes'
  if (route === 'inputs/ingredients') return '#/inputs/ingredients'
  if (route === 'inputs/medications') return '#/inputs/medications'
  if (route === 'outputs') return '#/outputs'
  if (route === 'outputs/workouts') return '#/outputs/workouts'
  if (route === 'profile') return '#/profile'
  if (route === 'shared') return '#/shared'
  return '#/'
}

export function routeZone(route: AppRoute): AppZone {
  if (route === 'inputs/medications') return 'profile'
  if (route.startsWith('inputs')) return 'inputs'
  if (route.startsWith('outputs')) return 'outputs'
  if (route === 'profile' || route === 'shared') return 'profile'
  return 'dashboard'
}

export function legacyRedirectPath(hash: string): string | null {
  const path = hash.replace(/^#/, '').replace(/^\//, '')
  const target = LEGACY_REDIRECTS[path]
  return target ? routeHref(target) : null
}

export function primaryNavRoute(route: AppRoute): 'dashboard' | 'inputs' | 'outputs' | null {
  const zone = routeZone(route)
  if (zone === 'inputs') return 'inputs'
  if (zone === 'outputs') return 'outputs'
  if (zone === 'profile') return null
  return 'dashboard'
}