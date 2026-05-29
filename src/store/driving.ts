// Driving/game state: live position, the road points the backend returned for
// our path, and the queue of cards that proximity has triggered.

import { create } from 'zustand'
import type { Configuration, RoadPoint } from '../types'

export interface Position {
  lat: number
  lng: number
  accuracy?: number
  speed?: number | null
  ts: number
}

interface DrivingState {
  active: boolean
  position: Position | null
  config: Configuration | null
  items: RoadPoint[]
  /** Road-point ids already triggered or played — never re-trigger. */
  seenItemIds: Set<number>
  /** Cards waiting to be shown, in trigger order. */
  queue: RoadPoint[]
  activeCard: RoadPoint | null

  setActive: (active: boolean) => void
  setPosition: (p: Position) => void
  setConfig: (c: Configuration) => void
  setItems: (items: RoadPoint[]) => void
  /** Enqueue points not already seen; mark them seen. Returns count added. */
  triggerItems: (points: RoadPoint[]) => number
  /** Promote the next queued card to active if none is showing. */
  advance: () => void
  dismissActive: () => void
  reset: () => void
}

export const useDriving = create<DrivingState>((set, get) => ({
  active: false,
  position: null,
  config: null,
  items: [],
  seenItemIds: new Set(),
  queue: [],
  activeCard: null,

  setActive: (active) => set({ active }),
  setPosition: (position) => set({ position }),
  setConfig: (config) => set({ config }),
  setItems: (items) => set({ items }),

  triggerItems: (points) => {
    const seen = get().seenItemIds
    const fresh = points.filter((p) => !seen.has(p.id))
    if (fresh.length === 0) return 0
    const nextSeen = new Set(seen)
    fresh.forEach((p) => nextSeen.add(p.id))
    set({ seenItemIds: nextSeen, queue: [...get().queue, ...fresh] })
    get().advance()
    return fresh.length
  },

  advance: () => {
    const { activeCard, queue } = get()
    if (activeCard || queue.length === 0) return
    set({ activeCard: queue[0], queue: queue.slice(1) })
  },

  dismissActive: () => {
    set({ activeCard: null })
    get().advance()
  },

  reset: () =>
    set({
      active: false,
      items: [],
      seenItemIds: new Set(),
      queue: [],
      activeCard: null,
    }),
}))
