// Proximity loop: when the car comes within TRIGGER_RADIUS_M of a live-map
// road point (a `useMarkers().items` pin carrying an item_id), pull that one
// item's full content from /v2/items?item_id=… and push it onto the card queue.
// Mirrors useGeofence's getState/interval pattern (no React deps, no stale
// closures). triggerItems already dedups by RoadPoint.id; we also track fired
// item_ids here so we don't re-fetch the same pin while parked beside it.

import { useEffect, useRef } from 'react'
import { useDriving } from '../../store/driving'
import { useSession } from '../../store/session'
import { useMarkers } from '../../store/markers'
import { fetchItems } from '../../api/endpoints'
import { distanceMeters } from '../../lib/geo'

const TRIGGER_RADIUS_M = 100
const CHECK_MS = 3000

export function useProximity(active: boolean) {
  const fired = useRef<Set<number>>(new Set())
  const inFlight = useRef(false)

  useEffect(() => {
    if (!active) return
    const driving = useDriving.getState
    const session = useSession.getState
    const markers = useMarkers.getState

    async function check() {
      if (inFlight.current) return
      // Don't stack a new card on top of an open one.
      if (driving().activeCard) return
      const pos = driving().position
      if (!pos) return

      const candidate = markers().items.find((m) => {
        if (m.item_id == null) return false
        if (fired.current.has(m.item_id)) return false
        const lat = Number(m.lat)
        const lng = Number(m.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
        return distanceMeters(pos.lat, pos.lng, lat, lng) <= TRIGGER_RADIUS_M
      })
      if (!candidate || candidate.item_id == null) return

      const itemId = candidate.item_id
      fired.current.add(itemId)
      inFlight.current = true
      try {
        const res = await fetchItems({
          user_id: session().userId,
          item_id: itemId,
          lat: pos.lat,
          lng: pos.lng,
          locale: session().locale,
        })
        if (res.items?.length) {
          driving().triggerItems(res.items)
          // dynamic import keeps Sounds out of the hot path
          import('../../lib/sounds').then(({ Sounds }) => Sounds.proximity())
        }
      } catch {
        // transient — allow a retry on a later pass
        fired.current.delete(itemId)
      } finally {
        inFlight.current = false
      }
    }

    void check()
    const unsub = useDriving.subscribe((s, prev) => {
      if (s.position !== prev.position) void check()
    })
    const id = setInterval(check, CHECK_MS)
    return () => {
      unsub()
      clearInterval(id)
    }
  }, [active])
}
