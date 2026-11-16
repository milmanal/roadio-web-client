// Answer evaluation. right_answer may be null or carry trailing tabs (trim).
// `as_many` items use multiple_right_answers (an array of acceptable answers).

import type { RoadPoint } from '../../types'

export function normalize(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

/** True if the point has a defined correct answer the client can score. */
export function isScored(point: RoadPoint): boolean {
  // NOTE: multiple_right_answers is often an EMPTY array on normal questions
  // (right_answer carries the answer). Only treat it as the source of truth
  // when it's a non-empty array; otherwise fall through to right_answer —
  // else every such question reads as unscored and gets marked correct.
  if (Array.isArray(point.multiple_right_answers) && point.multiple_right_answers.length > 0) {
    return true
  }
  return point.right_answer != null && String(point.right_answer).trim() !== ''
}

export function isCorrect(point: RoadPoint, answer: unknown): boolean {
  const a = normalize(answer)
  if (Array.isArray(point.multiple_right_answers) && point.multiple_right_answers.length > 0) {
    return point.multiple_right_answers.some((r) => normalize(r) === a)
  }
  if (point.right_answer != null && String(point.right_answer).trim() !== '') {
    return normalize(point.right_answer) === a
  }
  return false
}

/**
 * Empty follow-up "ack" item the backend appends to a quiz (no question, no
 * story, no media, answers like ["1"]). It gets a fresh synthetic id on every
 * /v2/items response, so it must be acknowledged, never shown: showing it
 * leaves the quiz unfinished and it pops up again on the next fetch.
 */
export function isBlankAck(point: RoadPoint): boolean {
  const blank =
    !point.question?.trim() &&
    !point.story?.trim() &&
    !(point.question_images ?? []).some(Boolean) &&
    !(point.story_images ?? []).some(Boolean) &&
    !(point.story_voices ?? []).some(Boolean) &&
    !point.question_voice &&
    !point.html_template_name
  return blank && (point.answers ?? []).filter(Boolean).length <= 1
}

/**
 * Open-text question: a scored item answered by typing. Quiz "html" items
 * carry these with no choices (e.g. "biggest animal?") or with the answer as
 * their only choice (fill-in-the-blank "___").
 */
export function isOpenText(point: RoadPoint): boolean {
  const n = (point.answers ?? []).filter(Boolean).length
  return (
    isScored(point) &&
    !!point.question?.trim() &&
    (n === 0 || (n === 1 && point.type === 'html'))
  )
}

/**
 * A real quiz question (gets a progress segment): multiple choice or open
 * text. Not intro/outro buttons, info cards or the empty summary item.
 */
export function isQuizQuestion(point: RoadPoint): boolean {
  if (isBlankAck(point)) return false
  return (point.answers ?? []).filter(Boolean).length >= 2 || isOpenText(point)
}
