import { useRef } from 'react'
import type { Quest } from '../../types'
import { useQuestAudio } from './questAudio'
import { loadQuestTask } from '../games/loadQuestTask'
import './questMap.css'

// The Babylon / road-quest map chrome, overlaid on the Mapbox canvas when a
// quest is active. Mirrors the original native layout (quest_content.xml):
//  - top-left: professor avatar (tap → plays random sound)
//  - top-centre: distance card (quest name · "בעוד X ק"מ" · next station)
//  - centre: the professor's task opener button (→ "getstation" setup screen)
//  - left edge: the "metro line" — a vertical strip of station icons, the one
//    the player is heading to highlighted (user_next_station, 1-based).
//  - bottom-left: mute toggle for the map background music.
//  - below avatar: bulb/hint button when show_whatsapp_send (→ "quest_hints" screen)
// Driven entirely by Configuration.quest.
interface Props {
  quest: Quest
}

export default function QuestMapOverlay({ quest }: Props) {
  const stations = quest.metro?.stations ?? []
  const nextOrder = quest.user_next_station
  const muted = useQuestAudio((s) => s.muted)
  const toggleMuted = useQuestAudio((s) => s.toggleMuted)
  const randomAudioRef = useRef<HTMLAudioElement | null>(null)

  function playRandomSound() {
    const sounds = quest.random_sounds
    if (!sounds?.length) return
    const url = sounds[Math.floor(Math.random() * sounds.length)]
    randomAudioRef.current?.pause()
    const a = new Audio(url)
    randomAudioRef.current = a
    a.play().catch(() => {})
  }

  return (
    <>
      {quest.avatar && (
        <button className="quest-avatar" onClick={playRandomSound} aria-label="play hint sound">
          <img src={quest.avatar} alt="" />
        </button>
      )}

      <div className="quest-distance">
        {quest.quest_name && <div className="quest-distance-name">{quest.quest_name}</div>}
        {quest.next_km_label && <div className="quest-distance-km">{quest.next_km_label}</div>}
        {(() => {
          // Derive station name from the stations array using user_next_station as
          // the key — the backend's next_station_name field is off-by-one (returns
          // the previous station's name after completion).
          const nextStation = stations.find((s) => s.station_order === nextOrder)
          const name = nextStation?.station_name_disp ?? nextStation?.station_name ?? quest.next_station_name
          return name ? <div className="quest-distance-station">{name}</div> : null
        })()}
      </div>

      {quest.task_opener && (
        <button
          className="quest-task-opener"
          onClick={() => void loadQuestTask('getstation')}
          aria-label="open quest task"
        >
          <img src={quest.task_opener} alt="" />
        </button>
      )}

      {quest.show_whatsapp_send && (
        <button
          className="quest-hint-btn"
          onClick={() => void loadQuestTask('quest_hints')}
          aria-label="quest hints"
        >
          💡
        </button>
      )}

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

      {quest.map_music && (
        <button
          className="quest-mute"
          onClick={toggleMuted}
          aria-label={muted ? 'unmute music' : 'mute music'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </>
  )
}
