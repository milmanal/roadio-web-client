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

// "מכונת בבל" — a premium road-quest. Activated via registration (NOT the old
// lead/download form, which served the dead native app): trigger the babel reg
// flow (quiz reg_496_dana), then POST /v2/register with game_id 496 +
// nickname/phone/destination. The quest then streams road points as you drive.
export default function BabylonPage() {
  const navigate = useNavigate()
  const { userId, locale, setHud } = useSession()
  const setConfig = useDriving((s) => s.setConfig)

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

  useEffect(() => {
    getTowns().then(setTowns).catch(() => {})
    getMoods().then(setMoods).catch(() => {})
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !nickname.trim()) return
    setBusy(true)
    setError(false)
    try {
      // 1) trigger the babel registration flow, 2) register with game_id 496.
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
      // Babel is a driving quest — head to the map; road points unlock en route.
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
        {/* destination = "לאן נוסעים?" — originally a Places autocomplete; a
            native picker (Mapbox geocoding) is a follow-up. Free text for now. */}
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
          <button
            type="button"
            className={`reg-toggle-btn ${contest ? 'reg-toggle-on' : ''}`}
            onClick={() => setContest(true)}
          >
            {t('yes', locale)}
          </button>
          <button
            type="button"
            className={`reg-toggle-btn ${!contest ? 'reg-toggle-on' : ''}`}
            onClick={() => setContest(false)}
          >
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
