import { useState } from 'react'
import type { FormEvent } from 'react'
import { bavelOrder, gameWebSchedule } from '../api/endpoints'
import { useSession } from '../store/session'
import { t } from '../lib/i18n'
import './BabylonPage.css'

export default function BabylonPage() {
  const { locale } = useSession()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pickedDate, setPickedDate] = useState('')

  const [ordering, setOrdering] = useState(false)
  const [scheduling, setScheduling] = useState(false)

  // Backend `message` may contain trusted HTML (<br>, <a href>). We render it
  // verbatim like WebGameCard does. `status` is unreliable (always "success"),
  // so success/error UI is driven only by whether a message came back.
  const [orderMsg, setOrderMsg] = useState<string | null>(null)
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)

  async function onOrder(e: FormEvent) {
    e.preventDefault()
    if (ordering) return
    setOrdering(true)
    setOrderMsg(null)
    try {
      const res = await bavelOrder({
        username: name.trim(),
        phone_number: phone.trim(),
      })
      setOrderMsg(res.message || '')
    } catch {
      setOrderMsg(t('babylonError', locale))
    } finally {
      setOrdering(false)
    }
  }

  async function onSchedule(e: FormEvent) {
    e.preventDefault()
    if (scheduling) return
    setScheduling(true)
    setScheduleMsg(null)
    try {
      const res = await gameWebSchedule({
        username: name.trim(),
        phone_number: phone.trim(),
        picked_date: pickedDate,
      })
      setScheduleMsg(res.message || '')
    } catch {
      setScheduleMsg(t('babylonError', locale))
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="page page-body">
      <h1>{t('babylonTitle', locale)}</h1>
      <p className="muted babylon-intro">{t('babylonIntro', locale)}</p>

      <form className="babylon-form" onSubmit={onOrder}>
        <input
          className="babylon-input"
          type="text"
          placeholder={t('namePlaceholder', locale)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          className="babylon-input"
          type="tel"
          placeholder={t('phonePlaceholder', locale)}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <button type="submit" disabled={ordering}>
          {ordering ? t('sending', locale) : t('sendDetails', locale)}
        </button>
      </form>

      {orderMsg != null && (
        <div
          className="conn babylon-msg"
          dangerouslySetInnerHTML={{ __html: orderMsg }}
        />
      )}

      <form className="babylon-form babylon-schedule" onSubmit={onSchedule}>
        <label className="muted small babylon-label" htmlFor="babylon-date">
          {t('schedule', locale)}
        </label>
        <input
          id="babylon-date"
          className="babylon-input"
          type="date"
          value={pickedDate}
          onChange={(e) => setPickedDate(e.target.value)}
        />
        <button type="submit" disabled={scheduling || !pickedDate}>
          {scheduling ? t('sending', locale) : t('scheduleSubmit', locale)}
        </button>
      </form>

      {scheduleMsg != null && (
        <div
          className="conn babylon-msg"
          dangerouslySetInnerHTML={{ __html: scheduleMsg }}
        />
      )}
    </div>
  )
}
