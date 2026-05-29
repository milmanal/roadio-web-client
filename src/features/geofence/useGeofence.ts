// Watches the driving position against backend-defined geofences and plays a
// fence's quiz when the user enters its radius. Each fence fires at most once
// per session (dedup by lat/lng/quiz key). Wired into DrivePage while driving
// is active.

import { useEffect, useRef } from 'react'
import { useDriving } from '../../store/driving'
import { getGeofences } from '../../api/endpoints'
import { playQuiz } from '../quiz/playQuiz'
import { distanceMeters } from '../../lib/geo'
import type { GeofenceResponse } from '../../types'

function fenceKey(f: GeofenceResponse): string {
  return `${f.lat},${f.lng},${f.quiz ?? ''}`
}

export function useGeofence(active: boolean) {
  const fencesRef = useRef<GeofenceResponse[]>([])
  const firedRef = useRef<Set<string>>(new Set())
  const playingRef = useRef(false)

  useEffect(() => {
    if (!active) {
      fencesRef.current = []
      firedRef.current = new Set()
      return
    }

    let cancelled = false

    // Load fence definitions once we have a position to anchor the query.
    async function loadFences() {
      const pos = useDriving.getState().position
      if (!pos) return
      try {
        const fences = await getGeofences({
          lat: String(pos.lat),
          lng: String(pos.lng),
        })
        if (!cancelled) fencesRef.current = Array.isArray(fences) ? fences : []
      } catch {
        // Transient error — keep any fences we already have.
      }
    }

    async function checkFences() {
      if (playingRef.current) return
      const pos = useDriving.getState().position
      if (!pos) return
      for (const fence of fencesRef.current) {
        if (!fence.quiz) continue
        const key = fenceKey(fence)
        if (firedRef.current.has(key)) continue
        const d = distanceMeters(
          pos.lat,
          pos.lng,
          Number(fence.lat),
          Number(fence.lng),
        )
        if (d <= fence.radius) {
          firedRef.current.add(key)
          playingRef.current = true
          try {
            await playQuiz({ quizId: fence.quiz, quizName: fence.title })
          } catch {
            // Allow re-fire on a later pass if the play failed entirely.
            firedRef.current.delete(key)
          } finally {
            playingRef.current = false
          }
          break
        }
      }
    }

    void loadFences().then(() => {
      if (!cancelled) void checkFences()
    })

    // Re-check on every new position fix.
    const unsub = useDriving.subscribe((s, prev) => {
      if (s.position !== prev.position) void checkFences()
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [active])
}
