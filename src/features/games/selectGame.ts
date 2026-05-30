// Selecting a game = POST /v2/items with the game's quiz token. This is what
// the original Android game-selection webview did via its `roadio://v2/items?
// quiz=…` deep links. The call flips the user's server-side state to
// has_game_selected=true (verified live: a fresh guest goes from 0 → 178 map
// markers after selecting quiz="roadio"), so the map then shows road points.
//
// Unlike playQuiz, this does NOT trigger cards — it only establishes the active
// game; the map's driving loop + proximity surface road points as you drive.

import { fetchItems } from '../../api/endpoints'
import { useSession } from '../../store/session'
import { useDriving } from '../../store/driving'

/** Select (activate) a game by its quiz token. Returns has_game_selected. */
export async function selectGame(quiz: string): Promise<boolean> {
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
  session.setHud({
    score: String(res.points ?? res.score ?? '0'),
    rank: String(res.rank ?? '-'),
    nextItemKm: String(res.next_item_km ?? '-'),
    username: res.username ?? session.username,
    gameName: res.configuration?.game_name ?? null,
  })

  return res.configuration?.has_game_selected ?? false
}
