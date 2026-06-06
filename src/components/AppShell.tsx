import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../store/session'
import { t } from '../lib/i18n'
import { canInstall, onInstallChange, promptInstall } from '../lib/pwaInstall'
import './AppShell.css'

const DISMISS_KEY = 'roadio.install_dismissed'

export default function AppShell() {
  const locale = useSession((s) => s.locale)
  const { pathname } = useLocation()
  const [installable, setInstallable] = useState(canInstall)
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY))
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), [])
  const showBanner = installable && !dismissed
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
      {showBanner && (
        <div className="install-banner">
          <span className="install-banner-txt">📱 {t('installApp', locale)}</span>
          <button className="install-banner-btn" onClick={() => promptInstall()}>
            {t('installApp', locale)}
          </button>
          <button
            className="install-banner-close"
            onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true) }}
          >
            ✕
          </button>
        </div>
      )}
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
