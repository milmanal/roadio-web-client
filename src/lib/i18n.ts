// Minimal locale/direction helper. The backend supplies most user-facing
// strings (labels, questions) already localized, so this only covers app-shell
// chrome and document direction. Hebrew ('he') is RTL.

import { DEFAULT_LOCALE } from '../config'

export type Locale = 'he' | 'en'

const RTL_LOCALES: Locale[] = ['he']

const STRINGS: Record<Locale, Record<string, string>> = {
  he: {
    drive: 'נהיגה',
    daily: 'חידון יומי',
    babylon: 'בבל',
    score: 'ניקוד',
    rank: 'דירוג',
    nextItem: 'נקודה הבאה',
    start: 'התחל',
    settings: 'הגדרות',
    loading: 'טוען…',
    quizError: 'טעינת החידונים נכשלה. נסו שוב.',
    noQuizzes: 'אין חידונים זמינים כרגע.',
    noQuizItems: 'אין שאלות בחידון הזה כרגע.',
  },
  en: {
    drive: 'Drive',
    daily: 'Daily Quiz',
    babylon: 'Babylon',
    score: 'Score',
    rank: 'Rank',
    nextItem: 'Next point',
    start: 'Start',
    settings: 'Settings',
    loading: 'Loading…',
    quizError: 'Failed to load quizzes. Try again.',
    noQuizzes: 'No quizzes available right now.',
    noQuizItems: 'This quiz has no questions right now.',
  },
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}

export function applyLocale(locale: Locale) {
  const dir = dirFor(locale)
  document.documentElement.lang = locale
  document.documentElement.dir = dir
}

export function t(key: string, locale: Locale = DEFAULT_LOCALE as Locale): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key
}
