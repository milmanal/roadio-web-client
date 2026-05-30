// Dev-only driving simulator. When active it takes over the position feed
// (real geolocation + marker polling are switched off by MapScreen) and walks
// the car along a route that threads through the item markers, so the live
// proximity loop fires real question cards as you "drive" past each pin.
//
// If the device has no item markers yet (fresh guest, fetch_markers off), it
// seeds a few synthetic pins backed by known-good live item ids so the sim
// always has something to drive to. Pauses while a card is open; resumes after
// it's dismissed; stops at the end of the route.

import { useEffect, useRef } from 'react'
import { useDriving, type Position } from '../../store/driving'
import { useMarkers } from '../../store/markers'
import { distanceMeters } from '../../lib/geo'
import type { MapMarker } from '../../types'

const STEP_MS = 500
const STEP_M = 25 // metres advanced per tick (~50 m/s); well under the 100 m trigger radius

// Live item ids verified to return playable content (see MAP_PROGRESS.md):
// 2504735 question, 1400933 html, 13254 geoguess.
const SEED_ITEM_IDS = [2504735, 1400933, 13254]
const TLV = { lat: 32.0760, lng: 34.7740 }

interface LL {
  lat: number
  lng: number
}

/** Metres → degrees offset at a given latitude (small-distance approximation). */
function offset(base: LL, dNorth: number, dEast: number): LL {
  const dLat = dNorth / 111_320
  const dLng = dEast / (111_320 * Math.cos((base.lat * Math.PI) / 180))
  return { lat: base.lat + dLat, lng: base.lng + dLng }
}

function seedMarkers(center: LL): MapMarker[] {
  // Spread the seed pins ~180 m apart in a little zig-zag around the centre.
  const spots = [
    offset(center, 180, 60),
    offset(center, 360, -80),
    offset(center, 560, 120),
  ]
  return SEED_ITEM_IDS.map((id, i) => ({
    marker_id: `sim-${id}`,
    marker_type: 'item',
    family: 'default',
    lat: String(spots[i].lat),
    lng: String(spots[i].lng),
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

export function useSimDrive(active: boolean) {
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const driving = useDriving.getState
    const markers = useMarkers.getState

    // Targets: real item markers if present, otherwise seed synthetic pins
    // around the current position (or Tel Aviv) and push them into the store.
    let targets = markers().items.filter(
      (m) => m.item_id != null && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lng)),
    )
    const start: LL = driving().position
      ? { lat: driving().position!.lat, lng: driving().position!.lng }
      : TLV
    if (targets.length === 0) {
      const seeded = seedMarkers(start)
      markers().setAll({ items: seeded })
      targets = seeded
    }

    // Route waypoints: from the start point, through each target in turn.
    const waypoints: LL[] = [
      start,
      ...targets.map((m) => ({ lat: Number(m.lat), lng: Number(m.lng) })),
    ]

    let cursor: LL = { ...start }
    let leg = 1 // index of the waypoint we're heading toward

    // Plant the car at the start immediately.
    driving().setPosition({ ...cursor, accuracy: 5, speed: null, ts: 0 } as Position)

    let tick = 0
    timer.current = window.setInterval(() => {
      // Pause while a card is open — don't drive past pins mid-question.
      if (driving().activeCard) return
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

    return () => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [active])
}
