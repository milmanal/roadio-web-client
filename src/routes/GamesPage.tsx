import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../store/session'
import { useDriving } from '../store/driving'
import { selectGame } from '../features/games/selectGame'
import { t } from '../lib/i18n'
import './GamesPage.css'

const ART = 'https://raw.githubusercontent.com/moscovig/roadio_static/master/images/roadio_v2'

interface GameDef {
  id: string
  nameKey: string
  descKey: string
  img: string
  /** 'select' activates a game (quiz token) then goes to the map; 'route' just navigates. */
  kind: 'select' | 'route'
  quiz?: string
  route?: string
}

// Mirrors the official game-selection page (game_selection_2). The road game
// (quiz="roadio") is the one that unlocks map markers / driving.
const GAMES: GameDef[] = [
  { id: 'roadio', nameKey: 'gameRoadioName', descKey: 'gameRoadioDesc', img: `${ART}/roadio_on_the_way.jpg`, kind: 'select', quiz: 'roadio' },
  { id: 'daily', nameKey: 'gameDailyName', descKey: 'gameDailyDesc', img: `${ART}/game-2.png`, kind: 'route', route: '/daily' },
  { id: 'babel', nameKey: 'gameBabelName', descKey: 'gameBabelDesc', img: `${ART}/game.png`, kind: 'route', route: '/babylon' },
  { id: 'britania', nameKey: 'gameBritaniaName', descKey: 'gameBritaniaDesc', img: `${ART}/britania_b.png`, kind: 'select', quiz: 'reg_530_1' },
]

export default function GamesPage() {
  const navigate = useNavigate()
  const locale = useSession((s) => s.locale)
  const activeGameName = useDriving((s) => s.config?.game_name ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function onPick(g: GameDef) {
    if (busy) return
    setError(false)
    if (g.kind === 'route' && g.route) {
      navigate(g.route)
      return
    }
    if (g.kind === 'select' && g.quiz) {
      setBusy(g.id)
      try {
        await selectGame(g.quiz)
        navigate('/drive')
      } catch {
        setError(true)
      } finally {
        setBusy(null)
      }
    }
  }

  return (
    <div className="page page-body games-page">
      <h1>{t('gamesTitle', locale)}</h1>
      {error && <div className="conn conn-error">{t('gameSelectError', locale)}</div>}
      <ul className="games-list">
        {GAMES.map((g) => {
          const name = t(g.nameKey, locale)
          const isActive = g.kind === 'select' && activeGameName === name
          return (
            <li key={g.id} className="game-card">
              <img className="game-art" src={g.img} alt="" />
              <div className="game-info">
                <h2 className="game-name">{name}</h2>
                <p className="game-desc">{t(g.descKey, locale)}</p>
                <button
                  className={`game-btn ${isActive ? 'game-btn-on' : ''}`}
                  onClick={() => onPick(g)}
                  disabled={busy != null}
                >
                  {busy === g.id
                    ? t('gameSelecting', locale)
                    : isActive
                      ? t('gameSelected', locale)
                      : t('gamePlay', locale)}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
