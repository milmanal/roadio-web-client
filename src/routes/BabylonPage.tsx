import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMoods, getTowns, registerUser } from '../api/endpoints'
import { selectGame } from '../features/games/selectGame'
import { useSession } from '../store/session'
import { useDriving } from '../store/driving'
import { t } from '../lib/i18n'
import TownAutocomplete from '../components/TownAutocomplete'
import type { Mood, Town } from '../types'
import './RegistrationPage.css'

const BABEL_GAME_ID = 496
const BABEL_QUIZ = 'reg_496_dana'

export default function BabylonPage() {
  const navigate = useNavigate()
  const { userId, locale, setHud } = useSession()
  const setConfig = useDriving((s) => s.setConfig)

  // 'selection' = show iframe; 'register' = show Babylon reg form
  const [view, setView] = useState<'selection' | 'register'>('selection')

  // registration form state
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [destination, setDestination] = useState('')
  const [email, setEmail] = useState('')
  const [contest, setContest] = useState(true)
  const [townId, setTownId] = useState('')
  const [moodId, setMoodId] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [towns, setTowns] = useState<Town[]>([])
  const [moods, setMoods] = useState<Mood[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  // Load towns/moods in background so they're ready when user reaches reg form
  useEffect(() => {
    getTowns().then(setTowns).catch(() => {})
    getMoods().then(setMoods).catch(() => {})
  }, [])

  // Listen for game selection from the iframe
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'roadio:select') return
      const quiz: string = e.data.quiz
      if (!quiz || busy) return

      if (quiz === BABEL_QUIZ) {
        // Babylon requires registration before driving
        setView('register')
      } else {
        // Other games (trivia, britania, etc.) — select and drive
        setBusy(true)
        try {
          await selectGame(quiz)
          navigate('/drive')
        } finally {
          setBusy(false)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [busy, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !nickname.trim()) return
    setBusy(true)
    setError(false)
    try {
      await selectGame(BABEL_QUIZ)
      const cfg = await registerUser({
        userId,
        game_id: BABEL_GAME_ID,
        nickname: nickname.trim(),
        phone_number: phone.trim(),
        destination: destination.trim(),
        email: email.trim(),
        join_contest: contest,
        town_id: townId || null,
        mood_id: moodId || null,
        game_code: gameCode.trim(),
      })
      setConfig(cfg)
      setHud({
        username: cfg.username ?? nickname.trim(),
        userLabel: cfg.user_label ?? '',
        avatar: cfg.profile_image ?? null,
        gameName: cfg.game_name ?? null,
      })
      navigate('/drive')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  if (view === 'selection') {
    const src = `/api/game_selection_2?user_id=${encodeURIComponent(userId)}`
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {busy && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 18,
          }}>
            טוען...
          </div>
        )}
        <iframe
          src={src}
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="בחירת משחק"
        />
      </div>
    )
  }

  // Registration form (Babylon only)
  return (
    <div className="page page-body reg-page">
      <h1 className="reg-title">{t('babylonTitle', locale)}</h1>
      <p className="reg-intro">{t('babylonIntro', locale)}</p>
      {error && <div className="conn conn-error">{t('registerError', locale)}</div>}

      <form className="reg-form" onSubmit={onSubmit}>
        <input
          className="reg-input"
          placeholder={t('nicknameLabel', locale)}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
        <input
          className="reg-input"
          type="tel"
          placeholder={t('phonePlaceholder', locale)}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <input
          className="reg-input"
          placeholder={t('destinationLabel', locale)}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <input
          className="reg-input"
          type="email"
          placeholder={t('emailLabel', locale)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="reg-field-lbl">{t('joinContest', locale)}</div>
        <div className="reg-toggle">
          <button type="button" className={`reg-toggle-btn ${contest ? 'reg-toggle-on' : ''}`} onClick={() => setContest(true)}>
            {t('yes', locale)}
          </button>
          <button type="button" className={`reg-toggle-btn ${!contest ? 'reg-toggle-on' : ''}`} onClick={() => setContest(false)}>
            {t('no', locale)}
          </button>
        </div>

        <TownAutocomplete
          towns={towns}
          value={townId}
          onChange={setTownId}
          placeholder={t('townLabel', locale)}
          inputClassName="reg-input"
        />

        <div className="reg-field-lbl">{t('moodLabel', locale)}</div>
        <div className="reg-moods">
          {moods.map((m) => (
            <button
              type="button"
              key={m.mood_id}
              className={`reg-mood ${moodId === m.mood_id ? 'reg-mood-on' : ''}`}
              onClick={() => setMoodId(m.mood_id)}
              title={m.label}
            >
              <img src={m.icon_url} alt="" />
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <input
          className="reg-input"
          placeholder={t('gameCodeLabel', locale)}
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value)}
        />

        <button className="reg-submit" type="submit" disabled={busy || !nickname.trim()}>
          {busy ? t('sending', locale) : t('babylonStart', locale)}
        </button>
      </form>
    </div>
  )
}
