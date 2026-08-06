import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useProfileOptional } from '../context/useProfile'
import { DASHBOARD_SKY_TOP, zoneCssVars, zoneTokens, type ZoneId } from '../lib/design-tokens'
import {
  primaryNavRoute,
  routeHref,
  routeZone,
  type AppRoute,
} from '../lib/routing'
import { fetchNewSharedCount } from '../lib/sharedNotifications'
import MobileTabBar from './layout/MobileTabBar'

interface LayoutProps {
  children: React.ReactNode
  activeRoute: AppRoute
}

const navTabs: { route: 'dashboard' | 'inputs' | 'outputs'; label: string }[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'inputs', label: 'Inputs' },
  { route: 'outputs', label: 'Outputs' },
]

export default function Layout({ children, activeRoute }: LayoutProps) {
  const { user } = useAuth()
  const profileContext = useProfileOptional()
  const [menuOpen, setMenuOpen] = useState(false)
  const [fetchedShareCount, setFetchedShareCount] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const activeNav = primaryNavRoute(activeRoute)
  const zone = routeZone(activeRoute)
  const atmosphereZone: ZoneId =
    zone === 'profile'
      ? 'profile'
      : activeNav === 'dashboard' || activeNav === null
        ? 'dashboard'
        : activeNav
  const atmosphere = zoneTokens[atmosphereZone]
  const layoutBg = atmosphere.bg

  const displayLabel =
    profileContext && !profileContext.loading
      ? profileContext.profile.displayName
      : (user?.email?.split('@')[0] ?? 'Account')

  const trackSharedNotifications = Boolean(user) && activeRoute !== 'shared'
  const newShareCount = trackSharedNotifications ? fetchedShareCount : 0

  useEffect(() => {
    if (!trackSharedNotifications) return

    let cancelled = false
    void fetchNewSharedCount()
      .then((count) => {
        if (!cancelled) setFetchedShareCount(count)
      })
      .catch(() => {
        if (!cancelled) setFetchedShareCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [trackSharedNotifications, user?.id, activeRoute])

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div
      className="app-layout"
      data-zone={atmosphereZone}
      style={{
        background: layoutBg,
        ...zoneCssVars(atmosphere),
        ['--layout-bg' as string]: layoutBg,
        /* Center tab active fill = dashboard sky top (not zone accent) */
        ['--nav-center-active' as string]: DASHBOARD_SKY_TOP,
        ['--nav-center-blue' as string]: DASHBOARD_SKY_TOP,
        ['--dashboard-sky-top' as string]: DASHBOARD_SKY_TOP,
      }}
    >
      <nav className="app-nav">
        <div className="app-nav-inner">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <a href={routeHref('dashboard')} className="app-nav-brand" style={{ textDecoration: 'none' }}>
              <i
                className="fa-solid fa-fire app-nav-logo-icon"
                aria-hidden="true"
                style={{
                  color:
                    atmosphereZone === 'dashboard'
                      ? DASHBOARD_SKY_TOP
                      : zoneTokens[atmosphereZone].accent,
                }}
              />
              <span className="app-nav-title">Input Output</span>
            </a>
            <div
              ref={menuRef}
              style={{
                position: 'relative',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                className="account-menu-display-name"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: zone === 'profile' ? '#3A3A3C' : 'var(--color-text-secondary, #3A3A3C)',
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={displayLabel}
              >
                {displayLabel}
              </span>
              <button
                type="button"
                aria-label={
                  newShareCount > 0
                    ? `Account menu, ${newShareCount} new shared items`
                    : 'Account menu'
                }
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => setMenuOpen((open) => !open)}
                className={zone === 'profile' ? undefined : 'glass-strong'}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 9999,
                  border:
                    zone === 'profile'
                      ? '1px solid #27272a'
                      : '1px solid rgba(255, 255, 255, 0.55)',
                  background: zone === 'profile' ? '#4A4A58' : undefined,
                  color: zone === 'profile' ? 'white' : '#3A3A3C',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow:
                    zone === 'profile' ? '0 2px 8px rgba(28, 28, 30, 0.08)' : undefined,
                }}
              >
                <i className="fa-solid fa-user" style={{ fontSize: 16 }} aria-hidden="true" />
                {newShareCount > 0 && (
                  <span className="account-menu-badge" aria-hidden="true">
                    {newShareCount > 9 ? '9+' : newShareCount}
                  </span>
                )}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="glass-strong account-menu-panel"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 200,
                    borderRadius: 16,
                    padding: 8,
                    zIndex: 50,
                  }}
                >
                  <a
                    href={routeHref('inputs/medications')}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      color: '#3f3f46',
                      fontSize: 13,
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Medications
                  </a>
                  <a
                    href={routeHref('shared')}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      color: '#3f3f46',
                      fontSize: 13,
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    <span>Shared With Me</span>
                    {newShareCount > 0 && (
                      <span
                        style={{
                          minWidth: 18,
                          height: 18,
                          padding: '0 5px',
                          borderRadius: 9999,
                          background: '#ef4444',
                          color: 'white',
                          fontSize: 11,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {newShareCount > 9 ? '9+' : newShareCount}
                      </span>
                    )}
                  </a>
                  <a
                    href={routeHref('profile')}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      color: '#3f3f46',
                      fontSize: 13,
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Profile
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="app-nav-tabs">
            {navTabs.map((tab) => {
              const active = activeNav === tab.route
              // Dashboard uses sky-top cool slate (same as mobile center control)
              const accent =
                tab.route === 'dashboard' ? DASHBOARD_SKY_TOP : zoneTokens[tab.route].accent
              return (
                <a
                  key={tab.route}
                  href={routeHref(tab.route)}
                  className={active ? 'app-nav-tab app-nav-tab-active' : 'app-nav-tab'}
                  style={active ? ({ '--tab-accent': accent } as React.CSSProperties) : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  {tab.label}
                </a>
              )
            })}
          </div>
        </div>
      </nav>
      <main className="app-main">{children}</main>
      <MobileTabBar activeRoute={activeRoute} />
    </div>
  )
}