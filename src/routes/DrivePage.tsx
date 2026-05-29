import { useSession } from '../store/session'
import { useDriving } from '../store/driving'
import { useGeolocation } from '../features/driving/useGeolocation'
import { useDrivingLoop } from '../features/driving/useDrivingLoop'
import GameCard from '../features/games/GameCard'
import { t } from '../lib/i18n'
import './DrivePage.css'

export default function DrivePage() {
  const { locale, score, rank, nextItemKm, username } = useSession()
  const {
    active,
    position,
    items,
    queue,
    setActive,
    setPosition,
    reset,
  } = useDriving()

  const triggerItems = useDriving((s) => s.triggerItems)
  const { error } = useGeolocation(active)
  useDrivingLoop(active)

  function toggle() {
    if (active) {
      reset()
    } else {
      setActive(true)
    }
  }

  // Dev helper: drop into Tel Aviv so the loop runs without actually moving.
  function simulateTelAviv() {
    setPosition({ lat: 32.0853, lng: 34.7818, ts: Date.now() })
  }

  return (
    <div className="page">
      <header className="hud">
        <div className="hud-item">
          <span className="hud-label">{t('score', locale)}</span>
          <span className="hud-value">{score}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">{t('rank', locale)}</span>
          <span className="hud-value">{rank}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">{t('nextItem', locale)}</span>
          <span className="hud-value">{nextItemKm}</span>
        </div>
      </header>

      <section className="page-body drive-body">
        <button className={active ? 'btn-stop' : ''} onClick={toggle}>
          {active ? 'Stop' : t('start', locale)}
        </button>

        {error && (
          <div className="conn conn-error">
            Geolocation: {error.message} (code {error.code})
          </div>
        )}

        <div className="drive-stats muted small">
          <div>user: {username || '—'}</div>
          <div>
            position:{' '}
            {position
              ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
              : '—'}
          </div>
          <div>
            road points: {items.length} · queued cards: {queue.length}
          </div>
        </div>

        {active && (
          <button className="btn-ghost" onClick={simulateTelAviv}>
            ▶ Simulate Tel Aviv position (dev)
          </button>
        )}

        {import.meta.env.DEV && (
          <button
            className="btn-ghost"
            onClick={async () => {
              const { SAMPLE_ITEMS } = await import('../features/games/sampleItems')
              triggerItems(SAMPLE_ITEMS)
            }}
          >
            🃏 Load sample cards (dev)
          </button>
        )}
      </section>

      <GameCard />
    </div>
  )
}
