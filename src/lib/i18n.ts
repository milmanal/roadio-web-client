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
    babylonTitle: 'מכונת בבל',
    babylonIntro:
      'משחק נהיגה פרימיום עם הדרכה אישית בוואטסאפ. השאירו פרטים ונשלח לכם קישור להתחלת המסע.',
    namePlaceholder: 'שם מלא',
    phonePlaceholder: 'מספר טלפון',
    sendDetails: 'שלחו לי קישור',
    sending: 'שולח…',
    schedule: 'קביעת תאריך (לא חובה)',
    scheduleSubmit: 'קבעו לי תאריך',
    babylonError: 'אירעה שגיאה. נסו שוב.',
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
    babylonTitle: 'Babel Machine',
    babylonIntro:
      'A premium driving quest with personal WhatsApp onboarding. Leave your details and we will send you a link to start.',
    namePlaceholder: 'Full name',
    phonePlaceholder: 'Phone number',
    sendDetails: 'Send me a link',
    sending: 'Sending…',
    schedule: 'Schedule a date (optional)',
    scheduleSubmit: 'Schedule me',
    babylonError: 'Something went wrong. Try again.',
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
