import type { Quest } from '../../types'
import './questMap.css'

// The Babylon / road-quest map chrome, overlaid on the Mapbox canvas when a
// quest is active. Mirrors the original native layout:
//  - top-left: professor avatar
//  - top-centre: distance card (quest name · "בעוד X ק"מ" · next station)
//  - left edge: the "metro line" — a vertical strip of station icons, the one
//    the player is heading to highlighted (user_next_station, 1-based).
// Driven entirely by Configuration.quest.
interface Props {
  quest: Quest
}

export default function QuestMapOverlay({ quest }: Props) {
  const stations = quest.metro?.stations ?? []
  const nextOrder = quest.user_next_station

  return (
    <>
      {quest.avatar && (
        <div className="quest-avatar">
          <img src={quest.avatar} alt="" />
        </div>
      )}

      <div className="quest-distance">
        {quest.quest_name && <div className="quest-distance-name">{quest.quest_name}</div>}
        {quest.next_km_label && <div className="quest-distance-km">{quest.next_km_label}</div>}
        {quest.next_station_name && (
          <div className="quest-distance-station">{quest.next_station_name}</div>
        )}
      </div>

      {stations.length > 0 && (
        <div className="quest-stations">
          {stations.map((s) => {
            const done = s.station_order < nextOrder
            const active = s.station_order === nextOrder
            return (
              <div
                key={s.station_order}
                className={`quest-station${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                title={s.station_name_disp ?? s.station_name ?? ''}
              >
                {s.icon_url && <img src={s.icon_url} alt="" />}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
