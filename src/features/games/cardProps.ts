import type { RoadPoint } from '../../types'

export interface CardResult {
  correct: boolean
  scored: boolean
  pickedAnswer?: string
}

export interface CardProps {
  point: RoadPoint
  result: CardResult | null
  busy: boolean
  /** Submit an answer for scoring. Geoguess submits [lat, lng]. */
  onSubmit: (answer: string | number[]) => void
  /** Dismiss/advance (sends the next_event sentinel). */
  onContinue: () => void
}
