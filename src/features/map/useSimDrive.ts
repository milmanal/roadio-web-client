// Dev-only driving simulator. When a route is selected it takes over the
// position feed (real geolocation + marker polling are switched off by
// MapScreen) and walks the car along a preset polyline. It first pulls the
// REAL /v3/map_markers for the route area, so the live proximity loop fires
// actual backend questions as you "drive" past each pin.
//
// If the device has no item markers (fresh guest with no game state), it seeds
// a few synthetic pins backed by known-good live item ids so the sim still has
// something to drive to.

import { useEffect, useRef } from 'react'
import { useDriving, type Position } from '../../store/driving'
import { useSession } from '../../store/session'
import { useMarkers } from '../../store/markers'
import { getMapMarkers } from '../../api/endpoints'
import { distanceMeters } from '../../lib/geo'
import type { MapMarker } from '../../types'

const STEP_MS = 500
const STEP_M = 25 // metres per tick (~50 m/s); well under the 100 m trigger radius

// Live item ids verified to return playable content (fallback seeds only).
const SEED_ITEM_IDS = [2504735, 1400933, 13254]

interface LL {
  lat: number
  lng: number
}

/** Preset drive routes through dense-marker areas of Tel Aviv–Jaffa. */
export interface SimRoute {
  id: string
  name: string
  waypoints: LL[]
}

export const SIM_ROUTES: SimRoute[] = [
  {
    id: 'jaffa',
    name: 'Jaffa → center',
    waypoints: [
      { lat: 32.0500, lng: 34.7600 },
      { lat: 32.0540, lng: 34.7585 },
      { lat: 32.0575, lng: 34.7600 },
      { lat: 32.0610, lng: 34.7660 },
      { lat: 32.0660, lng: 34.7700 },
    ],
  },
  {
    id: 'center',
    name: 'Center loop',
    waypoints: [
      { lat: 32.0700, lng: 34.7750 },
      { lat: 32.0745, lng: 34.7720 },
      { lat: 32.0790, lng: 34.7710 },
      { lat: 32.0830, lng: 34.7720 },
      { lat: 32.0855, lng: 34.7715 },
    ],
  },
  {
    id: 'north',
    name: 'North / Port',
    waypoints: [
      { lat: 32.0880, lng: 34.7800 },
      { lat: 32.0920, lng: 34.7830 },
      { lat: 32.0960, lng: 34.7870 },
      { lat: 32.0995, lng: 34.7820 },
      { lat: 32.1010, lng: 34.7760 },
    ],
  },
]

/** Metres → degrees offset at a given latitude (small-distance approximation). */
function offset(base: LL, dNorth: number, dEast: number): LL {
  const dLat = dNorth / 111_320
  const dLng = dEast / (111_320 * Math.cos((base.lat * Math.PI) / 180))
  return { lat: base.lat + dLat, lng: base.lng + dLng }
}

function seedMarkers(waypoints: LL[]): MapMarker[] {
  // Place each seed pin a little off an early waypoint so the route runs past it.
  const anchors = [
    offset(waypoints[0], 120, 50),
    offset(waypoints[Math.min(1, waypoints.length - 1)], 100, -60),
    offset(waypoints[Math.min(2, waypoints.length - 1)], 130, 70),
  ]
  return SEED_ITEM_IDS.map((id, i) => ({
    marker_id: `sim-${id}`,
    marker_type: 'item',
    family: 'default',
    lat: String(anchors[i].lat),
    lng: String(anchors[i].lng),
    item_id: id,
    title: 'שאלה',
    score: 200,
    on_path: true,
  }))
}

/** Step `from` toward `to` by up to `meters`; reached=true when it arrives. */
function stepToward(from: LL, to: LL, meters: number): { pos: LL; reached: boolean } {
  const d = distanceMeters(from.lat, from.lng, to.lat, to.lng)
  if (d <= meters || d === 0) return { pos: to, reached: true }
  const f = meters / d
  return {
    pos: { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f },
    reached: false,
  }
}

export function useSimDrive(routeId: string | null) {
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!routeId) return
    const route = SIM_ROUTES.find((r) => r.id === routeId)
    if (!route) return

    const driving = useDriving.getState
    const session = useSession.getState
    const markers = useMarkers.getState
    let cancelled = false

    const waypoints = route.waypoints
    const start = waypoints[0]

    // Plant the car at the start immediately so the map recentres there.
    driving().setPosition({ ...start, accuracy: 5, speed: null, ts: 0 } as Position)

    async function begin() {
      // Pull the real markers for this area; seed if the user has none.
      try {
        const res = await getMapMarkers({
          user_id: session().userId,
          lat: String(start.lat),
          lng: String(start.lng),
          force: true,
        })
        if (cancelled) return
        const items = res.items ?? []
        if (items.length === 0) {
          console.warn(
            '[sim] backend returned 0 map markers for this user — no game ' +
              'selected. Driving seeded demo pins instead. Tap the 👤 dev ' +
              'button to switch to a demo user with real markers.',
          )
        }
        markers().setAll({
          cars: res.cars ?? [],
          items: items.length ? items : seedMarkers(waypoints),
          missions: res.missions ?? [],
          openMissions: res.open_missions ?? [],
          completedMissions: res.completed_missions ?? [],
          seenItems: res.seen_items ?? [],
        })
      } catch {
        if (cancelled) return
        markers().setAll({ items: seedMarkers(waypoints) })
      }

      let cursor: LL = { ...start }
      let leg = 1
      let tick = 0
      timer.current = window.setInterval(() => {
        if (driving().activeCard) return // pause while a card is open
        if (leg >= waypoints.length) {
          if (timer.current) window.clearInterval(timer.current)
          timer.current = null
          return
        }
        const { pos, reached } = stepToward(cursor, waypoints[leg], STEP_M)
        cursor = pos
        if (reached) leg += 1
        tick += 1
        driving().setPosition({ ...cursor, accuracy: 5, speed: 14, ts: tick } as Position)
      }, STEP_MS)
    }

    void begin()

    return () => {
      cancelled = true
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [routeId])
}
