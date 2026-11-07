// Dev-only Babel quest test mode (map dev row, `import.meta.env.DEV` only).
//
// Playing a road quest for real means driving several km and sitting through
// minutes of narration. These helpers make a full run testable at a desk:
//
//  - startFreshBabelUser(): new device id, signed up for Babel (game 496) with
//    dummy details → the quest restarts from station 1.
//  - useQuestTestDrive(active): replaces the GPS feed with a simulated car that
//    drives to the current station marker and then keeps circling it, so the
//    backend sees a *driving* user near the station (stations only release
//    their items to a driving user within ~500 m). Unlike useSimDrive, the real
//    /v2/items driving loop stays on — that loop is what delivers quest items.
//  - skipCurrentClip(): jumps the playing narration / transition clip to its
//    end so the item's own "clip finished" flow runs immediately.
//
// The server's own pacing between items (seconds_from_prev_item) still
// applies; nothing here can bypass it.

import { useEffect } from 'react'
import { useDriving, type Position } from '../../store/driving'
import { useMarkers } from '../../store/markers'
import { distanceMeters } from '../../lib/geo'
import { fetchItems, registerUser } from '../../api/endpoints'

const BABEL_GAME_ID = 496
const BABEL_QUIZ = 'reg_496_dana'
const DEVICE_KEY = 'roadio.device_id'

/** Rabin Square, Tel Aviv — where a fresh test run starts. */
const START = { lat: 32.0809, lng: 34.7806 }

const TICK_MS = 1500
const STEP_M = 40 // per tick (~95 km/h) while heading to the station
const CIRCLE_M = 15 // per tick once at the station, to keep "driving"

/** Currently playing AudioItem clip (registered by AudioItem in DEV). */
let currentClip: HTMLAudioElement | null = null
export function registerDevClip(audio: HTMLAudioElement | null): void {
  currentClip = audio
}

/** Jump every playing non-looping clip (narration in the quest iframe and the
 *  between-station AudioItem clip) to its end. Returns how many were skipped. */
export function skipCurrentClip(): number {
  const clips: HTMLAudioElement[] = []
  if (currentClip) clips.push(currentClip)
  const frame = document.querySelector<HTMLIFrameElement>('.quest-frame-iframe')
  try {
    frame?.contentDocument?.querySelectorAll('audio').forEach((a) => clips.push(a))
  } catch {
    // cross-origin frame — nothing to skip there
  }
  let skipped = 0
  for (const a of clips) {
    if (a.paused || a.loop || !Number.isFinite(a.duration) || a.duration < 1) continue
    a.currentTime = Math.max(0, a.duration - 0.3)
    skipped += 1
  }
  return skipped
}

/** New device id signed up for Babel with dummy details, then reload. */
export async function startFreshBabelUser(): Promise<void> {
  const userId = crypto.randomUUID()
  const lat = String(START.lat)
  const lng = String(START.lng)
  localStorage.setItem(DEVICE_KEY, userId)
  // Same two calls the Babel sign-up form makes.
  await fetchItems({ user_id: userId, quiz: BABEL_QUIZ, lat, lng })
  await registerUser({
    userId,
    game_id: BABEL_GAME_ID,
    nickname: 'QuestTest',
    email: 'roadio.test@example.com',
    phone_number: '0500000000',
    destination: 'חיפה',
    join_contest: true,
    town_id: null,
    mood_id: null,
    game_code: '',
  })
  location.reload()
}

/** The station the quest is heading to, from the live map markers. */
function stationTarget(): { lat: number; lng: number } | null {
  const m = useMarkers.getState()
  const station = m.openMissions[0] ?? m.missions[0]
  if (!station) return null
  const lat = Number(station.lat)
  const lng = Number(station.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

function step(from: { lat: number; lng: number }, to: { lat: number; lng: number }, meters: number) {
  const d = distanceMeters(from.lat, from.lng, to.lat, to.lng)
  if (d <= meters || d === 0) return { ...to }
  const f = meters / d
  return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f }
}

/** Simulated car for quest testing (see file header). */
export function useQuestTestDrive(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const driving = useDriving.getState
    let tick = 0

    const move = () => {
      const cur = driving().position ?? { ...START, ts: 0 }
      const target = stationTarget()
      let next: { lat: number; lng: number }
      if (target && distanceMeters(cur.lat, cur.lng, target.lat, target.lng) > 60) {
        next = step(cur, target, STEP_M)
      } else {
        // At the station (or none known yet): small circle so we keep moving.
        const angle = (tick % 8) * (Math.PI / 4)
        const center = target ?? cur
        next = {
          lat: center.lat + (Math.cos(angle) * CIRCLE_M * 2) / 111_320,
          lng: center.lng + (Math.sin(angle) * CIRCLE_M * 2) / 94_000,
        }
      }
      tick += 1
      driving().setPosition({
        ...next,
        accuracy: 5,
        speed: 15,
        heading: null,
        ts: Date.now(),
      } as Position)
    }

    move()
    const id = window.setInterval(move, TICK_MS)
    return () => window.clearInterval(id)
  }, [active])
}
