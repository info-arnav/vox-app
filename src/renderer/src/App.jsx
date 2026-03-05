import { useEffect, useState } from 'react'
import voxLogo from './assets/vox.svg'
import AuthView from './views/AuthView'
import AuthenticatedApp from './app/AuthenticatedApp'
import VerificationRequiredView from './views/VerificationRequiredView'
import { CHAT_STORAGE_KEY_PREFIX } from './features/chat/utils/chat.constants'
import { FOLDERS_STORAGE_KEY } from './features/knowledge/hooks/useFoldersStore'
import { INDEXING_PAUSED_STORAGE_KEY } from './features/knowledge/hooks/useIndexingController'
import { isAuthExpiredResponse } from './shared/hooks/useSessionRecovery'

const EMPTY_SESSION = {
  authenticated: false,
  user: null,
  lastLoginAt: null
}

const IS_MAC_OS = navigator.userAgent.toUpperCase().includes('MAC')

function App() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState(EMPTY_SESSION)
  const [bootError, setBootError] = useState('')
  useEffect(() => {
    const hydrateSession = async () => {
      const response = await window.api.auth.getSession()
      if (!response?.success) {
        setBootError(response?.error?.message || 'Failed to read session state.')
        setSession(EMPTY_SESSION)
        setBooting(false)
        return
      }

      setSession(response.data?.session || EMPTY_SESSION)
      setBooting(false)
    }

    hydrateSession()
  }, [])

  useEffect(() => {
    return window.api.auth.onExpired(async () => {
      const response = await window.api.auth.getSession()
      setSession(response?.data?.session || EMPTY_SESSION)
    })
  }, [])

  const handleLoginSuccess = (nextSession) => {
    setSession(nextSession || EMPTY_SESSION)
    setBootError('')
  }

  const clearWorkspaceLocalState = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    const keysToRemove = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) {
        continue
      }

      if (key.startsWith(`${CHAT_STORAGE_KEY_PREFIX}:`)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.push(FOLDERS_STORAGE_KEY, INDEXING_PAUSED_STORAGE_KEY)

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key)
    }
  }

  const handleLogout = async () => {
    clearWorkspaceLocalState()
    setSession(EMPTY_SESSION)
    setBootError('')

    window.api.auth.logout().catch(() => {})
    window.api.chat.disconnect().catch(() => {})
    window.api.indexing.resetState().catch(() => {})
  }

  const syncSessionFromMain = async () => {
    const sessionResponse = await window.api.auth.getSession()
    if (!sessionResponse?.success) {
      setSession(EMPTY_SESSION)
      return
    }

    setSession(sessionResponse.data?.session || EMPTY_SESSION)
  }

  const handlePotentialAuthExpiry = async (response) => {
    if (!isAuthExpiredResponse(response)) {
      return false
    }

    await syncSessionFromMain()
    return true
  }

  const handleRequestVerification = async () => {
    const response = await window.api.auth.resendVerification()
    if (!response?.success) {
      const didExpire = await handlePotentialAuthExpiry(response)
      return {
        success: false,
        message: didExpire
          ? 'Session expired. Please sign in again.'
          : response?.error?.message || 'Failed to send verification email.'
      }
    }

    return {
      success: true,
      message: response?.data?.message || 'Verification email sent.'
    }
  }

  const handleRefreshVerification = async () => {
    const response = await window.api.auth.refreshVerification()
    if (!response?.success) {
      const didExpire = await handlePotentialAuthExpiry(response)
      return {
        success: false,
        message: didExpire
          ? 'Session expired. Please sign in again.'
          : response?.error?.message || 'Failed to refresh verification status.'
      }
    }

    const nextSession = response?.data?.session || EMPTY_SESSION
    setSession(nextSession)

    const verified = Boolean(nextSession?.user?.verified)
    return {
      success: true,
      verified,
      message: verified
        ? 'Email verified. Unlocking your workspace...'
        : 'Email is still unverified. Complete verification, then refresh again.'
    }
  }

  const renderBody = () => {
    if (booting) {
      return (
        <section className="boot-splash">
          <img alt="Vox" className="boot-splash-logo" src={voxLogo} />
          <span aria-hidden="true" className="boot-splash-ring" />
        </section>
      )
    }

    if (!session.authenticated) {
      return <AuthView bootError={bootError} onLoginSuccess={handleLoginSuccess} />
    }

    if (session.user && !session.user.verified) {
      return (
        <VerificationRequiredView
          onLogout={handleLogout}
          onRefreshVerification={handleRefreshVerification}
          onRequestVerification={handleRequestVerification}
          session={session}
        />
      )
    }

    return <AuthenticatedApp session={session} onLogout={handleLogout} />
  }

  return (
    <>
      {IS_MAC_OS ? <div className="window-drag-region" /> : null}
      {renderBody()}
    </>
  )
}

export default App
