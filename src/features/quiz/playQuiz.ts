// Plays a quiz (daily quiz or geofence quiz) by reusing the road-point card
// flow: fetch the quiz's items, push them into the driving store, and let the
// existing <GameCard/> overlay render them. Works without an active drive.
//
// The backend `quiz` param accepts the quiz id; on some quizzes only the name
// resolves, so if the id yields no items we retry with the name.

import { fetchItems } from '../../api/endpoints'
import { useSession } from '../../store/session'
import { useDriving } from '../../store/driving'
import type { RoadPointsResponse } from '../../types'

export interface PlayQuizArgs {
  quizId: number | string
  quizName?: string | null
}

/**
 * Fetch and trigger a quiz's cards. Returns the number of cards triggered
 * (0 if the quiz came back empty — a valid outcome for guests).
 */
export async function playQuiz({ quizId, quizName }: PlayQuizArgs): Promise<number> {
  const session = useSession.getState()
  const driving = useDriving.getState()
  const pos = driving.position

  const base = {
    user_id: session.userId,
    locale: session.locale,
    lat: pos ? String(pos.lat) : null,
    lng: pos ? String(pos.lng) : null,
    quiz_name: quizName ?? null,
  }

  // Try the quiz id first; fall back to the name if no items come back.
  let res: RoadPointsResponse = await fetchItems({ ...base, quiz: String(quizId) })
  if ((res.items?.length ?? 0) === 0 && quizName) {
    res = await fetchItems({ ...base, quiz: quizName })
  }

  const items = res.items ?? []
  driving.setItems(items)

  session.setHud({
    score: String(res.score ?? '0'),
    rank: String(res.rank ?? '-'),
    nextItemKm: String(res.next_item_km ?? '-'),
    username: res.username ?? session.username,
  })
  if (res.configuration) driving.setConfig(res.configuration)

  if (items.length) return driving.triggerItems(items)
  return 0
}

// Dev: drive a quiz from the console / tests (the daily list is empty for fresh
// guests, so this lets us exercise a full quiz with a virgin user id).
if (import.meta.env.DEV) {
  ;(window as unknown as { __playQuiz?: typeof playQuiz }).__playQuiz = playQuiz
}
