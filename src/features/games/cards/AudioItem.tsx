import { useEffect, useRef } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import type { RoadPoint } from '../../../types'

// `audio` items are not HTML cards — they're between-station transition /
// narration clips. The original app played question_voice in the background
// and advanced; there's no UI. We mirror that: autoplay the clip, then advance
// when it ends (or after a fallback timeout if autoplay is blocked).
interface Props {
  point: RoadPoint
}

export default function AudioItem({ point }: Props) {
  const userId = useSession((s) => s.userId)
  const position = useDriving((s) => s.position)
  const dismissActive = useDriving((s) => s.dismissActive)
  const advancedRef = useRef(false)

  useEffect(() => {
    const latlng = {
      lat: position ? String(position.lat) : null,
      lng: position ? String(position.lng) : null,
    }
    async function advance() {
      if (advancedRef.current) return
      advancedRef.current = true
      try {
        await reportEvents({
          user_id: userId,
          ...latlng,
          events: { [String(point.id)]: { answer: NEXT_EVENT } },
        })
      } catch {
        // advance locally regardless
      }
      dismissActive()
    }

    const url = point.question_voice
    if (!url) {
      void advance()
      return
    }
    const audio = new Audio(url)
    audio.onended = () => void advance()
    // Fallback: if autoplay is blocked or metadata never loads, advance after
    // a bounded wait so the queue never stalls.
    const fallback = window.setTimeout(() => void advance(), 30000)
    audio.play().catch(() => {
      // Autoplay blocked — skip rather than stall.
      void advance()
    })
    return () => {
      window.clearTimeout(fallback)
      audio.pause()
    }
  }, [point.id, point.question_voice, userId, position, dismissActive])

  return null
}
