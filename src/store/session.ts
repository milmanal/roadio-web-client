// Global session state: identity + the latest server-driven values shown in
// the HUD (score / rank / next point). Game queue + driving state land here in
// later phases.

import { create } from 'zustand'
import { getDeviceId } from '../lib/deviceId'
import { DEFAULT_LOCALE } from '../config'
import type { Locale } from '../lib/i18n'

interface SessionState {
  userId: string
  locale: Locale
  // HUD values (strings, as the backend returns them)
  score: string
  rank: string
  nextItemKm: string
  username: string
  setLocale: (l: Locale) => void
  setHud: (h: Partial<Pick<SessionState, 'score' | 'rank' | 'nextItemKm' | 'username'>>) => void
}

export const useSession = create<SessionState>((set) => ({
  userId: getDeviceId(),
  locale: DEFAULT_LOCALE as Locale,
  score: '0',
  rank: '-',
  nextItemKm: '-',
  username: '',
  setLocale: (locale) => set({ locale }),
  setHud: (h) => set(h),
}))
