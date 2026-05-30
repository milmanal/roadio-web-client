import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../api/endpoints'
import { useSession } from '../store/session'
import { t } from '../lib/i18n'
import type { LeaderboardRow, ProfileResponse } from '../types'
import './ProfilePage.css'

type State = 'loading' | 'ready' | 'error'

function Board({ title, rows }: { title: string; rows: LeaderboardRow[] }) {
  if (!rows || rows.length === 0) return null
  return (
    <section className="prof-board">
      <h2 className="prof-board-title">{title}</h2>
      <ul className="prof-rows">
        {rows.map((r) => (
          <li key={`${r.rank}-${r.name}`} className={`prof-row ${r.is_me ? 'prof-row-me' : ''}`}>
            <span className="prof-rank">{r.rank}</span>
            <span className="prof-name">{r.name}</span>
            <span className="prof-score">{r.score.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { userId, locale, avatar } = useSession()
  const [state, setState] = useState<State>('loading')
  const [data, setData] = useState<ProfileResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    getProfile({ userId, locale })
      .then((res) => !cancelled && (setData(res), setState('ready')))
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [userId, locale])

  const me = data?.me
  const name = me?.name?.trim() || t('guest', locale)

  return (
    <div className="page page-body profile-page">
      {/* Header: avatar + name + stats */}
      <header className="prof-header">
        <button className="prof-settings" onClick={() => navigate('/settings')} aria-label="settings">
          ⚙
        </button>
        <div className="prof-id">
          <span className="prof-avatar">
            {me?.avatar || avatar ? <img src={me?.avatar || avatar || ''} alt="" /> : '🚐'}
          </span>
          <div>
            <h1 className="prof-name-big">{name}</h1>
            {!me?.name?.trim() && (
              <button className="prof-register" onClick={() => navigate('/register')}>
                {t('registerTitle', locale)} ›
              </button>
            )}
          </div>
        </div>
      </header>

      {state === 'loading' && <p className="muted">{t('loading', locale)}</p>}
      {state === 'error' && <div className="conn conn-error">{t('quizError', locale)}</div>}

      {state === 'ready' && me && (
        <>
          <div className="prof-stats">
            <div className="prof-stat">
              <div className="prof-stat-val">{me.missions}</div>
              <div className="prof-stat-lbl">{t('missions', locale)}</div>
            </div>
            <div className="prof-stat">
              <div className="prof-stat-val">{me.questions}</div>
              <div className="prof-stat-lbl">{t('questions', locale)}</div>
            </div>
            <div className="prof-stat">
              <div className="prof-stat-val">
                {me.rank}
                {me.total_players ? <span className="prof-stat-of">/{me.total_players}</span> : null}
              </div>
              <div className="prof-stat-lbl">{t('placeRank', locale)}</div>
            </div>
          </div>

          <Board title={t('boardPlayers', locale)} rows={data!.classic} />
          <Board title={t('boardDaily', locale)} rows={data!.daily} />
          <Board title={t('boardTowns', locale)} rows={data!.towns} />

          {data!.classic.length === 0 && data!.daily.length === 0 && data!.towns.length === 0 && (
            <p className="muted small">{t('profileEmpty', locale)}</p>
          )}
        </>
      )}
    </div>
  )
}
