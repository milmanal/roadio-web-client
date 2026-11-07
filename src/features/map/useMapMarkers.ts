// Polls POST /v3/map_markers for the live map and pushes grouped markers into
// the markers store. Gated by config.fetch_markers; forces a full refresh on
// the first call. Refetches when the user has moved enough.

import { useEffect, useRef } from 'react'
import { useDriving } from '../../store/driving'
import { useSession } from '../../store/session'
import { useMarkers } from '../../store/markers'
import { getMapMarkers } from '../../api/endpoints'
import { distanceMeters } from '../../lib/geo'
import type { Position } from '../../store/driving'

const MARKER_POLL_MS = 15000
const MARKER_MIN_MOVE_M = 120

export function useMapMarkers(active: boolean) {
  const lastPos = useRef<Position | null>(null)
  const firstDone = useRef(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!active) {
      lastPos.current = null
      firstDone.current = false
      return
    }
    const driving = useDriving.getState
    const session = useSession.getState
    const markers = useMarkers.getState

    // In DEV with no GPS (e.g. testing at a desk), fall back to TLV centre so
    // the first markers fetch fires and the map isn't empty after sign-in.
    const DEV_FALLBACK: Position | null = import.meta.env.DEV
      ? { lat: 32.0853, lng: 34.7818, ts: 0 }
      : null

    // A forced refresh requested while a fetch is in flight runs right after
    // it, so a state change is never lost to the in-flight guard.
    let pendingForce = false

    async function fetchMarkers(force = false) {
      if (inFlight.current) {
        if (force) pendingForce = true
        return
      }
      const pos = driving().position ?? (firstDone.current ? null : DEV_FALLBACK)
      if (!pos) return
      // NOTE: do NOT gate on config.fetch_markers — it is false even for users
      // who have a game selected and ~178 markers (it toggles background/driving
      // fetching, not the map display). Gating here left the map permanently
      // empty; /v3/map_markers returns pins whenever a game is selected.
      inFlight.current = true
      try {
        const res = await getMapMarkers({
          user_id: session().userId,
          lat: String(pos.lat),
          lng: String(pos.lng),
          force: force || !firstDone.current,
          background: false,
        })
        firstDone.current = true
        lastPos.current = pos
        markers().setAll({
          cars: res.cars ?? [],
          items: res.items ?? [],
          missions: res.missions ?? [],
          openMissions: res.open_missions ?? [],
          completedMissions: res.completed_missions ?? [],
          seenItems: res.seen_items ?? [],
        })
      } catch {
        // transient — retry next tick
      } finally {
        inFlight.current = false
        if (pendingForce) {
          pendingForce = false
          void fetchMarkers(true)
        }
      }
    }

    function moved(): boolean {
      const pos = driving().position
      if (!pos) return false
      const last = lastPos.current
      if (!last) return true
      return distanceMeters(last.lat, last.lng, pos.lat, pos.lng) >= MARKER_MIN_MOVE_M
    }

    void fetchMarkers()
    const unsub = useDriving.subscribe((s, prev) => {
      if (s.position !== prev.position && moved()) void fetchMarkers()
      // A card just closed → force a refresh so the answered item moves to
      // seen_items and re-renders with the ✓ icon.
      if (prev.activeCard && !s.activeCard) void fetchMarkers(true)
      // The quest moved to another station, or the game mode changed (e.g.
      // quest → trivia): the pins on the map belong to the old state, so
      // refresh right away instead of waiting for the next movement-gated poll.
      const q = s.config?.quest
      const pq = prev.config?.quest
      if (
        q?.user_next_station !== pq?.user_next_station ||
        q?.next_station_name !== pq?.next_station_name ||
        !!s.config?.is_road_quest !== !!prev.config?.is_road_quest
      ) {
        void fetchMarkers(true)
      }
    })
    const tick = setInterval(() => {
      if (moved()) void fetchMarkers()
    }, MARKER_POLL_MS)

    return () => {
      unsub()
      clearInterval(tick)
    }
  }, [active])
}
