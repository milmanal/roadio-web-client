import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMoods, registerUser } from '../api/endpoints'
import { useSession } from '../store/session'
import { useDriving } from '../store/driving'
import { t } from '../lib/i18n'
import type { Mood } from '../types'
import './RegistrationPage.css'

export default function RegistrationPage() {
  const navigate = useNavigate()
  const { userId, locale, setHud } = useSession()
  const setConfig = useDriving((s) => s.setConfig)

  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [moodId, setMoodId] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [moods, setMoods] = useState<Mood[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    getMoods().then(setMoods).catch(() => {})
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !nickname.trim()) return
    setBusy(true)
    setError(false)
    try {
      const cfg = await registerUser({
        userId,
        email: email.trim(),
        nickname: nickname.trim(),
        // Keep true: the backend reads join_contest as "keep my current game
        // active". With false it deactivates the user's game, so a Babel
        // player registering from the map would be dropped out of the quest.
        // For a plain trivia user it changes nothing.
        join_contest: true,
        town_id: null,
        mood_id: moodId || null,
        game_code: gameCode.trim(),
      })
      setConfig(cfg)
      setHud({
        username: cfg.username ?? nickname.trim(),
        userLabel: cfg.user_label ?? '',
        avatar: cfg.profile_image ?? null,
      })
      navigate('/profile')
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page-body reg-page">
      <h1 className="reg-title">{t('registerTitle', locale)}</h1>
      {error && <div className="conn conn-error">{t('registerError', locale)}</div>}

      <form className="reg-form" onSubmit={onSubmit}>
        <input
          className="reg-input"
          type="email"
          placeholder={t('emailLabel', locale)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="reg-input"
          placeholder={t('nicknameLabel', locale)}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
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
          {busy ? t('sending', locale) : t('registerSubmit', locale)}
        </button>
      </form>
    </div>
  )
}
