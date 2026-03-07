import { useCallback, useState } from 'react'
import ChatPage from '../features/chat/pages/ChatPage'
import { ChatRuntimeProvider } from '../features/chat/state/ChatRuntimeProvider'
import { useBillingActions } from '../features/billing/hooks/useBillingActions'
import { useFoldersStore } from '../features/knowledge/hooks/useFoldersStore'
import { useIndexingController } from '../features/knowledge/hooks/useIndexingController'
import KnowledgePage from '../features/knowledge/pages/KnowledgePage'
import ActivityPage from '../features/activity/pages/ActivityPage'
import SettingsPage from '../features/settings/pages/SettingsPage'
import { useProfileActions } from '../features/settings/hooks/useProfileActions'
import WorkspaceSkeleton from '../components/workspace/WorkspaceSkeleton'
import { useWorkspaceBootstrap } from './hooks/useWorkspaceBootstrap'
import { APP_ROUTES } from './route-config'
import AppShell from '../shared/shell/AppShell'
import { useSessionRecovery } from '../shared/hooks/useSessionRecovery'

function AuthenticatedApp({ onLogout, session }) {
  const [activeRoute, setActiveRoute] = useState(APP_ROUTES.CHAT)
  const [focusedTaskId, setFocusedTaskId] = useState(null)

  const navigateToTask = useCallback((taskId) => {
    setFocusedTaskId(taskId || null)
    setActiveRoute(APP_ROUTES.ACTIVITY)
  }, [])

  const handleRouteChange = useCallback((route) => {
    if (route !== APP_ROUTES.ACTIVITY) setFocusedTaskId(null)
    setActiveRoute(route)
  }, [])

  const syncSessionExpiry = useSessionRecovery(onLogout)

  const {
    bootingWorkspace,
    workspaceError,
    user,
    models,
    loadWorkspace,
    refreshWorkspace,
    updateUser
  } = useWorkspaceBootstrap({
    sessionUser: session.user,
    syncSessionExpiry
  })

  const { folders, foldersInitialized, removeFolder, pickAndAddFolder } = useFoldersStore({
    syncSessionExpiry
  })

  const { indexingPaused, indexingStatus, pauseIndexing, resumeIndexing, getIndexedChildren } =
    useIndexingController({
      bootingWorkspace,
      folders,
      foldersInitialized,
      syncSessionExpiry
    })

  const { refreshCredits, startCheckout } = useBillingActions({
    refreshWorkspace,
    syncSessionExpiry
  })

  const { saveProfile } = useProfileActions({
    currentUser: user || session.user,
    onUserUpdated: updateUser,
    syncSessionExpiry
  })

  if (bootingWorkspace) {
    return <WorkspaceSkeleton />
  }

  if (workspaceError) {
    return (
      <section className="screen-shell workspace-status-shell">
        <article className="status-card">
          <p className="status-badge status-badge-pending">Workspace unavailable</p>
          <h1>Could not load workspace</h1>
          <p className="status-copy">{workspaceError}</p>
          <button className="secondary-button" onClick={loadWorkspace} type="button">
            Retry
          </button>
          <button
            className="secondary-button secondary-button-danger"
            onClick={onLogout}
            type="button"
          >
            Log out
          </button>
        </article>
      </section>
    )
  }

  const activeUser = user || session.user

  const renderActivePage = () => {
    if (activeRoute === APP_ROUTES.KNOWLEDGE) {
      return (
        <KnowledgePage
          folders={folders}
          indexingPaused={indexingPaused}
          indexingStatus={indexingStatus}
          onGetIndexedChildren={getIndexedChildren}
          onPauseIndexing={pauseIndexing}
          onPickAndAddFolder={pickAndAddFolder}
          onRemoveFolder={removeFolder}
          onResumeIndexing={resumeIndexing}
        />
      )
    }

    if (activeRoute === APP_ROUTES.ACTIVITY) {
      return (
        <ActivityPage focusedTaskId={focusedTaskId} onClearFocus={() => setFocusedTaskId(null)} />
      )
    }

    if (activeRoute === APP_ROUTES.SETTINGS) {
      return (
        <SettingsPage
          creditsBalance={activeUser?.creditsBalance}
          models={models}
          onRefreshCredits={refreshCredits}
          onSaveProfile={saveProfile}
          onStartCheckout={startCheckout}
          user={activeUser}
        />
      )
    }

    return <ChatPage onNavigateToTask={navigateToTask} user={activeUser} />
  }

  return (
    <ChatRuntimeProvider key={activeUser?.id || ''} chatUserId={activeUser?.id || ''}>
      <AppShell
        activeRoute={activeRoute}
        onLogout={onLogout}
        onRouteChange={handleRouteChange}
        user={activeUser}
      >
        {renderActivePage()}
      </AppShell>
    </ChatRuntimeProvider>
  )
}

export default AuthenticatedApp
