// Live-map markers from POST /v3/map_markers, grouped by layer.

import { create } from 'zustand'
import type { MapMarker } from '../types'

interface MarkersState {
  cars: MapMarker[]
  items: MapMarker[]
  missions: MapMarker[]
  openMissions: MapMarker[]
  completedMissions: MapMarker[]
  seenItems: MapMarker[]
  setAll: (m: Partial<Omit<MarkersState, 'setAll' | 'clear'>>) => void
  /** Drop every marker (e.g. after switching games, before the refetch). */
  clear: () => void
}

export const useMarkers = create<MarkersState>((set) => ({
  cars: [],
  items: [],
  missions: [],
  openMissions: [],
  completedMissions: [],
  seenItems: [],
  setAll: (m) => set(m),
  clear: () =>
    set({
      cars: [],
      items: [],
      missions: [],
      openMissions: [],
      completedMissions: [],
      seenItems: [],
    }),
}))
