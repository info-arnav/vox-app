import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import voxLogo from '../assets/vox.svg'

const getErrorMessage = (response) =>
  response?.error?.message || 'Sign-in failed. Please try again.'

const PASSWORD_RULES = '8-64 chars with uppercase, lowercase, number, and symbol.'

function AuthView({ bootError, onLoginSuccess }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isRegisterMode = mode === 'register'

  const resetFormErrors = () => {
    setError('')
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    resetFormErrors()
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    resetFormErrors()

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError('Email and password are required.')
      return
    }

    if (isRegisterMode && password !== confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    setSubmitting(true)
    const response = isRegisterMode
      ? await window.api.auth.register(normalizedEmail, password)
      : await window.api.auth.login(normalizedEmail, password)
    setSubmitting(false)

    if (!response?.success) {
      setError(getErrorMessage(response))
      return
    }

    onLoginSuccess(response.data?.session)
  }

  return (
    <section className="screen-shell">
      <article className="auth-card">
        <img alt="Vox logo" className="auth-logo" src={voxLogo} />
        <h1>{isRegisterMode ? 'Create your Vox account' : 'Welcome back to Vox'}</h1>
        <p className="auth-subtitle">
          {isRegisterMode
            ? 'Register with email and password to start using Vox.'
            : 'Sign in to continue to your desktop workspace.'}
        </p>

        <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            aria-selected={!isRegisterMode}
            className={!isRegisterMode ? 'active' : ''}
            onClick={() => switchMode('login')}
            role="tab"
            type="button"
          >
            Sign in
          </button>
          <button
            aria-selected={isRegisterMode}
            className={isRegisterMode ? 'active' : ''}
            onClick={() => switchMode('register')}
            role="tab"
            type="button"
          >
            Register
          </button>
        </div>

        {bootError ? (
          <p className="alert alert-error">
            <AlertCircle aria-hidden="true" size={14} />
            {bootError}
          </p>
        ) : null}
        {error ? (
          <p className="alert alert-error">
            <AlertCircle aria-hidden="true" size={14} />
            {error}
          </p>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">
            Email
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>

          <label htmlFor="password">
            Password
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
          </label>

          {isRegisterMode ? (
            <label htmlFor="confirm-password">
              Confirm password
              <input
                autoComplete="new-password"
                id="confirm-password"
                name="confirm-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                type="password"
                value={confirmPassword}
              />
            </label>
          ) : null}

          {isRegisterMode ? <p className="form-hint">Password rules: {PASSWORD_RULES}</p> : null}

          <button disabled={submitting} type="submit">
            {submitting
              ? isRegisterMode
                ? 'Creating account...'
                : 'Signing in...'
              : isRegisterMode
                ? 'Create account'
                : 'Sign in'}
          </button>

          {isRegisterMode ? (
            <p className="auth-legal">
              By creating an account you agree to our{' '}
              <a href="https://www.vox-ai.chat/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://www.vox-ai.chat/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </p>
          ) : null}
        </form>
      </article>
    </section>
  )
}

export default AuthView
