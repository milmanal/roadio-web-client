# Backend response — answers to BACKEND_NEEDS.md

Backend owner replies, verified against the live code + Heroku app
(`roadio-revive`). Format: **state** (what's true now) → **plan**.

---

## 1. Premium app `app.roadio.io` (503) — the playable game surface

**State:** `app.roadio.io` / `app.premium.roadio.io` are a **separate Heroku app**
(not this repo, not in the owner's visible account — only `roadio-revive` + the old
`roadio` are). Both return 503. It appears to have run the *same* Flask codebase as
a "premium" instance (that's why `/v2/user_quizzes` also exists on the main backend).

**Plan / decision:** We are **not restoring `app.roadio.io`.** The **new web client IS
the replacement playable surface** — that's the point of building it. So:
- `configuration.premium_url` will be repointed to the **web client URL** (or to
  `roadio-revive` for any server-rendered bits) once the client is deployed.
- Treat `premium_url` as "the game lives here" → set it to the web client.
- The Babylon order/schedule forms stay on the main backend (already 200), as you noted.

➡️ **Action for client:** assume you own the game surface; tell us the web client's
prod URL and we'll set `premium_url` to it. No premium-app restore is coming.

---

## 2. Game selection — JSON API

**State:** no JSON games endpoint exists; the page builds an HTML list with native
`roadio://` deep links. Quiz tokens (from `api/game_selection.py`):

| Token | Game | Notes |
|---|---|---|
| `roadio` | טריוויה על הדרך (free road trivia) | default free game |
| `reg_496_dana` | Babel Machine (free / start-now) | `reg_<id>_<key>`, key=`dana` |
| `reg_496_kupon` | Babel Machine (paid 49₪ / coupon) | key=`kupon` |
| `reg_530_1` | Britain park quest (paid) | |
| `reg_333` | 929 (currently disabled in code) | |

Pattern: `reg_<game_id>_<link_key>`; `link_key` ∈ {`dana`→free+start_now,
`kupon`→paid, `1`/`N`→variant}. **Select** = `POST /v2/items {quiz:"<token>"}` (your
workaround is the intended path). Posting a new token **re-registers** (replaces the
active game) via `organized_game_logic` — switching is clean; there's no explicit
"deselect" (select another, or `roadio` for the free default).

**Plan:** I'll add **`GET /v2/games?user_id=&locale=`** → JSON
`[{game_id, quiz_token, name, description, image_url, price, kind}]`, built from the
same source the HTML page uses (region-aware). Then you render a native picker.

---

## 3. Leaderboard

**State:** the **data + logic already exist** — `dal_cache/leaderboard.py` keeps Redis
sorted sets (`Leaderboard`, `TownsLeaderboard`, `DailyLeaderboard`, per game_id) with
`get_ranks_around(...)`. There's just **no HTTP endpoint**. Per-user `rank`/`score`
already come back top-level in `/v2/items`.

**Plan:** I'll add **`GET /v2/leaderboard?user_id=&game_id=&locale=`** →
`{me:{rank,score}, entries:[{rank,name,score,avatar?}]}`, wiring the existing
`get_ranks_around`. Towns/daily variants available from the same module. Low effort.

---

## 4. Web push — VAPID

**State:** **not implemented for web.** The original push was native FCM (Android);
`/v2/push_notif_token` just stores a token. No VAPID key, no web-push send path.

**Plan:** I'll generate a **VAPID keypair**, expose the public key (in
`configuration.vapid_public_key` + a `GET /v2/push_public_key`), accept the web
subscription on `POST /v2/push_notif_token` (`{user_id, subscription, platform:"web"}`),
and add `pywebpush` for sending. New work but self-contained.

---

## 5. Production auth / CORS

**State (corrected):** **CORS already works** — `OPTIONS /v2/items` returns 200 with
`Access-Control-Allow-Origin` reflected and `Allow-Methods`; Basic-auth does **not**
block the preflight. So CORS is not the blocker.

The real issue is the one you flagged: **HTTP Basic creds in browser JS are insecure**
(readable by anyone). 

**Plan / decision (pick one):**
- **Preferred:** production runs a **reverse-proxy / BFF** that injects the Basic auth
  server-side (your infra). Cleanest, no backend change, creds never reach the browser.
- **Or:** I add a **per-device signed token** scheme (issue a token bound to user_id,
  validate on `/v2,/v3`) + set `Access-Control-Allow-Credentials`. More backend work.

If you confirm the BFF approach, this is your infra task and needs nothing from me
except maybe `Access-Control-Allow-Credentials: true` (say the word).

---

## 6. Clarifications

- **`fetch_markers`** = `is_quest AND (is_new_station OR force_config_update)`. It's a
  **quest-only, transient "refetch markers NOW" trigger**, *not* "markers exist". For
  non-quest games it's always `false`. **You were right to stop gating on it** — gate on
  having a selected game / actual markers instead.
- **Guests get 0 markers** until a game is selected — **confirmed intentional** (markers
  come from the active game; no game → nothing to show).
- **`version` must be numeric/PEP440** — confirmed; non-numeric 500s some routes. Keep
  sending `3.0.0`.
- **`/v2/events` `events` is a map keyed by item id** — trusting your live finding;
  I'll align CONTRACTS.md to `{ "<item_id>": {answer...} }`.

---

## ✅ SHIPPED (live now, all HTTP Basic like the rest)

**#2 `GET /v2/games?user_id=&locale=`** → `{games:[{game_id, quiz_token, name,
description, image_url, price, kind}]}`. Select/switch by POSTing the `quiz_token`
to `/v2/items {quiz:...}` (re-registers cleanly). Currently 3 games (496 babel,
530 britain, 1 road-trivia); extend the list server-side as needed.

**#3 `GET /v2/leaderboard?user_id=&game_id=&locale=`** →
`{me:{rank,score}, total, game_id, entries:[{user_id, rank, score, name}]}`.
`entries` = top-3 + ranks-around-me, sorted. NOTE: returns **empty right now** —
Heroku Redis started fresh, so the leaderboard sorted sets are empty until gameplay
accrues points (old Redislabs data wasn't migrated; it's cache). Shape is final.
`game_id` defaults to the user's active game, else 1.

**#4 Web Push (VAPID):**
- `GET /v2/push_public_key` → `{vapid_public_key:"..."}`, also in
  `configuration.vapid_public_key`.
- **applicationServerKey** =
  `BDV6ut5fe9seV2ovUfTRH8DrLc8k6PXd744exZ5tJlwvNzyZcxRy3pLIyUgn4vvRV_5zlCDbYPbgVJ0hgzUsVL8`
- Subscribe: `POST /v2/push_notif_token {user_id, subscription:<PushSubscription JSON>}`
  (also still accepts native `{user_id, token}`).
- Server-side *sending* via pywebpush is wired as a dep but not yet hooked to events —
  subscriptions are stored; tell us when you want pushes actually delivered.

## ✅ SHIPPED — Profile/Leaderboard + Registration screens (Zeplin 1:1)

Both legacy webview screens now have JSON APIs (all HTTP Basic). Build natively.

**`POST /v2/profile`** `{user_id, locale?}` → superset for the profile+leaderboard screen:
```
{
  me: {rank, total_players, score, missions, questions, name, avatar,
       settlement, settlement_rank},
  classic: [{rank, name, score, is_me}],   // top N + window around me (157/158/159 pattern)
  daily:   [{rank, name, score, is_me}],
  towns:   [{rank, name, score, is_me}],    // מיקום ישובים
  game_id
}
```
`missions` = tasks, `questions` = answered questions. Rows are **name-only** (no
per-entry avatar, as requested); `me.avatar` carries the header avatar. `daily`/`towns`
may be empty until gameplay/data accrues — shapes are final.

**`POST /v2/register`** → `{status, configuration:{...}}` (refreshed config). Covers
the generic signup AND the dedicated babel road-quest form (which adds destination +
phone). Body:
`{user_id, game_id?, nickname, email, join_contest, town_id, mood_id, game_code,
phone_number?, destination?, quest_phones?, version?}`
- For **babel/game 496**, pass `game_id:496` + `nickname` + `phone_number` + `destination`
  ("לאן נוסעים?", the original used Google Places autocomplete — rebuild the picker
  client-side, send the chosen string). Verified: returns config with
  `game_id:496, game_name:"מכונת בבל", is_road_quest:true`.

### Starting the Babel game (game 496) — the flow
The "send me the link / pick a date" screen is a **download funnel for the dead native
app — skip it on web.** To start the game:
1. `POST /v2/items {user_id, quiz:"reg_496_dana"}` — trigger the babel reg flow
2. `POST /v2/register {user_id, game_id:496, nickname, phone_number, destination, ...}`
   — **activates the game** (config flips to game_id 496 / is_road_quest)
3. `/v2/items` + `/v3/map_markers` then serve the quest. It's a **driving game** —
   road-point items/markers unlock by location as you move along the route; at a
   standstill you see the start mission only (items:0 sitting still is normal).

**`GET /v2/towns?game_id=`** → `{towns:[{id,name}]}` — the ישוב dropdown (per game;
empty if that game has no settlements configured).

**`GET /v2/moods?locale=`** → `{moods:[{mood_id,label,icon_url}]}` — the 6 vans:
`prada, confident, orange, jammed, eco-friendly, good-vibes`. Submit `mood_id` as
`/v2/register` `mood_id`.

Reference layouts (don't embed — assets/AJAX point at dead hosts): backend templates
`leaderboard_v2.html` (profile/board) and `road_quest_registration_v2.html` (signup);
mood/avatar art in the `moscovig/roadio_static` GitHub repo.

## Needs your decision
- **#1** web client URL → I set `premium_url` to it (no premium-app restore)
- **#5** BFF/reverse-proxy (your infra, recommended) vs backend token scheme
