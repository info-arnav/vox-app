import LeftRail from './LeftRail'
import ToastLayer from './ToastLayer'

function AppShell({ activeRoute, children, onLogout, onRouteChange, user }) {
  return (
    <section className="workspace-shell">
      <div className="workspace-layout">
        <LeftRail
          activeRoute={activeRoute}
          onLogout={onLogout}
          onRouteChange={onRouteChange}
          user={user}
        />

        <main className="workspace-main">
          <div className="workspace-page">{children}</div>
        </main>
      </div>
      <ToastLayer />
    </section>
  )
}

export default AppShell
