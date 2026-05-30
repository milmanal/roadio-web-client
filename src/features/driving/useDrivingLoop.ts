// Orchestrates the core gameplay loop while driving:
//   position fix -> (gated by distance/time) POST /v2/items -> update HUD +
//   config + items -> proximity engine enqueues nearby cards.
//
// Fetch gating mirrors the Android client's config knobs:
//   location_update_meters  - min distance moved before refetching
//   location_update_ms      - max time between refetches (also the poll tick)

import { useEffect, useRef } from 'react'
import { useDriving } from '../../store/driving'
import { useSession } from '../../store/session'
import { fetchItems } from '../../api/endpoints'
import { distanceMeters } from '../../lib/geo'
import type { Position } from '../../store/driving'

const DEFAULT_UPDATE_MS = 8000
const DEFAULT_UPDATE_METERS = 50
const MIN_POLL_MS = 4000

export function useDrivingLoop(active: boolean) {
  const lastFetchPos = useRef<Position | null>(null)
  const lastFetchAt = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!active) {
      lastFetchPos.current = null
      lastFetchAt.current = 0
      return
    }

    const driving = useDriving.getState
    const session = useSession.getState

    async function doFetch() {
      if (inFlight.current) return
      const pos = driving().position
      if (!pos) return
      inFlight.current = true
      try {
        const res = await fetchItems({
          user_id: session().userId,
          lat: String(pos.lat),
          lng: String(pos.lng),
          locale: session().locale,
          isDriving: true,
        })
        lastFetchPos.current = pos
        lastFetchAt.current = Date.now()

        // HUD + config
        session().setHud({
          score: String(res.points ?? res.score ?? '0'),
          rank: String(res.rank ?? '-'),
          nextItemKm: String(res.next_item_km ?? '-'),
          username: res.username ?? '',
          userLabel: res.user_label ?? '',
          avatar: res.configuration?.profile_image ?? null,
          broadcast: typeof res.broadcast === 'string' ? res.broadcast : null,
          gameName: res.configuration?.game_name ?? null,
        })
        if (res.configuration) driving().setConfig(res.configuration)
        const items = res.items ?? []
        driving().setItems(items)

        // The backend already proximity-filters items for the posted position,
        // so trigger everything it returned (the store dedups by id).
        if (items.length) driving().triggerItems(items)
      } catch {
        // Transient network/backend error: keep driving, retry next tick.
      } finally {
        inFlight.current = false
      }
    }

    function shouldFetch(): boolean {
      const pos = driving().position
      if (!pos) return false
      const last = lastFetchPos.current
      if (!last) return true
      const cfg = driving().config
      const minMeters = Number(cfg?.location_update_meters) || DEFAULT_UPDATE_METERS
      const maxMs = Number(cfg?.location_update_ms) || DEFAULT_UPDATE_MS
      const moved = distanceMeters(last.lat, last.lng, pos.lat, pos.lng)
      const elapsed = Date.now() - lastFetchAt.current
      return moved >= minMeters || elapsed >= maxMs
    }

    // Initial fetch as soon as we have a position.
    void doFetch()

    // React to new fixes (gated) + a steady poll tick as a fallback.
    const unsub = useDriving.subscribe((s, prev) => {
      if (s.position !== prev.position && shouldFetch()) void doFetch()
    })
    const pollMs = Math.max(
      MIN_POLL_MS,
      Number(driving().config?.location_update_ms) || DEFAULT_UPDATE_MS,
    )
    const tick = setInterval(() => {
      if (shouldFetch()) void doFetch()
    }, pollMs)

    return () => {
      unsub()
      clearInterval(tick)
    }
  }, [active])
}
