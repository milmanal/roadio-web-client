import { Suspense, lazy, useState } from 'react'
import { useDriving } from '../../store/driving'
import { useSession } from '../../store/session'
import { reportAnswer, reportEvents, NEXT_EVENT } from '../../api/endpoints'
import { isCorrect, isScored } from './answer'
import type { CardProps, CardResult } from './cardProps'
import type { RoadPoint, RoadPointType } from '../../types'
import TriviaCard from './cards/TriviaCard'
import QuestionCard from './cards/QuestionCard'
import QuantitativeCard from './cards/QuantitativeCard'
import StoryCard from './cards/StoryCard'
import WebGameCard from './cards/WebGameCard'
import FallbackCard from './cards/FallbackCard'
import QuestItemFrame from './cards/QuestItemFrame'
import AudioItem from './cards/AudioItem'
// GeoGuessCard pulls in mapbox-gl — load it only when a geoguess card shows.
const GeoGuessCard = lazy(() => import('./cards/GeoGuessCard'))
import './games.css'

const STORY_TYPES = new Set<RoadPointType>(['story', 'insta_story'])
const WEB_TYPES = new Set<RoadPointType>(['html', 'html_trivia'])
// Special quest/Babylon item subtypes. On the wire these usually arrive as
// type "html" (the server maps narrator/pattern_lock/etc. → html), so the real
// gate is is_quest below; this set just catches them if a raw subtype leaks
// through.
const FRAME_TYPES = new Set<RoadPointType>([
  'narrator',
  'pattern_lock',
  'sound_trivia',
  'open_answer',
  'mission_code_whatsapp',
])

// A quest/Babylon item whose original look & feel lives in the backend's own
// item HTML. We render it by iframing GET /item/<id>?client=web (hash bridge)
// rather than reconstructing it. Real items arrive as type "html" + is_quest
// with an html_payload; audio transition clips are handled separately.
function isFrameItem(point: RoadPoint): boolean {
  if (point.type === 'audio') return false
  if (FRAME_TYPES.has(point.type)) return true
  return (
    point.is_quest === true &&
    (point.type === 'html' || point.type === 'html_trivia' || !!point.html_payload)
  )
}

type CardKind =
  | 'geo' | 'quant' | 'web' | 'story' | 'question' | 'fallback' | 'frame' | 'audio'

function cardKind(point: RoadPoint): CardKind {
  const type = point.type
  if (type === 'audio') return 'audio'
  if (isFrameItem(point)) return 'frame'
  if (type === 'geoguess') return 'geo'
  if (type === 'quantitative') return 'quant'
  if (WEB_TYPES.has(type) || point.html_template_name) return 'web'
  if (STORY_TYPES.has(type)) return 'story'
  if ((point.answers?.length ?? 0) > 0 || isScored(point)) return 'question'
  return 'fallback'
}

function renderCard(kind: CardKind, props: CardProps) {
  switch (kind) {
    case 'geo':
      return (
        <Suspense fallback={<div className="card-inner" />}>
          <GeoGuessCard {...props} />
        </Suspense>
      )
    case 'quant':
      return <QuantitativeCard {...props} />
    case 'web':
      return <WebGameCard {...props} />
    case 'story':
      return <StoryCard {...props} />
    case 'question':
      return <QuestionCard {...props} />
    default:
      return <FallbackCard {...props} />
  }
}

/** Bottom-sheet card for the active road point. Owns answer reporting. */
export default function GameCard() {
  const point = useDriving((s) => s.activeCard)
  const dismiss = useDriving((s) => s.dismissActive)
  const position = useDriving((s) => s.position)
  const userId = useSession((s) => s.userId)
  const setHud = useSession((s) => s.setHud)

  const [result, setResult] = useState<CardResult | null>(null)
  const [busy, setBusy] = useState(false)

  if (!point) return null

  const latlng = {
    lat: position ? String(position.lat) : null,
    lng: position ? String(position.lng) : null,
  }

  async function onSubmit(answer: string | number[]) {
    if (busy || result || !point) return
    setBusy(true)
    // Geoguess (array answer) is scored server-side; everything else can be
    // scored locally against right_answer for instant feedback.
    const isGeo = Array.isArray(answer)
    const scored = !isGeo && isScored(point)
    const correct = scored && isCorrect(point, answer)
    try {
      const res = await reportAnswer({
        user_id: userId,
        itemId: point.id,
        answer,
        ...latlng,
      })
      setHud({ score: String(res.score), rank: String(res.rank) })
    } catch {
      // Keep the locally-computed result even if the report failed.
    }
    setResult({
      correct,
      scored,
      pickedAnswer: isGeo ? undefined : (answer as string),
    })
    setBusy(false)
  }

  async function onContinue() {
    if (busy || !point) return
    setBusy(true)
    try {
      await reportEvents({
        user_id: userId,
        ...latlng,
        events: { [String(point.id)]: { answer: NEXT_EVENT } },
      })
    } catch {
      // ignore — advancing locally regardless
    }
    setResult(null)
    setBusy(false)
    dismiss()
  }

  const kind = cardKind(point)

  // Quest/Babylon special items: render the backend's own item HTML full-screen
  // (it owns its UI + scoring via the hash bridge). Must take priority over the
  // trivia/quiz branches below.
  if (kind === 'frame') {
    return <QuestItemFrame key={point.id} point={point} />
  }
  // Audio transition clips: no UI — autoplay + auto-advance.
  if (kind === 'audio') {
    return <AudioItem key={point.id} point={point} />
  }

  // Full-screen themed flow (signpost buttons, multiple attempts, reaction,
  // story reveal + vote, end-of-quiz summary). It owns its own reporting/
  // advance, so it renders outside the bottom-sheet shell. key per item id so
  // internal flow state resets when the queue advances.
  // - any multiple-choice question (driving or quiz), and
  // - quiz info/reveal cards (html/story with no choices) so the quiz stays
  //   one continuous themed experience — but NOT real webview-template games,
  //   geoguess, or quantitative, which keep their dedicated cards.
  const hasChoices = (point.answers?.length ?? 0) > 0
  const isQuizItem = point.quiz_name != null || point.is_quiz === true
  const isWebGame = !!point.html_template_name
  // Anything with answer choices (question OR quantitative number-pick, on the
  // map or in a quiz) → themed signpost card. Geoguess keeps its own map card.
  if (hasChoices && kind !== 'geo') {
    return <TriviaCard key={point.id} point={point} />
  }
  // Quiz info/reveal cards (html/story, no choices, not a webview template).
  if (isQuizItem && !isWebGame && kind !== 'geo') {
    return <TriviaCard key={point.id} point={point} />
  }

  return (
    <div className="card-overlay">
      <div className="card" onClick={(e) => e.stopPropagation()}>
        {renderCard(kind, { point, result, busy, onSubmit, onContinue })}
      </div>
    </div>
  )
}
