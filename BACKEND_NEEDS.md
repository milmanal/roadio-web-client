# Backend requirements — Roadio web client

What the web client needs from the backend to be feature-complete. Written for
the backend owner. The web client talks to the **main backend** (live, Heroku):
`https://roadio-revive-ede3dca3face.herokuapp.com` (HTTP Basic `shinom:…`).

## TL;DR — the blocker

**All `*.roadio.io` hosts are inactive.** Premium Heroku apps return **503**
(`app.roadio.io`, `app.premium.roadio.io` — crashed); the marketing/info domains
**don't resolve at all** (`roadio.io`, `he.roadio.io`, `www.roadio.io` — conn
fail / no DNS). Every feature the original Android app delegated to those
webviews is therefore dead in the web client. We worked around two on the main
backend; the rest need backend work. Each item below has **current state** +
**what we need**.

---

## 1. Premium app `app.roadio.io` is down (503) — highest priority

The premium app served three things the client depends on:

| Feature | Old URL | Status |
|---|---|---|
| Babylon premium **game** (the actual playable game) | `app.roadio.io` (`configuration.premium_url`) | **503 — unplayable** |
| Game-selection webview | `app.premium.roadio.io/game_selection_2` | **503** (but mirrored on main backend — see §2) |
| Leaderboard webview | premium app | **503** |
| Info pages | `he.roadio.io/babel-machine`, `www.roadio.io/quest-britania`, `he.roadio.io/` | **dead — DNS doesn't resolve** |

**What we need:**
- **Restore `app.roadio.io`** (or give a new live `premium_url`). Without it the
  Babylon premium game has no playable surface — only the lead/scheduling forms
  work (those are on the main backend, see below).
- If the premium app is gone for good, tell us the replacement game URL(s).

**Note — works fine, no action:** the Babylon **order/schedule** endpoints are on
the *main* backend and respond 200:
`POST /v3/bavel_order`, `POST /v3/game_web_schedule` (form-encoded, game_id 496).

---

## 2. Game selection — need a JSON API (currently scraped/hardcoded)

There is **no games-list or select-game JSON endpoint**. The original flow was a
webview (`/game_selection_2`) whose buttons are native deep links
`roadio://v2/items?quiz=<token>` that only the Android app can intercept.

**What works (our current workaround):**
- **Selecting** a game = `POST /v2/items` with `{quiz:"<token>"}`. Verified: a
  fresh user posting `quiz:"roadio"` flips `configuration.has_game_selected` to
  `true` and unlocks map markers (0 → 178). Good enough to select.
- The page `…/game_selection_2` *is* also served by the main backend (200), but
  its own AJAX calls a **dead host** (`https://app.roadio.io/v2/user_quizzes`),
  so it can't be embedded as-is.

**What we need (pick one):**
- **Preferred:** `GET /v2/games?user_id=…&locale=…` → JSON list of selectable
  games: `[{ game_id, quiz_token, name, description, image_url, kind }]`. Then we
  render a native picker instead of hardcoding the 4 games we scraped
  (`roadio`, `reg_496_dana`, `reg_530_1`, daily).
- **Or:** fix the `/game_selection_*` page's hardcoded `app.roadio.io` host to a
  live host so it can be embedded.
- Please also document the **quiz tokens** and a way to **deselect / switch**
  games (does posting a new `quiz` token replace the selected game cleanly?).

---

## 3. Leaderboard — no named-players board exists anywhere

Clarified after checking the legacy Android app + backend:
- There is **no leaderboard page or endpoint**. Main-backend probes 404
  (`/leaderboard`, `/v2/leaderboard`, `/ranking`, …); the premium webview is
  503; and the legacy Android app has **no leaderboard screen** either.
- The only ranking data the backend returns:
  - top-level **`score` / `rank`** (road-game HUD) — already used.
  - per road-point **`rank_stats: [{count, score}]`** — an **anonymous score
    distribution** (e.g. `{count:694, score:0}` = 694 players scored 0). The
    legacy app **computes the player's "Place"** from this (how many players
    scored above you). This is what the quiz **Place** badge shows. It is **not**
    a list of named players.
- The zeplin "leaderboard" mock (named ranks 1–10 with scores) has **no live
  data source**.

**What we need (only if you want a real named leaderboard):**
`GET /v2/leaderboard?user_id=…&game_id=…&locale=…` →
`{ me: {rank, score}, entries: [{rank, name, score, avatar?}] }`
(group/quest variants if relevant). **Without this, "Leaderboard" stays
deferred** — we can only show the computed Place from `rank_stats`, not a board.

**Client-side TODO (no backend needed):** compute quiz **Place** from
`rank_stats` like the legacy app (currently the quiz card shows the `/v2/events`
rank, which is wrong for quizzes).

---

## 4. Web push — need a VAPID public key

`POST /v2/push_notif_token` exists, but the client cannot create a push
subscription without the server's **VAPID public key**.

**What we need:** expose the VAPID public application server key (e.g. in
`configuration.vapid_public_key`, or a `GET /v2/push_public_key`). Confirm the
expected `POST /v2/push_notif_token` body (`{user_id, token/subscription,
platform:"web"}`).

---

## 5. Production auth / CORS (deploy blocker, not a dev blocker)

In dev/preview a Vite proxy injects HTTP Basic and rewrites `/api/*`. This is
**not shippable** — the browser must not hold Basic creds, and the `/v2,/v3`
routes have **no CORS**.

**What we need (pick one):**
- A browser-safe auth scheme for the web client (per-device token / signed
  request), **and** CORS headers on the API routes; **or**
- Confirmation that production will run a reverse-proxy/BFF that injects auth
  (then this is our infra task, not yours).

---

## 6. Smaller clarifications

- **`configuration.fetch_markers` is `false`** even for users who *do* have ~178
  markers. We had to stop gating on it (it was hiding all map markers). Please
  confirm its real meaning (background/driving fetch toggle?) so we gate
  correctly, or make it reflect reality.
- **Guests get 0 markers** until a game is selected (`has_game_selected=false`).
  Assumed intentional — please confirm.
- **`version` must be PEP440** — non-numeric (e.g. `0.1.0-web`) makes `/v2/*`
  routes 500. We send `3.0.0`. (Already handled; flagging for awareness.)
- **`/v2/events`** `events` is a **map** keyed by item id (`{ "<id>": {answer} }`),
  not the array shown in CONTRACTS.md. (Handled; confirm it's stable.)

---

## What is NOT blocked (already verified live on the main backend)

`/v2/user_config`, `/v2/items` (fetch + quiz select + single `item_id`),
`/v2/events` (answer/vote/next), `/v3/map_markers`, `/v2/geofence`,
`/v2/user_quizzes`, `/v3/bavel_order`, `/v3/game_web_schedule`.
