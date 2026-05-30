# Deploy

The browser must never hold the backend's HTTP Basic credentials, and the
`/v2,/v3` routes have no browser-safe auth. So production uses a **BFF /
reverse-proxy** (same pattern as the Vite dev/preview proxy): the SPA calls
same-origin `/api/*` with no creds; the proxy injects the Basic header
server-side and forwards to the backend.

## Vercel (configured)

- `api/[...path].ts` — Edge Function, auto-mounted at `/api/*`. Rewrites
  `/api/v2/items` → `<BACKEND_URL>/v2/items` and injects `Authorization: Basic`.
- `vercel.json` — builds with Vite, serves `dist/`, and SPA-rewrites all
  non-`/api/` paths to `index.html` (real static files bypass the rewrite).

**Set these env vars in the Vercel project** (Settings → Environment Variables —
do NOT commit them):

| Var | Value |
|---|---|
| `BACKEND_URL` | `https://roadio-revive-ede3dca3face.herokuapp.com` |
| `BACKEND_BASIC_USER` | `shinom` |
| `BACKEND_BASIC_PASS` | `iloveToRide` |
| `VITE_MAPBOX_TOKEN` | your Mapbox token (this one IS bundled — URL-restrict it) |

Deploy: `vercel` (or connect the repo). The client + proxy share one origin, so
no CORS and no credentials in the browser.

## Netlify (alternative)

Equivalent setup if you prefer Netlify:
- `netlify.toml`: `[build] command="npm run build" publish="dist"`, an SPA
  redirect `/* /index.html 200` (after an `/api/*` rule), and
- a Netlify Edge/Function at `/api/*` doing the same rewrite + Basic injection
  as `api/[...path].ts`. (Not committed — add if Netlify is chosen.)

## Notes

- `configuration.premium_url` (the dead `app.roadio.io` webview) is **not used**
  — Babylon renders natively (`BabylonPage`). Safe to drop server-side.
- See `BACKEND_NEEDS.md` for remaining backend-side items.
