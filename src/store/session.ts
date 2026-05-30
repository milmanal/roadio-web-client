// Global session state: identity + the latest server-driven values shown in
// the HUD (score / rank / next point). Game queue + driving state land here in
// later phases.

import { create } from 'zustand'
import { getDeviceId } from '../lib/deviceId'
import { DEFAULT_LOCALE } from '../config'
import type { Locale } from '../lib/i18n'

type HudKeys =
  | 'score'
  | 'rank'
  | 'nextItemKm'
  | 'username'
  | 'userLabel'
  | 'avatar'
  | 'broadcast'
  | 'gameName'

interface SessionState {
  userId: string
  locale: Locale
  // HUD values (strings, as the backend returns them)
  score: string // "Points"
  rank: string // "Place"
  nextItemKm: string
  username: string
  userLabel: string
  avatar: string | null // profile_image / avatar character
  broadcast: string | null // promo / status strip text
  gameName: string | null // active game ("current game")
  setLocale: (l: Locale) => void
  setHud: (h: Partial<Pick<SessionState, HudKeys>>) => void
}

export const useSession = create<SessionState>((set) => ({
  userId: getDeviceId(),
  locale: DEFAULT_LOCALE as Locale,
  score: '0',
  rank: '-',
  nextItemKm: '-',
  username: '',
  userLabel: '',
  avatar: null,
  broadcast: null,
  gameName: null,
  setLocale: (locale) => set({ locale }),
  setHud: (h) => set(h),
}))
