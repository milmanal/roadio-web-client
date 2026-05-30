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

    async function fetchMarkers(force = false) {
      if (inFlight.current) return
      const pos = driving().position
      if (!pos) return
      // Respect the backend toggle once we have config.
      const cfg = driving().config
      if (cfg && cfg.fetch_markers === false) return
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
