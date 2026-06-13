import { useEffect, useRef } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import { APP_VERSION } from '../../../config'
import type { RoadPoint } from '../../../types'

// Renders a quest/Babylon item by iframing the backend's own item HTML
// (GET /item/<id>), which is the complete original experience — narrator with
// professor avatar + audio, the pattern-lock photo grid, the speech recorder,
// etc. We do NOT rebuild these in React.
//
// client=web is required: it makes the template set domain_url="#", so the item
// signals events by HASH navigation (window.location.href = "#/answer?...")
// instead of leaving the page. The iframe is same-origin (served via the /api
// proxy), so we read its hashchange and bridge to /v2/events — mirroring what
// the old Android WebView did via GameWebViewEvent.
//
// NOTE: gen_item_url on the backend points at the dead app.premium.roadio.io
// host, so we ignore point.url and build the proxied URL ourselves.

interface Props {
  point: RoadPoint
}

export default function QuestItemFrame({ point }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const userId = useSession((s) => s.userId)
  const setHud = useSession((s) => s.setHud)
  const position = useDriving((s) => s.position)
  const dismissActive = useDriving((s) => s.dismissActive)
  const setResult = useDriving((s) => s.setResult)

  const src = `/api/item/${point.id}?version=${APP_VERSION}&user_id=${encodeURIComponent(
    userId,
  )}&client=web`

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const latlng = {
      lat: position ? String(position.lat) : null,
      lng: position ? String(position.lng) : null,
    }
    let lastHash = ''
    let advancing = false

    async function advance() {
      if (advancing) return
      advancing = true
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

    async function handleEvent(evType: string, params: URLSearchParams) {
      if (evType === 'answer') {
        const answer = params.get('answer') ?? ''
        if (answer === NEXT_EVENT) {
          void advance()
          return
        }
        // The seen_id the item wants marked/scored (falls back to item id).
        const seenId = params.get('seen_id') || String(point.id)
        const isRight = params.get('is_right') === 'true'
        setResult(point.id, isRight)
        try {
          const res = await reportEvents({
            user_id: userId,
            ...latlng,
            events: { [seenId]: { answer } },
          })
          setHud({ score: String(res.score), rank: String(res.rank) })
        } catch {
          // ignore — the item shows its own feedback then sends next_event
        }
      }
      // 'footer' (hide/show) and 'update_config' are no-ops until the quest
      // map chrome exists (Phase 2).
    }

    // The item navigates its OWN window hash. Same-origin via the proxy, so we
    // can listen on the iframe's contentWindow once it has loaded.
    function attachHashListener() {
      const win = iframe?.contentWindow
      if (!win) return
      const onHash = () => {
        const raw = win.location.hash // e.g. "#/answer?answer=next_event&..."
        if (!raw || raw === lastHash) return
        lastHash = raw
        const body = raw.replace(/^#\/?/, '')
        const qIdx = body.indexOf('?')
        const evType = qIdx === -1 ? body : body.slice(0, qIdx)
        const qs = qIdx === -1 ? '' : body.slice(qIdx + 1)
        void handleEvent(evType, new URLSearchParams(qs))
      }
      win.addEventListener('hashchange', onHash)
      return () => win.removeEventListener('hashchange', onHash)
    }

    let detach: (() => void) | undefined
    const onLoad = () => {
      detach?.()
      detach = attachHashListener()
    }
    iframe.addEventListener('load', onLoad)
    // If it already loaded before this effect ran.
    if (iframe.contentWindow?.document?.readyState === 'complete') onLoad()

    return () => {
      iframe.removeEventListener('load', onLoad)
      detach?.()
    }
  }, [point.id, userId, position, dismissActive, setHud, setResult])

  return (
    <div className="quest-frame">
      <iframe
        ref={iframeRef}
        src={src}
        title={point.question ?? 'quest item'}
        className="quest-frame-iframe"
      />
    </div>
  )
}
