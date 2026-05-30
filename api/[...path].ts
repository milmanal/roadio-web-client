// Production BFF / reverse-proxy (Vercel Edge Function).
//
// Mirrors the Vite dev/preview proxy: the browser calls same-origin `/api/*`
// with NO credentials; this function rewrites to the backend root and injects
// the HTTP Basic header server-side, so the secret never reaches the client.
//
// Env (set in the Vercel project, NOT committed):
//   BACKEND_URL, BACKEND_BASIC_USER, BACKEND_BASIC_PASS
//
// Vercel auto-mounts this catch-all at /api/* — no route config needed.

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
  // /api/v2/items?x=1  ->  <backend>/v2/items?x=1
  const target = BACKEND + url.pathname.replace(/^\/api/, '') + url.search

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
  // API responses are dynamic + auth'd — never cache.
  respHeaders.set('cache-control', 'no-store')

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}
