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
  const dismissActive = useDriving((s) => s.dismissActive)
  const advancedRef = useRef(false)

  // NOTE: position is read at report time, not subscribed to. It changes every
  // ~2s while driving; as an effect dependency it restarted the clip from 0
  // (and reset the fallback timer) on every GPS fix.
  useEffect(() => {
    async function advance() {
      if (advancedRef.current) return
      advancedRef.current = true
      const pos = useDriving.getState().position
      const latlng = {
        lat: pos ? String(pos.lat) : null,
        lng: pos ? String(pos.lng) : null,
      }
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
    let cancelled = false
    const audio = new Audio(url)
    audio.onended = () => void advance()
    // Fallback: if metadata never loads or playback stalls, advance after a
    // bounded wait so the queue never stalls. Once the clip's length is known,
    // wait for the whole clip (+ margin) — transition clips can exceed 30s.
    let fallback = window.setTimeout(() => void advance(), 30000)
    audio.onloadedmetadata = () => {
      if (cancelled || !Number.isFinite(audio.duration)) return
      window.clearTimeout(fallback)
      fallback = window.setTimeout(() => void advance(), (audio.duration + 5) * 1000)
    }
    audio.play().catch((err: unknown) => {
      // Our own cleanup paused the clip (unmount / StrictMode re-run) — that
      // rejects play() with AbortError and is NOT a reason to skip the clip.
      if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
      // Autoplay genuinely blocked — skip rather than stall.
      void advance()
    })
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
      audio.pause()
    }
  }, [point.id, point.question_voice, userId, dismissActive])

  return null
}
