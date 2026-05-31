// Production BFF / reverse-proxy (Vercel Edge Function).
//
// The browser calls same-origin `/api/*` with NO credentials; vercel.json
// rewrites `/api/:path*` → `/api/proxy?path=:path*`, and this function forwards
// to the backend with the HTTP Basic header injected server-side. The secret
// never reaches the client (same role as the Vite dev/preview proxy).
//
// Env (set in the Vercel project, NOT committed):
//   BACKEND_URL, BACKEND_BASIC_USER, BACKEND_BASIC_PASS

export const config = { runtime: 'edge' }

const BACKEND =
  process.env.BACKEND_URL || 'https://roadio-revive-ede3dca3face.herokuapp.com'
const AUTH =
  'Basic ' +
  btoa(
    `${process.env.BACKEND_BASIC_USER || 'shinom'}:${
      process.env.BACKEND_BASIC_PASS || 'iloveToRide'
    }`,
  )

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  // The rewrite puts the real backend path in ?path=… ; the rest of the query
  // (e.g. ?locale=he) is merged in by Vercel and forwarded as-is.
  const params = new URLSearchParams(url.search)
  const path = params.get('path') ?? ''
  params.delete('path')
  const qs = params.toString()
  const target = `${BACKEND}/${path}${qs ? `?${qs}` : ''}`

  const headers = new Headers(req.headers)
  headers.set('authorization', AUTH)
  headers.delete('host')
  headers.delete('cookie')

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  const upstream = await fetch(target, init)
  const respHeaders = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) respHeaders.set('content-type', ct)
  respHeaders.set('cache-control', 'no-store')

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}
