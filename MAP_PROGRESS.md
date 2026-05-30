# Map main screen — progress & next steps

The original Roadio main screen (full-screen map) was deferred in the first plan
and is being built now. This file is the live state + exactly what's next.
Design references: `/Users/milman/Documents/Roadio/screenshots/` (latest map
en/he), `/Users/milman/Documents/Roadio/zeplin desings/` (markers/, Standby,
Games selection), and the old Android `res/` in `../roadio-mvp2`.

## DONE (committed)
- `MapScreen.tsx` is the `/drive` route (replaced the old Start-button stub).
  Full-screen light Mapbox; tab bar hidden on this route.
- Top dark HUD: Points/Place (localized נקודות/מקום) + ⭐/⚡, guest/register,
  avatar (`configuration.profile_image`); ROADIO logo top-left
  (`public/roadio-logo.png`); floating "Nearby item X km" pill; bottom centered
  CURRENT GAME card (`game_name`) → `/daily`.
- User car = rear-view van `public/car.png` (from `ic_splash_car`), centred in a
  cyan detection-radius circle. Follows GPS; pan stops follow, auto-recenters
  after 5s idle.
- **Markers are GL layers, not DOM** (commit 100f42a) — symbol layer (icon) +
  circle + text layer (orange points coin). Source id `markers`, layers
  `mk-icons`/`mk-coin`/`mk-coin-text`. Fixes the zoom "swim". Click →
  `queryRenderedFeatures` → infobox (title / Waze link / Play button).
- Real marker icons downloaded to `public/markers/`: `item.png`,`seen.png`,
  `mission.png`,`open_mission.png`,`completed_mission.png` (yellow 3D "?" etc).
- Reaction frames staged in `public/reactions/` (correct_car_1..4, wrong_car).
- **Critical fix (commit 787a35d):** the doc is RTL and Mapbox positions markers
  as LTR absolutes → everything shifted by a viewport width. `.map-canvas` is
  forced `direction: ltr`. Also a `ResizeObserver → map.resize()`.

## PROXIMITY LOOP — DONE (commit f9d2088, build+lint green)
`src/features/map/useProximity.ts` added + wired into `MapScreen`. When the car
is within 100m of a `useMarkers().items` pin with an `item_id` (not already
fired, no `activeCard` open) → `fetchItems({item_id})` → `useDriving.triggerItems`.
Also `useMapMarkers` now forces a `/v3/map_markers` refetch on activeCard
non-null→null so the answered item moves to seen_items + the ✓ icon.
**Live-verified in real Chrome (Playwright):** synthetic item marker at GPS →
card pops with the real item content (3 choices, q text), `/v2/items?item_id=`
returned 200, PAGEERR=0.

**ANSWER-CLICK BUG — FIXED (commit 08f920a).** Root cause: `GameCard` renders
`.card-overlay`/`.card` but **no CSS ever styled them** — they were
`position:static`, inline in normal flow, so the full-screen Mapbox canvas
painted on top and intercepted every click (`elementFromPoint` over a choice
returned `canvas.mapboxgl-canvas`, not the button). Added a fixed full-screen
overlay (z-index 1000, above the map HUD's max of 4) + bottom-sheet `.card` to
`games.css`. **Live-verified end-to-end in real Chrome:** GPS proximity → card
pops → plain click on answer lands → `/v2/events` POST → `✓ נכון!` feedback +
`choice-right`. Full chain works.

NOTE: there is NO haversine stub anywhere — `src/lib/geo.ts distanceMeters` is
already correct (a phantom tool result earlier suggested otherwise; ignore).

### Earlier notes (kept for reference)
Added `item_id` to `FetchItemsRequest` (`src/types/requests.ts`). Verified facts:
1. **`/v2/items` with `{item_id}` returns that single item's full content**
   (200, 1 item with type/question/answers). This is how you pull a marker's
   playable item — verified live with ids 2504735 (question), 1400933 (html),
   13254 (geoguess).
2. Add `src/features/map/useProximity.ts`: subscribe to `useDriving` position;
   when within ~100m of a `useMarkers().items` marker (has `item_id`) not already
   triggered and no `activeCard` open → `fetchItems({ item_id })` →
   `triggerItems(res.items)`. Track triggered ids in a ref. Wire `useProximity(true)`
   into `MapScreen`.
3. After a card closes, **force a markers refetch** so the item re-renders with
   the seen icon: in `useMapMarkers`, subscribe to `useDriving` `activeCard`; on
   non-null→null transition, call the fetch (force). The store already separates
   `seenItems` → `buildMarkerFC` maps that group to `mk-seen` (the ✓ icon), so
   the design change is automatic once the backend moves it to `seen_items`.
4. **Test:** in Playwright, grant geolocation and `setGeolocation` to a marker's
   exact lat/lng (read one from a `/v3/map_markers` response) → card should pop →
   answer → dismiss → marker flips to the seen icon on the next markers poll.

## OPEN map polish — DONE
- **Server-driven icons per marker — DONE (commit b229632).** `markers_v2` typed
  as `Record<string, MarkerStyle[]>` (config.ts). MapScreen resolves each
  marker's icon by `markers_v2[typeKey].find(family) ?? find('default')`, lazy-
  loads the PNG via `map.loadImage` keyed by URL, draws local default first then
  upgrades on load. Live-verified family='ben_gurion' fetched the right server
  PNG (200). NOTE shape gotcha: `markers_v2[type]` is a **list of
  {family,icon,...}**, NOT family-keyed. icon-size stays 0.3 — server xhdpi PNGs
  may want per-type tuning later if any look oversized.
- **Points coin — DONE (commit 45bc834).** radius 11→8.5, text 11→9,
  translate [12,-34]→[9,-27].

## KEY BACKEND FACTS (for the map/gameplay)
- Map item markers only appear once the user has game/quiz **state** — a fresh
  guest gets empty `items`/markers. A device that has played a daily quiz has
  state and shows markers (that's why the browser shows ~179 at TLV).
- `/v3/map_markers` body needs `version`; returns `{cars, items, missions,
  open_missions, completed_missions, seen_items, is_modified}`. Marker fields:
  `marker_id, marker_type, family, lat(str), lng(str), item_id, score, title,
  content{title,link}, map_label_info{title,link}, external_link`.
- Report answers → `POST /v2/events` `{events:{ "<id>":{answer} }}`; advance
  sentinel `answer:"next_event"`.

## task #10 full trivia flow — DONE (commit 19407ee, build+lint green)
`src/features/games/cards/TriviaCard.tsx` — full-screen themed flow for
multiple-choice `question` items. `GameCard` routes `kind==='question'` WITH
answers → `TriviaCard` (self-contained, owns answer/vote/advance reporting via
`reportEvents`); open free-text + other types keep the bottom-sheet.
- Sky-blue gradient card; white **signpost** buttons (clip-path left arrow).
- **Multiple attempts**: `maxAttempts = points_second_correct != null ? 2 : 1`.
  Wrong answer is eliminated, reaction plays, returns to question for attempt 2.
- Reaction layer: `public/reactions/correct_car_1..4` cycle (correct) /
  `wrong_car` (wrong) + **"911 / This player is on fire!"** banner on correct.
- Story reveal: right answer highlighted green, `story`/`story_images`/
  `story_voices`, **👎/👍 vote** (`{vote}` event), NEXT (`next_event`).
- Bottom **Score / Place (CSS bear badge) / Time** row (count-up, or countdown
  from `point.countdown`) + segmented progress (segments = queue length + 1).
- Chained follow-ups ride the existing queue/advance + `next_event` dismiss.
- Footer/progress forced `direction:ltr` so order matches design under RTL.
- Labels English even in he UI.
**Live-verified in real Chrome (Playwright), PAGEERR=0:** proximity-injected
item marker (id 2504735) → `/v2/items` live → card pops with real Q + 3
signposts → wrong (קיץ) → wrong_car reaction → answer eliminated (2 left) →
correct (סתיו) → on-fire banner → story reveal w/ green right answer → 👍 vote →
NEXT dismisses. All 4 `/v2/events` POSTs correct shape (`{id:{answer}}`,
`{id:{vote}}`, `{id:{answer:"next_event"}}`).
NOTE: no `max_attempts`/`parents` field exists on the wire — `max_attempts`
derived from `points_second_correct`; chaining uses `parent_id` ordering via the
store queue. Reaction car PNGs are light line-art (look faint over blue) — real
assets, fine. Tall `question_images` push NEXT below the fold (scroll) — v1 ok.

## Other missing screens (tasks #11, #12)
- Game Selection (`More games` button target) — zeplin "Games selction".
- Settings + Leaderboard (avatar tap target).
