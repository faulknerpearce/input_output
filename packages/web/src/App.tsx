import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import PageShell from './components/layout/PageShell'
import { AuthProvider } from './context/AuthProvider'
import { ProfileProvider } from './context/ProfileProvider'
import { useAuth } from './context/useAuth'
import { legacyRedirectPath, parseHashRoute, type AppRoute } from './lib/routing'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import InputsZone from './pages/InputsZone'
import MedicationsPage from './pages/MedicationsPage'
import OutputsZone from './pages/OutputsZone'
import ProfilePage from './pages/ProfilePage'
import SharedWithMePage from './pages/SharedWithMePage'

function useHashRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute(window.location.hash))

  useEffect(() => {
    const redirect = legacyRedirectPath(window.location.hash)
    if (redirect) {
      window.location.replace(redirect)
      return
    }

    const onHashChange = () => setRoute(parseHashRoute(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}

function AppContent() {
  const { session, loading } = useAuth()
  const route = useHashRoute()

  if (loading) {
    return (
      <div role="status" style={{ textAlign: 'center', padding: '80px 20px', color: '#a1a1aa' }}>
        <i
          className="fa-solid fa-spinner fa-spin"
          style={{ fontSize: 32, marginBottom: 12, display: 'block' }}
        />
        Loading…
      </div>
    )
  }

  if (!session) {
    return <AuthPage />
  }

  return (
    <ProfileProvider>
      <Layout activeRoute={route}>
        {route === 'profile' ? (
          <PageShell zone="profile">
            <ProfilePage />
          </PageShell>
        ) : route === 'shared' ? (
          <PageShell zone="profile">
            <SharedWithMePage />
          </PageShell>
        ) : route === 'inputs/medications' ? (
          <PageShell zone="profile">
            <MedicationsPage />
          </PageShell>
        ) : route === 'inputs' || route === 'inputs/recipes' ? (
          <InputsZone route={route} />
        ) : route === 'outputs' || route === 'outputs/workouts' ? (
          <OutputsZone route={route} />
        ) : (
          <PageShell zone="dashboard">
            <Dashboard />
          </PageShell>
        )}
      </Layout>
    </ProfileProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}