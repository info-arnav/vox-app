import { BookOpen, MessageSquare, Settings, Zap } from 'lucide-react'
import { APP_ROUTES } from '../../app/route-config'
import UserMenu from './UserMenu'

const PRIMARY_TABS = [
  { key: APP_ROUTES.CHAT, label: 'Chat', icon: MessageSquare },
  { key: APP_ROUTES.ACTIVITY, label: 'Activity', icon: Zap },
  { key: APP_ROUTES.KNOWLEDGE, label: 'Knowledge', icon: BookOpen },
  { key: APP_ROUTES.SETTINGS, label: 'Settings', icon: Settings }
]

function LeftRail({ activeRoute, onLogout, onRouteChange, user }) {
  return (
    <aside className="workspace-sidebar">
      <p className="workspace-wordmark">Vox</p>

      <nav aria-label="Primary" className="workspace-nav">
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              className={`workspace-nav-item${activeRoute === tab.key ? ' workspace-nav-item-active' : ''}`}
              key={tab.key}
              onClick={() => onRouteChange(tab.key)}
              type="button"
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="workspace-sidebar-spacer" />

      <hr className="workspace-nav-divider" />
      <UserMenu onLogout={onLogout} user={user} />
    </aside>
  )
}

export default LeftRail
