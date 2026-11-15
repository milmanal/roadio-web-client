import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import { isCorrect, isScored, normalize } from '../answer'
import { MediaBlock } from '../MediaBlock'
import { t } from '../../../lib/i18n'
import { Sounds } from '../../../lib/sounds'
import { isImageUrl, youTubeEmbed, youTubeId } from '../../../lib/media'
import type { RoadPoint } from '../../../types'

// Reaction storyboards. Each pose is held long enough to be read (the old
// version flipped all four poses every 220 ms in a loop and cut away after
// 1.7 s, which looked like fast-forward). The card only moves on when the
// last pose has finished.
const CORRECT_STEPS: { src: string; ms: number }[] = [
  { src: '/reactions/correct_car_1.png', ms: 700 },
  { src: '/reactions/correct_car_2.png', ms: 900 },
  { src: '/reactions/correct_car_3.png', ms: 700 },
  { src: '/reactions/correct_car_4.png', ms: 900 },
]
const WRONG_STEPS: { src: string; ms: number }[] = [
  { src: '/reactions/wrong_car.png', ms: 2600 },
]
// A tap may cut the reaction short, but never in the first moment (so the
// tap that picked the answer can't skip it by accident).
const SKIP_GUARD_MS = 900

// Preload every reaction pose once, so a pose never pops in half-decoded.
let preloaded = false
function preloadReactions() {
  if (preloaded) return
  preloaded = true
  for (const s of [...CORRECT_STEPS, ...WRONG_STEPS]) {
    const img = new Image()
    img.src = s.src
  }
}

type Phase = 'asking' | 'reacting' | 'revealed' | 'summary'

const HE_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח']
const EN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
// Fit levels: 0 = roomy … MAX_FIT = most compact. Picked at layout time as the
// first level at which the question + answers fit the screen without scrolling.
const MAX_FIT = 4

function fmtTime(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Full-screen trivia flow: question + answers (fitted to one screen), multiple
 * attempts (points_first_correct vs points_second_correct), a correct/wrong
 * reaction that plays to its end, then a story reveal with a thumbs up/down
 * vote. Owns its own answer/vote/advance reporting.
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
  // the story/answer reveal — no guessing, no reaction.
  const revealOnly = choices.length === 0
  // A single-choice item is an intro/outro CTA (e.g. "ready?" / "see you!") —
  // no reaction, no story reveal, just acknowledge and advance.
  const isIntro = choices.length === 1
  const isQuiz = point.quiz_name != null || point.is_quiz === true
  const isLastQuizCard = isQuiz && queueLen === 0
  // Short answers (numbers, single words) sit side by side in a grid.
  const compactChoices =
    choices.length >= 2 && choices.length <= 4 && choices.every((c) => c.trim().length <= 8)

  const [phase, setPhase] = useState<Phase>(revealOnly ? 'revealed' : 'asking')
  const [eliminated, setEliminated] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [reaction, setReaction] = useState<'correct' | 'wrong'>('correct')
  const [step, setStep] = useState(0)
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const [earned, setEarned] = useState<number | null>(null)

  useEffect(preloadReactions, [])

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

  // ---- Reaction timeline -------------------------------------------------
  // Walk the storyboard pose by pose; after the last pose either reveal the
  // story (resolved) or go back to the question for another attempt.
  const [retry, setRetry] = useState(false)
  const reactStartRef = useRef(0)
  const steps = reaction === 'correct' ? CORRECT_STEPS : WRONG_STEPS

  const finishReaction = useCallback(() => {
    setStep(0)
    if (retry) {
      setRetry(false)
      setPicked(null)
      setPhase('asking')
    } else {
      setPhase('revealed')
    }
  }, [retry])

  useEffect(() => {
    if (phase !== 'reacting') return
    const id = setTimeout(() => {
      if (step < steps.length - 1) setStep(step + 1)
      else finishReaction()
    }, steps[step].ms)
    return () => clearTimeout(id)
  }, [phase, step, steps, finishReaction])

  function onReactionTap(e: MouseEvent) {
    if (e.timeStamp - reactStartRef.current < SKIP_GUARD_MS) return
    finishReaction()
  }

  // ---- Fit question + answers to one screen ------------------------------
  // Try each density level from roomy to compact and keep the first one where
  // nothing overflows. Done imperatively in a layout effect so there is no
  // visible flash and no extra React renders.
  const fitRef = useRef<HTMLDivElement>(null)
  const refit = useCallback(() => {
    const el = fitRef.current
    if (!el) return
    // Measure layout boxes (offsetTop/offsetHeight), not scrollHeight: the
    // answers' entrance animation uses transforms, which would count as
    // overflow while it runs.
    const last = el.lastElementChild as HTMLElement | null
    for (let level = 0; level <= MAX_FIT; level++) {
      el.dataset.fit = String(level)
      const needed = last ? last.offsetTop + last.offsetHeight : 0
      if (needed <= el.clientHeight + 1) break
    }
  }, [])
  useLayoutEffect(() => {
    refit()
  }, [refit, phase, eliminated, point.id])
  useEffect(() => {
    const el = fitRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => refit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [refit])

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

  function startReaction(kind: 'correct' | 'wrong', at: number) {
    setReaction(kind)
    setStep(0)
    reactStartRef.current = at
    setPhase('reacting')
  }

  function onPick(choice: string, at: number) {
    if (phase !== 'asking') return
    const right = scored ? isCorrect(point, choice) : true
    report({ answer: choice })
    // Intro/outro CTA: acknowledge and move on, no reaction/story.
    if (isIntro) {
      report({ answer: NEXT_EVENT })
      advance()
      return
    }
    setPicked(choice)
    if (right) {
      Sounds.correct()
      setResult(point.id, true)
      const pts = attempts === 0 ? point.points_first_correct : point.points_second_correct
      setEarned(scored && pts ? pts : null)
      startReaction('correct', at)
    } else {
      Sounds.wrong()
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      setEliminated((e) => [...e, choice])
      if (nextAttempts < maxAttempts) setRetry(true)
      else setResult(point.id, false)
      startReaction('wrong', at)
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

  const themeClass = `tq trivia-theme-${point.marker_family || 'default'}`
  // Progress: a fixed segment per quiz item (stable across the whole quiz),
  // filling as we advance. Falls back to queue length for a lone proximity item.
  const idx = items.findIndex((it) => it.id === point.id)
  const totalSegments = items.length > 0 ? items.length : Math.max(1, queueLen + 1)
  const currentIndex = idx >= 0 ? idx : 0

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

  const letters = locale === 'he' ? HE_LETTERS : EN_LETTERS
  const resolvedWrong = phase !== 'asking' && attempts >= maxAttempts && results[point.id] === false
  const ed = point.extra_details ?? {}
  const chartLabel = ((ed[locale] ?? ed.he ?? ed.en) as { chart?: string } | undefined)?.chart
  const eyebrow = point.quiz_name ?? chartLabel ?? null
  const questionMedia = firstMedia(point.question_images)
  const isRetry = phase === 'asking' && attempts > 0

  return (
    <div className="trivia-overlay">
      <div className={themeClass}>
        {/* Top bar: progress + score / place / time */}
        <header className="tq-top">
          {totalSegments > 1 && (
            <div className="tq-progress">
              {Array.from({ length: totalSegments }).map((_, i) => {
                const item = items[i]
                const res = item ? results[item.id] : undefined
                const cls =
                  res !== undefined
                    ? res
                      ? 'seg-correct'
                      : 'seg-wrong'
                    : i === currentIndex
                      ? 'seg-active'
                      : ''
                return <span key={i} className={`seg ${cls}`} />
              })}
            </div>
          )}
          <div className="tq-hud">
            <div className="tq-chip">
              <span className="tq-chip-icon" aria-hidden>★</span>
              <span className="tq-chip-val">{score}</span>
              <span className="tq-chip-label">{t('points', locale)}</span>
            </div>
            <div className="tq-chip">
              <span className="tq-chip-icon" aria-hidden>🏆</span>
              <span className="tq-chip-val">{placeLabel}</span>
              <span className="tq-chip-label">{t('place', locale)}</span>
            </div>
            <div className={`tq-chip ${hasCountdown && (point.countdown ?? 0) - elapsed <= 10 ? 'tq-chip-warn' : ''}`}>
              <span className="tq-chip-icon" aria-hidden>⏱</span>
              <span className="tq-chip-val tq-num">{timeLabel}</span>
            </div>
          </div>
        </header>

        {/* Question + answers: always one screen, no scrolling */}
        {(phase === 'asking' || phase === 'reacting') && (
          <main className="tq-main" ref={fitRef} data-fit="0">
            <section className={`tq-qcard ${questionMedia ? 'tq-qcard-media' : ''}`}>
              {(eyebrow || isRetry) && (
                <div className="tq-eyebrow">
                  {isRetry ? (
                    <span className="tq-retry">↻ {t('triviaSecondTry', locale)}</span>
                  ) : (
                    eyebrow
                  )}
                </div>
              )}
              {point.question && <h2 className="tq-question">{point.question}</h2>}
              {questionMedia && (
                <div className="tq-media">
                  {questionMedia.kind === 'yt' ? (
                    <iframe
                      src={youTubeEmbed(questionMedia.id)}
                      title="video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <img src={questionMedia.url} alt="" onLoad={refit} />
                  )}
                </div>
              )}
              {point.question_voice && (
                <VoiceButton src={point.question_voice} label={t('playVoice', locale)} />
              )}
            </section>

            {choices.length > 0 && (
              <div
                className={`tq-answers ${compactChoices ? 'tq-answers-grid' : ''} ${isIntro ? 'tq-answers-intro' : ''}`}
                data-count={choices.length}
              >
                {choices.map((choice, i) => {
                  const gone = eliminated.includes(choice)
                  const isPicked = picked != null && normalize(picked) === normalize(choice)
                  const state =
                    phase === 'reacting' && isPicked
                      ? reaction === 'correct'
                        ? 'tq-ans-right'
                        : 'tq-ans-wrong'
                      : gone
                        ? 'tq-ans-gone'
                        : ''
                  return (
                    <button
                      key={choice}
                      className={`tq-ans ${state}`}
                      disabled={phase !== 'asking' || gone}
                      onClick={(e) => onPick(choice, e.timeStamp)}
                    >
                      {!isIntro && <span className="tq-ans-badge">{letters[i] ?? i + 1}</span>}
                      <span className="tq-ans-text">{choice}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </main>
        )}

        {/* Story reveal */}
        {phase === 'revealed' && (
          <>
            <main className="tq-story-wrap">
              <article className="tq-story">
                {point.question && !revealOnly && (
                  <p className="tq-story-q">{point.question}</p>
                )}
                {rightAnswer && (
                  <div className={`tq-answer-pill ${resolvedWrong ? 'tq-answer-pill-missed' : ''}`}>
                    <span className="tq-answer-pill-icon" aria-hidden>✓</span>
                    <span>
                      <span className="tq-answer-pill-label">{t('triviaAnswer', locale)}</span>
                      {rightAnswer}
                    </span>
                  </div>
                )}
                {revealOnly && point.question && <h2 className="tq-story-title">{point.question}</h2>}
                {revealOnly && (
                  <MediaBlock images={point.question_images} voice={point.question_voice} />
                )}
                {point.story && <p className="tq-story-text">{point.story}</p>}
                <MediaBlock images={point.story_images} voice={point.story_voices?.[0]} />
              </article>
            </main>
            <footer className="tq-actions">
              <div className="tq-vote">
                <span className="tq-vote-q">{t('triviaLiked', locale)}</span>
                <button
                  className={`tq-vote-btn ${voted === 'up' ? 'tq-vote-on' : ''}`}
                  onClick={() => onVote('up')}
                  aria-label="thumbs up"
                  aria-pressed={voted === 'up'}
                  disabled={voted != null && voted !== 'up'}
                >
                  👍
                </button>
                <button
                  className={`tq-vote-btn ${voted === 'down' ? 'tq-vote-on' : ''}`}
                  onClick={() => onVote('down')}
                  aria-label="thumbs down"
                  aria-pressed={voted === 'down'}
                  disabled={voted != null && voted !== 'down'}
                >
                  👎
                </button>
              </div>
              <button className="tq-next" onClick={onContinue}>
                {isLastQuizCard ? t('finishQuiz', locale) : t('nextCard', locale)}
                <span className="tq-next-arrow" aria-hidden>
                  {locale === 'he' ? '←' : '→'}
                </span>
              </button>
            </footer>
          </>
        )}

        {/* End-of-quiz summary */}
        {phase === 'summary' && (
          <main className="tq-summary-wrap">
            <div className="tq-summary">
              <img className="tq-summary-car" src={CORRECT_STEPS[1].src} alt="" />
              <h2 className="tq-summary-title">{t('quizComplete', locale)}</h2>
              <div className="tq-summary-stats">
                <div className="tq-summary-stat">
                  <div className="tq-summary-val">{score}</div>
                  <div className="tq-summary-label">{t('points', locale)}</div>
                </div>
                <div className="tq-summary-stat">
                  <div className="tq-summary-val">{placeLabel}</div>
                  <div className="tq-summary-label">{t('place', locale)}</div>
                </div>
                <div className="tq-summary-stat">
                  <div className="tq-summary-val tq-num">{fmtTime(elapsed)}</div>
                  <div className="tq-summary-label">{t('triviaTime', locale)}</div>
                </div>
              </div>
              <button className="tq-next" onClick={() => dismiss()}>
                {t('finishQuiz', locale)}
              </button>
            </div>
          </main>
        )}

        {/* Reaction: plays its whole storyboard, then moves on */}
        {phase === 'reacting' && (
          <div
            className={`tq-reaction tq-reaction-${reaction}`}
            onClick={onReactionTap}
            role="status"
            aria-live="polite"
          >
            <div className="tq-reaction-card">
              <div className="tq-reaction-stage">
                {reaction === 'correct' && <div className="tq-burst" aria-hidden />}
                {steps.map((s, i) => (
                  <img
                    key={s.src}
                    className={`tq-reaction-car ${i === step ? 'tq-on' : ''}`}
                    src={s.src}
                    alt=""
                  />
                ))}
              </div>
              <div className="tq-reaction-title">
                {reaction === 'correct' ? t('triviaCorrect', locale) : t('triviaWrong', locale)}
              </div>
              {reaction === 'correct' && earned != null && (
                <div className="tq-reaction-points">
                  <bdi dir="ltr">+{earned}</bdi> {t('points', locale)}
                </div>
              )}
              {reaction === 'wrong' && retry && (
                <div className="tq-reaction-sub">{t('triviaTryAgain', locale)}</div>
              )}
              <div
                className="tq-reaction-timer"
                style={{ animationDuration: `${steps.reduce((n, s) => n + s.ms, 0)}ms` }}
                aria-hidden
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type Media = { kind: 'img'; url: string } | { kind: 'yt'; id: string }

function firstMedia(urls?: (string | null)[] | null): Media | null {
  for (const url of urls ?? []) {
    if (!url) continue
    const yt = youTubeId(url)
    if (yt) return { kind: 'yt', id: yt }
    if (isImageUrl(url) || /^https?:\/\//.test(url)) return { kind: 'img', url }
  }
  return null
}

/** Compact play/pause pill instead of the tall native audio controls. */
function VoiceButton({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <>
      <button
        className="tq-voice"
        onClick={() => {
          const a = audioRef.current
          if (!a) return
          if (a.paused) void a.play().catch(() => {})
          else a.pause()
        }}
      >
        <span aria-hidden>{playing ? '❚❚' : '▶'}</span> {label}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  )
}
