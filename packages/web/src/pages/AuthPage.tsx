import { useState, type CSSProperties, type FormEvent } from 'react'
import { Alert, Button, Card } from '../components/ui'
import { useAuth } from '../context/useAuth'
import { DASHBOARD_SKY_TOP, neutrals, radius, type, zoneGradients } from '../lib/design-tokens'
import { inputBase, labelBase } from '../lib/styles'

type Mode = 'signin' | 'signup' | 'forgot'

const textLinkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: neutrals.textMuted,
  fontSize: type.bodySm,
  cursor: 'pointer',
  textDecoration: 'underline',
}

export default function AuthPage() {
  const {
    session,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    passwordRecovery,
  } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const choosingNewPassword = passwordRecovery && Boolean(session)
  const recoveryExpired = passwordRecovery && !session
  const showAuthToggle = !passwordRecovery && mode !== 'forgot'

  function resetNotices() {
    setError(null)
    setMessage(null)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setPassword('')
    setConfirmPassword('')
    resetNotices()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    resetNotices()
    setSubmitting(true)

    if (choosingNewPassword) {
      if (password !== confirmPassword) {
        setSubmitting(false)
        setError('Passwords do not match.')
        return
      }
      const { error: updateError } = await updatePassword(password)
      setSubmitting(false)
      if (updateError) setError(updateError)
      return
    }

    if (mode === 'forgot') {
      const { error: resetError } = await requestPasswordReset(email)
      setSubmitting(false)
      if (resetError) {
        setError(resetError)
        return
      }
      setMessage('If an account exists for that email, we sent a link to reset your password.')
      return
    }

    if (mode === 'signup') {
      const { error: signUpError } = await signUp(email, password, displayName)
      setSubmitting(false)
      if (signUpError) {
        setError(signUpError)
        return
      }
      setMessage('Account created. You are signed in.')
      return
    }

    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) setError(signInError)
  }

  const heading = choosingNewPassword
    ? 'Choose a new password'
    : recoveryExpired
      ? 'Reset link expired'
      : mode === 'forgot'
        ? 'Reset password'
        : mode === 'signin'
          ? 'Sign in'
          : 'Create account'

  const subtitle = choosingNewPassword
    ? 'Enter a new password for your account.'
    : recoveryExpired
      ? 'Request a new link from the sign-in page.'
      : mode === 'forgot'
        ? 'We will email you a link to choose a new password.'
        : 'Track daily fuel, movement, and balance.'

  return (
    <div
      className="auth-atmosphere"
      style={{
        minHeight: '100vh',
        background: zoneGradients.dashboard,
        backgroundAttachment: 'fixed',
        padding: '48px 16px',
        position: 'relative',
      }}
    >
      <Card
        tone="neutral"
        style={{
          maxWidth: 400,
          margin: '0 auto',
          padding: 32,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            background: DASHBOARD_SKY_TOP,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            fontSize: 18,
          }}
          aria-hidden="true"
        >
          <i className="fa-solid fa-fire" />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: type.titleLg,
            fontWeight: 600,
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
            color: neutrals.textPrimary,
          }}
        >
          {heading}
        </h1>
        <p style={{ fontSize: type.body, color: neutrals.textMuted, margin: '0 0 24px 0' }}>
          {subtitle}
        </p>

        {showAuthToggle && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <Button
              variant={mode === 'signin' ? 'primary' : 'secondary'}
              style={{ flex: 1 }}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </Button>
            <Button
              variant={mode === 'signup' ? 'primary' : 'secondary'}
              style={{ flex: 1 }}
              onClick={() => switchMode('signup')}
            >
              Sign up
            </Button>
          </div>
        )}

        {recoveryExpired ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert variant="error">This reset link is invalid or has expired.</Alert>
            <Button
              type="button"
              size="md"
              style={{ width: '100%' }}
              onClick={() => void signOut()}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {mode === 'signup' && !choosingNewPassword && (
              <label style={labelBase}>
                Display name
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
            )}

            {!choosingNewPassword && (
              <label style={labelBase}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
            )}

            {mode !== 'forgot' && (
              <label style={labelBase}>
                {choosingNewPassword ? 'New password' : 'Password'}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
            )}

            {choosingNewPassword && (
              <label style={labelBase}>
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  style={{ ...inputBase, marginTop: 6 }}
                />
              </label>
            )}

            {mode === 'signin' && !choosingNewPassword && (
              <button
                type="button"
                style={{ ...textLinkStyle, alignSelf: 'flex-end' }}
                onClick={() => switchMode('forgot')}
              >
                Forgot password?
              </button>
            )}

            {error && <Alert variant="error">{error}</Alert>}
            {message && <Alert variant="success">{message}</Alert>}

            <Button
              type="submit"
              size="md"
              disabled={submitting}
              style={{ marginTop: 8, width: '100%' }}
            >
              {submitting
                ? 'Please wait…'
                : choosingNewPassword
                  ? 'Update password'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
            </Button>

            {(mode === 'forgot' || choosingNewPassword) && (
              <button
                type="button"
                style={{ ...textLinkStyle, alignSelf: 'center' }}
                onClick={() => {
                  if (choosingNewPassword) {
                    void signOut()
                    return
                  }
                  switchMode('signin')
                }}
              >
                Back to sign in
              </button>
            )}
          </form>
        )}
      </Card>
    </div>
  )
}
