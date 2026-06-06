import { useEffect, useRef, useState } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import { isCorrect, isScored, normalize } from '../answer'
import { MediaBlock } from '../MediaBlock'
import { t } from '../../../lib/i18n'
import { Sounds } from '../../../lib/sounds'
import type { RoadPoint } from '../../../types'

const CORRECT_FRAMES = [
  '/reactions/correct_car_1.png',
  '/reactions/correct_car_2.png',
  '/reactions/correct_car_3.png',
  '/reactions/correct_car_4.png',
]
const WRONG_FRAME = '/reactions/wrong_car.png'

type Phase = 'asking' | 'reacting' | 'revealed' | 'summary'

function fmtTime(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Full-screen themed trivia flow: signpost answer buttons, multiple attempts
 * (points_first_correct vs points_second_correct), correct/wrong reaction
 * animation + "on fire!" banner, then a story reveal with a thumbs up/down
 * vote. Owns its own answer/vote/advance reporting. Labels are English.
 */
export default function TriviaCard({ point }: { point: RoadPoint }) {
  const dismiss = useDriving((s) => s.dismissActive)
  const queueLen = useDriving((s) => s.queue.length)
  const items = useDriving((s) => s.items)
  const results = useDriving((s) => s.results)
  const setResult = useDriving((s) => s.setResult)
  const position = useDriving((s) => s.position)
  const userId = useSession((s) => s.userId)
  const locale = useSession((s) => s.locale)
  const setHud = useSession((s) => s.setHud)
  const score = useSession((s) => s.score)
  const rank = useSession((s) => s.rank)

  const scored = isScored(point)
  const rightAnswer = point.right_answer?.trim() ?? null
  const choices = (point.answers ?? []).filter(Boolean)
  const maxAttempts = point.points_second_correct != null ? 2 : 1
  // No-choice quiz items (html/story/info) are reveal-only: skip straight to
  // the themed story/answer reveal — no guessing, no reaction.
  const revealOnly = choices.length === 0
  // A single-choice item is an intro/outro CTA (e.g. "ready?" / "see you!") —
  // no reaction, no story reveal, just acknowledge and advance.
  const isIntro = choices.length === 1
  const isQuiz = point.quiz_name != null || point.is_quiz === true
  const isLastQuizCard = isQuiz && queueLen === 0

  const [phase, setPhase] = useState<Phase>(revealOnly ? 'revealed' : 'asking')
  const [eliminated, setEliminated] = useState<string[]>([])
  const [attempts, setAttempts] = useState(0)
  const [reaction, setReaction] = useState<'correct' | 'wrong'>('correct')
  const [frame, setFrame] = useState(0)
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)

  const latlng = {
    lat: position ? String(position.lat) : null,
    lng: position ? String(position.lng) : null,
  }

  // Count up elapsed time, or count down from `countdown` when the item sets one.
  const hasCountdown = (point.countdown ?? 0) > 0
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const timeLabel = hasCountdown
    ? fmtTime((point.countdown ?? 0) - elapsed)
    : fmtTime(elapsed)

  // Cycle the correct-reaction frames while reacting; wrong is a single frame.
  useEffect(() => {
    if (phase !== 'reacting' || reaction !== 'correct') return
    const id = setInterval(() => setFrame((f) => (f + 1) % CORRECT_FRAMES.length), 220)
    return () => clearInterval(id)
  }, [phase, reaction])

  // After a reaction plays, either reveal the story (resolved) or return to the
  // question for another attempt.
  const retryRef = useRef(false)
  useEffect(() => {
    if (phase !== 'reacting') return
    const id = setTimeout(() => {
      if (retryRef.current) {
        retryRef.current = false
        setPhase('asking')
      } else {
        setPhase('revealed')
      }
    }, 1700)
    return () => clearTimeout(id)
  }, [phase])

  // Reports run in the background — the UI (reaction, reveal, advance) must not
  // wait on the network. HUD updates from the response when it lands.
  function report(event: { answer?: string; vote?: string }) {
    reportEvents({
      user_id: userId,
      ...latlng,
      events: { [String(point.id)]: event },
    })
      .then((res) => {
        if (typeof res.score === 'number') {
          setHud({ score: String(res.score), rank: String(res.rank) })
        }
      })
      .catch(() => {
        // advancing/scoring locally regardless of report failure
      })
  }

  function advance() {
    const queueEmpty = useDriving.getState().queue.length === 0
    if (isQuiz && queueEmpty && phase !== 'summary') {
      setPhase('summary')
      return
    }
    dismiss()
  }

  function onPick(choice: string) {
    if (phase !== 'asking') return
    const right = scored ? isCorrect(point, choice) : true
    report({ answer: choice })
    // Intro/outro CTA: acknowledge and move on, no reaction/story.
    if (isIntro) {
      report({ answer: NEXT_EVENT })
      advance()
      return
    }
    if (right) {
      Sounds.correct()
      setResult(point.id, true)
      setReaction('correct')
      setFrame(0)
      setPhase('reacting')
    } else {
      Sounds.wrong()
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      setEliminated((e) => [...e, choice])
      setReaction('wrong')
      if (nextAttempts < maxAttempts) retryRef.current = true
      else setResult(point.id, false)
      setPhase('reacting')
    }
  }

  function onVote(v: 'up' | 'down') {
    if (voted) return
    setVoted(v)
    report({ vote: v })
  }

  function onContinue() {
    Sounds.next()
    report({ answer: NEXT_EVENT })
    advance()
  }

  // No scoring info (rare types routed here defensively): just show + advance.
  const themeClass = `trivia trivia-theme-${point.marker_family || 'default'}`
  // Progress: a fixed segment per quiz item (stable across the whole quiz),
  // filling as we advance. Falls back to queue length for a lone proximity item.
  const idx = items.findIndex((it) => it.id === point.id)
  const totalSegments = items.length > 0 ? items.length : Math.max(1, queueLen + 1)
  const currentIndex = idx >= 0 ? idx : 0
  const onFire = phase === 'reacting' && reaction === 'correct'

  // Place: for quiz items the backend ships an anonymous score distribution
  // (rank_stats); derive the player's place from it (1 + players who scored
  // higher) like the Android app. Otherwise fall back to the HUD rank.
  const stats = point.rank_stats
  let placeLabel = rank
  if (stats && stats.length > 0) {
    const myScore = Math.max(0, Number(score) || 0)
    placeLabel = String(
      1 + stats.filter((s) => s.score > myScore).reduce((n, s) => n + s.count, 0),
    )
  }

  return (
    <div className="trivia-overlay">
      <div className={themeClass}>
        <div className="trivia-body">
          {point.quiz_name && <h1 className="trivia-title">• {point.quiz_name} •</h1>}
          {phase !== 'summary' && (
            <>
              {point.question && <h2 className="trivia-q">{point.question}</h2>}
              <MediaBlock
                images={point.question_images}
                voice={point.question_voice}
              />
            </>
          )}

          {/* Reaction layer */}
          {phase === 'reacting' && (
            <div className="trivia-reaction">
              {onFire && (
                <div className="fire-banner">
                  <span className="fire-911">911</span>
                  <span className="fire-text">This player is on fire!</span>
                </div>
              )}
              <img
                className="reaction-car"
                src={reaction === 'correct' ? CORRECT_FRAMES[frame] : WRONG_FRAME}
                alt=""
              />
            </div>
          )}

          {/* Answers */}
          {phase !== 'reacting' && phase !== 'summary' && choices.length > 0 && (
            <div className="signposts">
              {choices.map((choice) => {
                const isGone =
                  phase === 'asking' && eliminated.includes(choice)
                if (isGone) return null
                const isRight =
                  rightAnswer != null &&
                  normalize(choice) === normalize(rightAnswer)
                // On reveal, collapse to just the correct answer (keeps the
                // post-answer screen short — no scrolling past dead options).
                if (phase === 'revealed' && !isRight) return null
                const cls = [
                  'signpost',
                  phase === 'revealed' && isRight ? 'signpost-right' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={choice}
                    className={cls}
                    disabled={phase === 'revealed'}
                    onClick={() => onPick(choice)}
                  >
                    {choice}
                  </button>
                )
              })}
            </div>
          )}

          {/* Story reveal + vote */}
          {phase === 'revealed' && (
            <div className="trivia-reveal">
              {/* Reveal-only info cards have no signposts — surface the answer. */}
              {revealOnly && rightAnswer && (
                <div className="signpost signpost-right reveal-answer">{rightAnswer}</div>
              )}
              {point.story && <p className="reveal-story">{point.story}</p>}
              <MediaBlock images={point.story_images} voice={point.story_voices?.[0]} />
              {/* Single row: [הבא] right · [?אהבנו 👍 👎] left */}
              <div className="reveal-actions">
                <button className="next-btn" onClick={onContinue}>
                  {isLastQuizCard ? t('finishQuiz', locale) : t('nextCard', locale)}
                </button>
                <div className="vote-group">
                  <span className="vote-q">{t('voteQuestion', locale)}</span>
                  <div className="vote-btns">
                    <button
                      className={`vote vote-up ${voted === 'up' ? 'vote-on' : ''}`}
                      onClick={() => onVote('up')}
                      aria-label="thumbs up"
                    >
                      👍
                    </button>
                    <button
                      className={`vote vote-down ${voted === 'down' ? 'vote-on' : ''}`}
                      onClick={() => onVote('down')}
                      aria-label="thumbs down"
                    >
                      👎
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* End-of-quiz summary */}
          {phase === 'summary' && (
            <div className="trivia-summary">
              <h2 className="summary-title">Quiz complete!</h2>
              <div className="summary-stats">
                <div className="foot-stat">
                  <div className="stat-val">{score}</div>
                  <div className="stat-label">Score</div>
                </div>
                <div className="place-badge">
                  <div className="place-val">{placeLabel}</div>
                  <div className="place-label">Place</div>
                </div>
              </div>
              <button className="next-btn" onClick={() => dismiss()}>
                FINISH
              </button>
            </div>
          )}
        </div>

        {/* Segmented progress — green=correct, red=wrong, grey=current/upcoming */}
        <div className="trivia-progress">
          {Array.from({ length: totalSegments }).map((_, i) => {
            const item = items[i]
            const res = item ? results[item.id] : undefined
            const answered = res !== undefined
            const cls = answered
              ? res
                ? 'seg-correct'
                : 'seg-wrong'
              : i === currentIndex
                ? 'seg-active'
                : ''
            return <span key={i} className={`seg ${cls}`} />
          })}
        </div>

        {/* Score / Place / Time */}
        <div className="trivia-footer">
          <div className="foot-stat">
            <div className="stat-val">{score}</div>
            <div className="stat-label">Score</div>
          </div>
          <div className="place-badge">
            <div className="place-val">{placeLabel}</div>
            <div className="place-label">Place</div>
          </div>
          <div className="foot-stat">
            <div className="stat-val">{timeLabel}</div>
            <div className="stat-label">Time</div>
          </div>
        </div>
      </div>
    </div>
  )
}
