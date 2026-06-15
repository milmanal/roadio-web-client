// The quest "task opener" — Android's StandbyPresenter.loadQuiz("getstation").
// Tapping the professor's task button on the Babylon map fetches the station/
// destination-setup item (POST /v2/items with quiz="getstation") and surfaces it
// as a card (rendered by QuestItemFrame). Unlike selectGame this DOES trigger
// the returned items, since the whole point is to open the setup screen now.

import { fetchItems } from '../../api/endpoints'
import { useSession } from '../../store/session'
import { useDriving } from '../../store/driving'

/** Fetch a named quest quiz (e.g. "getstation") and show its item as a card. */
export async function loadQuestTask(quiz: string): Promise<number> {
  const session = useSession.getState()
  const driving = useDriving.getState()
  const pos = driving.position

  const res = await fetchItems({
    user_id: session.userId,
    quiz,
    locale: session.locale,
    lat: pos ? String(pos.lat) : null,
    lng: pos ? String(pos.lng) : null,
  })

  if (res.configuration) driving.setConfig(res.configuration)
  const items = res.items ?? []
  if (items.length === 0) return 0
  return driving.triggerItems(items)
}
