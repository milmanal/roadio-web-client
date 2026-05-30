# Roadio Web Client — session handoff

Mobile-web (PWA) rebuild of the old Roadio Android driving game, talking to the
revived Flask backend (now on Heroku). Read `CLAUDE.md` first — it has the
architecture, API surface, and wire-format gotchas. This file is the live
status + what's next.

## Status: Phases 1–7 done. Map main screen built + re-skinned. Trivia flow + a few map items open.

### CURRENT FOCUS — read `MAP_PROGRESS.md` (next to this file)
The map main screen (`src/features/map/MapScreen.tsx`) is built, re-skinned to the
original design, and markers are GPU GL layers (no swim). Remaining map polish +
the full trivia flow are written up in detail in **`MAP_PROGRESS.md`** — start there.

| Phase | State | Notes |
|---|---|---|
| 1 Scaffold + proxy/auth/RTL/routing/device-id | ✅ verified | Vite+React+TS+PWA |
| 2 Types + typed API client | ✅ verified | reconciled against `api_samples/` |
| 3 Driving loop + HUD | ✅ verified live | geolocation → /v2/items → HUD |
| 4 Game cards | ✅ verified live | answer → /v2/events → feedback → advance |
| 5 GeoGuess + Mapbox GL JS | ✅ verified live | map renders, guess `[lat,lng]` → /v2/events 200 |
| 6 Daily quiz + Geofence | ✅ verified live | quiz list, play→GameCard→/v2/events; fences load |
| 7 Babylon premium | ✅ verified live | lead form→/v3/bavel_order + /v3/game_web_schedule 200 |
| 8 PWA polish | ⬜ NEXT | offline precache, push token, code-split Mapbox |

## How to run / verify
```bash
npm run dev          # :5173 ; proxy forwards /api/* to Heroku w/ Basic auth
npm run build        # tsc -b + vite build (the typecheck gate) — keep it green
npm run lint
```
- Backend is LIVE on Heroku (default `BACKEND_URL` in `.env.local`). No DB/tunnel.
- **Verify pattern that works:** `npm run dev`, then with Playwright open
  `/drive` → click **התחל** (Start) → click **🃏 Load sample cards (dev)**.
  This injects real sample road points (`src/features/games/sampleItems.ts`) so
  you can exercise every card type without a selected game (guests get empty
  `items[]`). Answers/guesses POST to the live `/v2/events`.
- Mapbox public token (`pk....`) is set in `.env.local` (gitignored). Consider
  URL-restricting it in the Mapbox dashboard before any public deploy.

## Ground-truth contracts (authoritative — READ THESE for phases 6–8)
`/Users/milman/Documents/dev/roadio-master/api_samples/`
- `CONTRACTS.md` — endpoint map, every shape, the 28-value `type` enum,
  `extra_details` per-type notes, **and a Babel Machine section** (game_id 496,
  3 endpoints, form-encoded/no-auth quirk, status always "success", phone
  dedup, HTML-in-message) — needed for Phase 7.
- `item_samples_by_type.json` — 17 real card rows with field values.
- `v2_items.json`, `v2_user_config.json`, `v3_map_markers.json`, `v2_geofence.json`.

Key wire facts already baked in: `version` must be PEP440 (`APP_VERSION="3.0.0"`);
report route is **`POST /v2/events`** with `events` as a **map** `{ "<id>": {answer} }`;
advance sentinel is `answer:"next_event"`; geoguess answer is `[lat,lng]` (server
scores it); config `location_update_*` are **strings**.

## Phase 6 — Daily quiz + Geofence ✅ DONE (commit 2e851d0)
Implemented: `getUserQuizzes`, `playQuiz`, `DailyPage` list+play, `useGeofence`
wired into `DrivePage`. Live-verified. Learnings for later:
- `/v2/items` `quiz` param resolves by **name** in practice (geofence `quiz:"jaffa"`).
- Guest `/v2/user_quizzes` returns an **empty array** (`Object.values` handles both
  array and keyed-map). A populated user gets the keyed map.
- Geofence auto-play (proximity) is verified by parts only — needs a field test
  or a dev simulate button to dry-run the in-radius trigger.

### Original Phase 6 plan (for reference)
Design (reuses the existing card flow):
- A quiz is played by `fetchItems({ quiz })` → `useDriving.setItems` + `triggerItems`
  → the existing `GameCard` overlay renders it. Works without driving.
- **Already done:** added `quiz` / `quiz_name` to `FetchItemsRequest`
  (`src/types/requests.ts`).
- **TODO:**
  1. `endpoints.ts`: add `getUserQuizzes` — `POST /v2/user_quizzes` (form-encoded,
     no auth needed but proxy adds it harmlessly). Response:
     `{ user_quizzes: { "<quizName>": { quiz_id, quiz_name, padding, font_size } } }`.
  2. A shared `playQuiz({quizId, quizName})` action: reads userId/locale/position
     from stores, `fetchItems({quiz: String(quizId), quiz_name, lat, lng, locale})`,
     then `setItems` + `triggerItems` + `setHud`. (Confirm whether backend `quiz`
     param wants the id or the name — try id first.)
  3. `DailyPage.tsx`: fetch quizzes on mount, render the list, on tap call
     `playQuiz`, and render `<GameCard />` so cards appear.
  4. Geofence: `src/features/geofence/useGeofence.ts` — `getGeofences({lat,lng})`
     (already in endpoints, GET `?lat=&lng=`), watch position, and when inside a
     fence's `radius` (haversine in `src/lib/geo.ts`) call `playQuiz` with the
     fence's `quiz`. Wire into `DrivePage` while `active`. Dedup fired fences.

## Phase 7 — Babylon premium (`/babylon` route, `BabylonPage.tsx` is a stub)
- `configuration.premium_url` = `https://app.roadio.io` (the premium app).
- Was 100% webview originally → simplest is an iframe/route to the premium URL,
  plus the order flow `bavelOrder()` (already in `endpoints.ts`, form-encoded).
- See the **Babel Machine** section in `CONTRACTS.md` (game_id 496, the 3
  endpoints + quirks) before building.

## Phase 8 — PWA polish
- Offline precache from `configuration.urls_pre_cache` + `preload_sounds`.
- Install prompt; web-push token via `subscribePush` (`/v2/push_notif_token`).
- **Code-split Mapbox** (it's ~1.6MB in the main chunk now) — lazy-import
  `GeoGuessCard` / mapbox-gl.

## Project map (where things live)
- `src/api/{client,endpoints}.ts` — fetch wrappers + typed endpoints.
- `src/types/*` — wire-format types (authoritative, matched to api_samples).
- `src/store/{session,driving}.ts` — zustand: identity+HUD, and driving/queue.
- `src/features/driving/{useGeolocation,useDrivingLoop}.ts` — the GPS loop.
- `src/features/games/` — `GameCard` dispatcher + `cards/*` + `answer.ts` +
  `MediaBlock.tsx` + `sampleItems.ts` (dev) + `games.css`.
- `src/routes/{DrivePage,DailyPage,BabylonPage}.tsx` — pages. `DrivePage` has the
  dev controls (simulate position, load sample cards).
- `src/lib/{deviceId,i18n,geo,media}.ts`.

## Known simplifications to revisit
- Card dispatch maps the common subset of 28 types; rare types
  (pattern_lock/volume_meter/radar/decision_tree/narrator scenes) use Story/Web/
  Fallback cards — fine for v1, flesh out later.
- WebGameCard renders `story` as trusted HTML (source is our backend).
- No git repo yet (`git init` not run). Consider initializing before more work.
