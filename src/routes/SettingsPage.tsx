import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'
import { useDriving } from '../store/driving'
import { applyLocale, t, type Locale } from '../lib/i18n'
import { setDeviceId } from '../lib/deviceId'
import { canInstall, onInstallChange, promptInstall } from '../lib/pwaInstall'
import { APP_VERSION } from '../config'
import './SettingsPage.css'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { locale, userId, username, userLabel, avatar, setLocale } = useSession()
  const gameName = useDriving((s) => s.config?.game_name ?? null)

  const [installable, setInstallable] = useState(canInstall())
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), [])

  function pickLocale(l: Locale) {
    if (l === locale) return
    setLocale(l)
    applyLocale(l)
  }

  return (
    <div className="page page-body settings-page">
      <h1>{t('settingsTitle', locale)}</h1>

      {/* Profile */}
      <section className="set-section">
        <h2 className="set-h">{t('profile', locale)}</h2>
        <div className="set-profile">
          <span className="set-avatar">{avatar ? <img src={avatar} alt="" /> : '🚐'}</span>
          <div>
            <div className="set-name">{username || t('guest', locale)}</div>
            {userLabel && <div className="set-sub">{userLabel}</div>}
          </div>
        </div>
      </section>

      {/* Language */}
      <section className="set-section">
        <h2 className="set-h">{t('language', locale)}</h2>
        <div className="set-langs">
          <button
            className={`set-pill ${locale === 'he' ? 'set-pill-on' : ''}`}
            onClick={() => pickLocale('he')}
          >
            {t('hebrew', locale)}
          </button>
          <button
            className={`set-pill ${locale === 'en' ? 'set-pill-on' : ''}`}
            onClick={() => pickLocale('en')}
          >
            {t('english', locale)}
          </button>
        </div>
      </section>

      {/* Game */}
      <section className="set-section">
        <h2 className="set-h">{t('currentGame', locale)}</h2>
        <button className="set-row" onClick={() => navigate('/games')}>
          <span>{gameName || '—'}</span>
          <span className="set-row-act">{t('changeGame', locale)} ›</span>
        </button>
      </section>

      {/* Leaderboard — premium webview is offline; deferred. */}
      <section className="set-section">
        <h2 className="set-h">{t('leaderboard', locale)}</h2>
        <div className="set-row set-row-disabled">
          <span>{t('leaderboard', locale)}</span>
          <span className="set-row-soon">{t('leaderboardSoon', locale)}</span>
        </div>
      </section>

      {/* Install (PWA) — only when the browser offers it */}
      {installable && (
        <section className="set-section">
          <button className="set-pill set-pill-on" onClick={() => promptInstall()}>
            {t('installApp', locale)}
          </button>
        </section>
      )}

      {/* Identity */}
      <section className="set-section">
        <h2 className="set-h">{t('identity', locale)}</h2>
        <div className="set-id">{userId}</div>
        <button className="set-reset" onClick={() => setDeviceId(null)}>
          {t('resetIdentity', locale)}
        </button>
      </section>

      <p className="set-version">
        {t('appVersion', locale)} {APP_VERSION}
      </p>
    </div>
  )
}
