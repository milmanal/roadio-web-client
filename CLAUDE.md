# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roadio Web Client — a mobile-first PWA reincarnation of the Roadio Android driving game (taken off the Play/App stores ~2023). It talks to the revived Flask backend that lives at `../roadio-master/roadio` (see that repo's own `CLAUDE.md`). The game: while driving, the app polls GPS + the backend, which returns location-based "road points" along your path; proximity triggers a game card (trivia / number-guess / geo-guess / story / video / webview), you answer, and score/rank update. Also has a standalone daily quiz, geofence-triggered quizzes, and a premium "Babylon" webview game. UI is mobile-portrait and defaults to Hebrew (RTL).

Stack: React + Vite + TypeScript, PWA (vite-plugin-pwa), react-router, zustand, Mapbox GL JS.

## Commands

```bash
npm run dev       # Vite dev server on :5173 (also exposes on LAN via host:true)
npm run build     # tsc -b + vite build (also the typecheck gate)
npm run preview   # serve the production build
npm run lint      # eslint
```

There is no test runner wired yet.

## Backend connection (critical)

The browser must NOT hold the backend's HTTP Basic credentials, and the backend has no CORS for these routes. So **all backend calls are prefixed with `/api` and forwarded by a proxy** (`vite.config.ts`, shared by both the dev server AND `vite preview`), which:
- rewrites `/api/*` → backend root, and
- injects `Authorization: Basic base64(BACKEND_BASIC_USER:BACKEND_BASIC_PASS)`.

**Default backend is the LIVE Heroku URL** (baked into `vite.config.ts`, no `.env.local` needed) — `npm run dev` and `npm run preview` both hit remote out of the box. Set `BACKEND_URL=http://localhost:5050` in `.env.local` to target a local Flask backend instead. Note `vite preview` serves the production `dist/` build, so that's how you test the built app against remote; a standalone static deploy still needs its own reverse proxy/BFF serving `/api` with auth (the proxy only runs under dev/preview).

Configure via `.env.local` (copy from `.env.example`): `BACKEND_URL`, `BACKEND_BASIC_USER`, `BACKEND_BASIC_PASS`, `VITE_MAPBOX_TOKEN`. Only `VITE_`-prefixed vars reach client code; the Basic creds stay in the proxy. **Production needs an equivalent reverse proxy / BFF** serving `/api` — this scheme is not production-shippable as-is.

**The prod backend is live on Heroku** (migrated off AWS RDS to Heroku Postgres — no SSH tunnel, no local DB needed): `https://roadio-revive-ede3dca3face.herokuapp.com`, HTTP Basic `shinom:iloveToRide`. This is the default `BACKEND_URL`. Validate wire contracts directly against it.

**Wire-format gotchas (learned the hard way):**
- The request `version` field is parsed server-side as a **PEP440 package version**. Non-PEP440 strings (e.g. `0.1.0-web`) make `/v2/*` routes **500**. `APP_VERSION` is `3.0.0`. Keep it numeric/dotted.
- Use `lng`/`lat` (not `long`). `version` is a string.
- `zsh` does not word-split unquoted variables — inline curl flags, don't stuff them in a `$VAR`.
- If running a LOCAL Flask backend instead: macOS AirPlay Receiver squats on port **5000** (`403 AirTunes`); use 5050.

`/v2/items` returns the full envelope (score/rank/`configuration`/`broadcast`/`feed`) but `items` is **empty until the user has a game/quiz selected** — the live map (`/v3/map_markers`) is what carries populated road-point pins for an anonymous user. `configuration.premium_url` (`https://app.roadio.io`) is the Babylon premium game.

## Architecture

- `src/config.ts` — build-time constants (`API_PREFIX`, Mapbox token, default locale).
- `src/lib/deviceId.ts` — anonymous identity. `user_id` is a UUID persisted in localStorage, mirroring the Android device id. **There is no login**; the backend keys all user state off `user_id`.
- `src/lib/i18n.ts` — locale + document direction. Hebrew is RTL; most user-facing strings come pre-localized from the backend, so this only covers app-shell chrome.
- `src/api/client.ts` — `postJson` / `postForm` / `getJson` fetch wrappers + `ApiError`. Some routes (e.g. `/v3/bavel_order`) are form-encoded, not JSON.
- `src/api/endpoints.ts` — typed endpoint functions mirroring the old Android Retrofit `Api` interface.
- `src/store/session.ts` — zustand store: `user_id`, locale, HUD values (score/rank/next-km).
- `src/components/AppShell.tsx` — layout + bottom tab nav (Drive / Daily / Babylon).
- `src/routes/` — page per route.

### Backend API surface (what this client consumes)

The Android client's `Api.kt` is the reference contract. Key endpoints:
- `POST /v2/user_config` — initial config (`Configuration` object: feature flags, polling intervals, billing, quest state). `version` is a query-or-body string; `locale` is a query param.
- `POST /v2/items` — FETCH road points for the posted `{user_id, lat, lng, version}`. Returns items (already server-side proximity-filtered for that position) + score/rank/`next_item_km`/`configuration`. `items` is empty for a guest with no game selected.
- `POST /v2/events` — REPORT answers/results. Body `{user_id, lat, lng, version, events}` where **`events` is a MAP keyed by stringified item id**: `{ "<id>": { answer } }`. `answer: "next_event"` is the advance/dismiss sentinel. Returns updated `{score, points, rank, correct_answers}`. (The handler iterates `events` as a dict even though CONTRACTS.md writes `events:[...]`.)
- `POST /v3/map_markers` — map markers (car, item pins, other players).
- `GET  /v2/geofence` — geofence definitions for client-side geofence watching.
- `POST /v2/push_notif_token` — register web-push token.
- `POST /v2/purchase_update` — billing.
- `POST /v3/bavel_order` — Babylon premium game order (form-encoded).

`/v3/map_markers` returns layered collections — `cars`, `items`, `missions`, `open_missions`, `completed_missions`, `seen_items`, `is_modified` — not a flat `markers` list. Each marker has `marker_id`/`marker_type`/`lat`/`lng`/`family`/`external_link`/`map_label_info`; item & mission markers add `item_id`/`title`/`content`/`score`/`distance`/`on_path`/`type`. `/v2/geofence` returns a flat list of `{lat,lng,title,body,radius,quiz}`.

A road point's `type` field drives which game card renders. The payload carries `answers[]`, `right_answer`, `geo_right_answer` + `geo_center_radius` (geo-guess), `buckets` (quantitative scoring ranges), `story*`/`question_*` media, and `html_payload`/`url` (webview).

## Testing UI changes (required)

**Always run Playwright to verify UI changes before reporting done.** Never mark a UI fix complete without browser verification.

Use headless Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, scripts in `/tmp/rdio-pw`. Test against `http://localhost:5173` (dev server) or `https://roadio-web-client.vercel.app` (prod). Pin the device id via `localStorage.setItem('roadio.device_id', ...)`.

```bash
# Quick Playwright check pattern
node -e "
const { chromium } = require('/tmp/rdio-pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage();
  await p.goto('http://localhost:5173/TARGET_ROUTE');
  // assertions here
  await b.close();
})();"
```

## Source material (old app, for reference only — do not import)

The original Android/Kotlin source is in sibling folders: `../roadio-mvp`, `../roadio-mvp-copy` (flattened, easiest to read), `../roadio-mvp2`. Use them to recover data contracts, scoring rules, and screen flows. The web client is a fresh rewrite, not a port.
