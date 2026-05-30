import { useState } from 'react'
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
import GeoGuessCard from './cards/GeoGuessCard'
import FallbackCard from './cards/FallbackCard'
import './games.css'

const STORY_TYPES = new Set<RoadPointType>(['story', 'insta_story', 'narrator'])
const WEB_TYPES = new Set<RoadPointType>(['html', 'html_trivia'])

type CardKind = 'geo' | 'quant' | 'web' | 'story' | 'question' | 'fallback'

function cardKind(point: RoadPoint): CardKind {
  const type = point.type
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
      return <GeoGuessCard {...props} />
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

  // Multiple-choice trivia gets the full-screen themed flow (signpost buttons,
  // multiple attempts, reaction animation, story reveal + vote). It owns its
  // own reporting/advance, so it renders outside the bottom-sheet shell.
  if (kind === 'question' && (point.answers?.length ?? 0) > 0) {
    // key per item id so internal flow state (phase/attempts/vote) resets
    // when the queue advances to the next question.
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
