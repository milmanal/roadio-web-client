import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../store/session'
import { t } from '../lib/i18n'
import './AppShell.css'

export default function AppShell() {
  const locale = useSession((s) => s.locale)
  const { pathname } = useLocation()
  // The map screen is full-screen (own top HUD + corner pills) — no tab bar.
  const showNav = pathname !== '/drive'
  const tabs = [
    { to: '/drive', label: t('drive', locale), icon: '🗺️' },
    { to: '/daily', label: t('daily', locale), icon: '🧩' },
    { to: '/babylon', label: t('babylon', locale), icon: '🏛️' },
  ]
  return (
    <div className="shell">
      <main className="shell-main">
        <Outlet />
      </main>
      {showNav && (
      <nav className="shell-nav">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? 'tab tab-active' : 'tab')}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      )}
    </div>
  )
}
