import { useEffect, useRef } from 'react'
import { useDriving } from '../../../store/driving'
import { useSession } from '../../../store/session'
import { reportEvents, NEXT_EVENT } from '../../../api/endpoints'
import { APP_VERSION } from '../../../config'
import type { RoadPoint } from '../../../types'

// Renders a quest/Babylon item using the backend's own item HTML — the complete
// original experience (narrator + professor avatar + audio, pattern-lock grid,
// speech recorder, destination setup). We do NOT rebuild these in React.
//
// IMPORTANT: we load via a real same-origin URL (src), never srcdoc. The item
// signals events by HASH navigation (window.location.href = "#/answer?..."),
// and a srcdoc document's base is the PARENT url — so "#/x" would resolve to
// /drive#/x and recursively load the whole app into the iframe. With a real
// /api/... src, "#/x" stays a same-document hash change we can read and bridge
// to /v2/events (mirroring the old Android WebView's GameWebViewEvent). The
// backend serves these with domain_url="#" for client=web.
//
// Two shapes arrive:
//  - content items (narrator/pattern_lock/recorder): real DB id → /api/item/<id>
//  - redirect wrappers (e.g. quest destination setup): a synthetic, per-fetch id
//    (so /item/<id> 404s to empty) whose tiny html_payload only redirects to
//    e.g. /personal_page. We follow that redirect URL directly as the src.

interface Props {
  point: RoadPoint
}

// Rewrite the dead native hosts to the /api proxy (revive).
function toProxy(url: string): string {
  return url
    .replace(/https?:\/\/app\.premium\.roadio\.io/g, '/api')
    .replace(/https?:\/\/www\.roadio\.io/g, '/api')
}

// A tiny payload whose sole purpose is to redirect → return its (proxied)
// target so we can load it directly. Content items (large, with location.href
// only inside functions) return null.
function redirectTarget(html: string | null | undefined): string | null {
  if (!html || html.length > 2000) return null
  const m = html.match(/location\.href\s*=\s*["']([^"']+)["']/)
  return m ? toProxy(m[1]) : null
}

export default function QuestItemFrame({ point }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const userId = useSession((s) => s.userId)
  const setHud = useSession((s) => s.setHud)
  const position = useDriving((s) => s.position)
  const dismissActive = useDriving((s) => s.dismissActive)
  const setResult = useDriving((s) => s.setResult)

  const redir = redirectTarget(point.html_payload)
  const src =
    redir ??
    `/api/item/${point.id}?version=${APP_VERSION}&user_id=${encodeURIComponent(userId)}&client=web`

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
      // 'footer' (hide/show) and 'update_config' are no-ops here.
    }

    function attachHashListener() {
      const win = iframe?.contentWindow
      if (!win) return undefined
      const onHash = () => {
        let raw = ''
        try {
          raw = win.location.hash // e.g. "#/answer?answer=next_event&..."
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
          // window navigated away — listener is gone with it.
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
      // cross-origin readyState — wait for the load event.
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
        title={point.question ?? 'quest item'}
        className="quest-frame-iframe"
      />
    </div>
  )
}
