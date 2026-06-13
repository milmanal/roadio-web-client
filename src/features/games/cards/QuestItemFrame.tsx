import { useEffect, useRef } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import { APP_VERSION } from '../../../config'
import type { RoadPoint } from '../../../types'

// Renders a quest/Babylon item using the backend's own item HTML — the complete
// original experience (narrator + professor avatar + audio, pattern-lock grid,
// speech recorder, destination setup, etc.). We do NOT rebuild these in React.
//
// Poll-delivered quest items embed their full HTML in `html_payload`, but their
// `id` is synthetic/ephemeral (changes every fetch) so GET /item/<id> 404s to
// empty → blank. So we render the embedded payload via srcdoc instead, and:
//  - rewrite domain_url to "#", so the item signals events by HASH navigation
//    (window.location.href = "#/answer?...") rather than leaving the page;
//  - rewrite the dead app.premium.roadio.io / www.roadio.io hosts to /api so
//    its AJAX + redirects (make_a_call, destination setup) hit revive via proxy.
// srcdoc iframes inherit our origin, so we can read hashchange and bridge to
// /v2/events — mirroring the old Android WebView (GameWebViewEvent).
// Fallback: items without html_payload but with a real DB id load /item/<id>.

interface Props {
  point: RoadPoint
}

// Make an embedded item payload talk to us (hash events) and to revive (/api).
function bridgePayload(html: string): string {
  return html
    .replace(/domain_url\s*=\s*["'][^"']*["']/g, 'domain_url = "#"')
    .replace(/https?:\/\/app\.premium\.roadio\.io/g, '/api')
    .replace(/https?:\/\/www\.roadio\.io/g, '/api')
}

export default function QuestItemFrame({ point }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const userId = useSession((s) => s.userId)
  const setHud = useSession((s) => s.setHud)
  const position = useDriving((s) => s.position)
  const dismissActive = useDriving((s) => s.dismissActive)
  const setResult = useDriving((s) => s.setResult)

  const payload = point.html_payload
  const srcDoc = payload ? bridgePayload(payload) : undefined
  // Fallback only when there's no embedded payload (real DB id items).
  const src = payload
    ? undefined
    : `/api/item/${point.id}?version=${APP_VERSION}&user_id=${encodeURIComponent(userId)}&client=web`

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
      } else if (evType === 'next') {
        void advance()
      }
      // 'footer' (hide/show) and 'update_config' are no-ops until the quest
      // map chrome consumes them.
    }

    // The item navigates its OWN window hash. srcdoc/same-origin via the proxy,
    // so we can read the iframe's contentWindow once it loads. Guarded: a stray
    // cross-origin navigation must never throw into React.
    function attachHashListener() {
      const win = iframe?.contentWindow
      if (!win) return undefined
      const onHash = () => {
        let raw = ''
        try {
          raw = win.location.hash
        } catch {
          return // cross-origin — ignore
        }
        if (!raw || raw === lastHash) return
        lastHash = raw
        const body = raw.replace(/^#\/?/, '')
        const qIdx = body.indexOf('?')
        const evType = qIdx === -1 ? body : body.slice(0, qIdx)
        const qs = qIdx === -1 ? '' : body.slice(qIdx + 1)
        void handleEvent(evType, new URLSearchParams(qs))
      }
      win.addEventListener('hashchange', onHash)
      return () => {
        try {
          win.removeEventListener('hashchange', onHash)
        } catch {
          // window navigated cross-origin — listener is already gone with it.
        }
      }
    }

    let detach: (() => void) | undefined
    const onLoad = () => {
      detach?.()
      detach = attachHashListener()
    }
    iframe.addEventListener('load', onLoad)
    try {
      if (iframe.contentWindow?.document?.readyState === 'complete') onLoad()
    } catch {
      // cross-origin readyState access — wait for the load event instead.
    }

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
        srcDoc={srcDoc}
        title={point.question ?? 'quest item'}
        className="quest-frame-iframe"
      />
    </div>
  )
}
