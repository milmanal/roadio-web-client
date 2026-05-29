import { useEffect, useState } from 'react'
import { getUserQuizzes } from '../api/endpoints'
import { useSession } from '../store/session'
import { playQuiz } from '../features/quiz/playQuiz'
import GameCard from '../features/games/GameCard'
import { t } from '../lib/i18n'
import type { UserQuiz } from '../types'
import './DailyPage.css'

type LoadState = 'loading' | 'ready' | 'error'

export default function DailyPage() {
  const { userId, locale } = useSession()
  const [state, setState] = useState<LoadState>('loading')
  const [quizzes, setQuizzes] = useState<UserQuiz[]>([])
  const [playing, setPlaying] = useState<string | number | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    let cancelled = false
    getUserQuizzes({ userId, locale })
      .then((res) => {
        if (cancelled) return
        const list = Object.values(res.user_quizzes ?? {})
        setQuizzes(list)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [userId, locale])

  async function onPlay(quiz: UserQuiz) {
    if (playing != null) return
    setPlaying(quiz.quiz_id)
    setEmpty(false)
    try {
      const triggered = await playQuiz({
        quizId: quiz.quiz_id,
        quizName: quiz.quiz_name,
      })
      if (triggered === 0) setEmpty(true)
    } catch {
      setEmpty(true)
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="page page-body">
      <h1>{t('daily', locale)}</h1>

      {state === 'loading' && <p className="muted">{t('loading', locale)}</p>}

      {state === 'error' && (
        <div className="conn conn-error">{t('quizError', locale)}</div>
      )}

      {state === 'ready' && quizzes.length === 0 && (
        <p className="muted">{t('noQuizzes', locale)}</p>
      )}

      {state === 'ready' && quizzes.length > 0 && (
        <ul className="quiz-list">
          {quizzes.map((quiz) => (
            <li key={String(quiz.quiz_id)}>
              <button
                className="quiz-item"
                onClick={() => onPlay(quiz)}
                disabled={playing != null}
              >
                <span className="quiz-name">{quiz.quiz_name}</span>
                {playing === quiz.quiz_id && (
                  <span className="quiz-spinner muted small">
                    {t('loading', locale)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {empty && <p className="muted small">{t('noQuizItems', locale)}</p>}

      <GameCard />
    </div>
  )
}
