// Answer evaluation. right_answer may be null or carry trailing tabs (trim).
// `as_many` items use multiple_right_answers (an array of acceptable answers).

import type { RoadPoint } from '../../types'

export function normalize(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

/** True if the point has a defined correct answer the client can score. */
export function isScored(point: RoadPoint): boolean {
  if (Array.isArray(point.multiple_right_answers)) {
    return point.multiple_right_answers.length > 0
  }
  return point.right_answer != null && String(point.right_answer).trim() !== ''
}

export function isCorrect(point: RoadPoint, answer: unknown): boolean {
  const a = normalize(answer)
  if (Array.isArray(point.multiple_right_answers)) {
    return point.multiple_right_answers.some((r) => normalize(r) === a)
  }
  if (point.right_answer != null) {
    return normalize(point.right_answer) === a
  }
  return false
}
