import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMoods, registerUser } from '../api/endpoints'
import { selectGame } from '../features/games/selectGame'
import { useSession } from '../store/session'
import { useDriving } from '../store/driving'
import { useMarkers } from '../store/markers'
import { t } from '../lib/i18n'
import type { Mood } from '../types'
import './RegistrationPage.css'

const BABEL_GAME_ID = 496
const BABEL_QUIZ = 'reg_496_dana'

export default function BabylonPage() {
  const navigate = useNavigate()
  const { userId, locale, setHud } = useSession()
  const setConfig = useDriving((s) => s.setConfig)

  // registration form state
  const [nickname, setNickname] = useState('')
  const [phone, setPhone] = useState('')
  const [destination, setDestination] = useState('')
  const [email, setEmail] = useState('')
  const [moodId, setMoodId] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [moods, setMoods] = useState<Mood[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  // Load moods in background so they're ready when user reaches reg form
  useEffect(() => {
    getMoods().then(setMoods).catch(() => {})
    // Download the map screen (incl. mapbox-gl, ~1.5 MB) while the user fills
    // the form, so the quest map opens at once after sign-up.
    void import('../features/map/MapScreen').catch(() => {})
  }, [])

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
        // Must be true: despite its name, the backend reads join_contest as
        // "activate this game" (users_logic.update_registration_details). With
        // false, org_game_active stays off, the user remains in road-trivia
        // mode, and nearby trivia pins keep firing instead of the Babel quest.
        join_contest: true,
        town_id: null,
        mood_id: moodId || null,
        game_code: gameCode.trim(),
      })
      setConfig(cfg)
      // The game just switched to Babel: drop the trivia pins and any queued
      // trivia cards so the proximity loop can't fire them before the map
      // refetches markers for the new game.
      useMarkers.getState().clear()
      useDriving.getState().clearCards()
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
