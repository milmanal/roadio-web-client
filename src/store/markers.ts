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
  setAll: (m: Partial<Omit<MarkersState, 'setAll'>>) => void
}

export const useMarkers = create<MarkersState>((set) => ({
  cars: [],
  items: [],
  missions: [],
  openMissions: [],
  completedMissions: [],
  seenItems: [],
  setAll: (m) => set(m),
}))
