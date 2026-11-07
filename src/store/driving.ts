// Driving/game state: live position, the road points the backend returned for
// our path, and the queue of cards that proximity has triggered.

import { create } from 'zustand'
import type { Configuration, RoadPoint } from '../types'

export interface Position {
  lat: number
  lng: number
  accuracy?: number
  speed?: number | null
  heading?: number | null  // degrees from north (0-360), null when stationary
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
  /** Per-item answer result (true=correct) — drives the quiz progress bar. */
  results: Record<number, boolean>

  setActive: (active: boolean) => void
  setPosition: (p: Position) => void
  setConfig: (c: Configuration) => void
  setItems: (items: RoadPoint[]) => void
  /** Record an answered item's correctness (for the progress bar). */
  setResult: (id: number, correct: boolean) => void
  /** Enqueue points not already seen; mark them seen. Returns count added. */
  triggerItems: (points: RoadPoint[]) => number
  /** Promote the next queued card to active if none is showing. */
  advance: () => void
  dismissActive: () => void
  /** Mark ids as already played and drop them from the queue (e.g. items a
   *  quest frame chained to internally, so they don't replay as cards). */
  markSeen: (ids: number[]) => void
  /** Drop the open card and anything queued (e.g. after switching games). */
  clearCards: () => void
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
  results: {},

  setActive: (active) => set({ active }),
  setPosition: (position) => set({ position }),
  setConfig: (config) => set({ config }),
  // New item set (e.g. starting a quiz) resets the per-item results.
  setItems: (items) => set({ items, results: {} }),
  setResult: (id, correct) =>
    set((s) => ({ results: { ...s.results, [id]: correct } })),

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

  markSeen: (ids) => {
    if (ids.length === 0) return
    const nextSeen = new Set(get().seenItemIds)
    ids.forEach((id) => nextSeen.add(id))
    set({
      seenItemIds: nextSeen,
      queue: get().queue.filter((p) => !ids.includes(p.id)),
    })
  },

  clearCards: () => set({ queue: [], activeCard: null }),

  reset: () =>
    set({
      active: false,
      items: [],
      seenItemIds: new Set(),
      queue: [],
      activeCard: null,
      results: {},
    }),
}))

// Dev affordance: inspect/drive the store from the console (and Playwright).
if (import.meta.env.DEV) {
  ;(window as unknown as { __driving?: typeof useDriving }).__driving = useDriving
}
