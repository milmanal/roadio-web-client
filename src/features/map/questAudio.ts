// Quest background-music state. The Babylon map plays a looping ambience track
// (Configuration.quest.map_music); the player can mute it from the map overlay.
// Mute is shared between the overlay button and the music hook, so it lives in
// its own tiny store. Persisted so the choice survives reloads.

import { create } from 'zustand'

const KEY = 'roadio.quest.muted'

interface QuestAudioState {
  muted: boolean
  toggleMuted: () => void
}

export const useQuestAudio = create<QuestAudioState>((set, get) => ({
  muted: (() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })(),
  toggleMuted: () => {
    const next = !get().muted
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // storage unavailable — keep in-memory only
    }
    set({ muted: next })
  },
}))
