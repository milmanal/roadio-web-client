import { useEffect, useRef } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import type { RoadPoint } from '../../../types'

/**
 * No UI: acknowledges an empty quiz follow-up item the way tapping its single
 * button used to (send its answer, then next_event) and closes it at once.
 */
export default function AutoAck({ point }: { point: RoadPoint }) {
  const dismiss = useDriving((s) => s.dismissActive)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const pos = useDriving.getState().position
    const base = {
      user_id: useSession.getState().userId,
      lat: pos ? String(pos.lat) : null,
      lng: pos ? String(pos.lng) : null,
    }
    const answer = point.right_answer?.trim() || (point.answers ?? []).find(Boolean)
    const id = String(point.id)
    void (async () => {
      try {
        if (answer) await reportEvents({ ...base, events: { [id]: { answer } } })
        await reportEvents({ ...base, events: { [id]: { answer: NEXT_EVENT } } })
      } catch {
        // closing locally regardless
      }
    })()
    dismiss()
  }, [point, dismiss])

  return null
}
