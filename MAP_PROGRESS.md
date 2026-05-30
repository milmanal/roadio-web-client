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

## OPEN map polish (user feedback, by priority)
- **Server-driven icons per marker (incl. family/festival variants).** Currently
  icons are 5 local group-defaults (regular vs seen vs mission are already
  distinct — these ARE the server's default-family art). For full fidelity,
  resolve each marker's icon from `configuration.markers_v2[type][family].icon`
  and load those URLs into the map (`map.loadImage`, callback-style here, not
  promise). CORS: raw.githubusercontent.com generally allows it; keep the local
  defaults as fallback. typeKey per store group: items→`item`,
  seenItems→`seen_item`, missions→`mission`, openMissions→`open_mission`,
  completedMissions→`completed_mission`.
- **Points coin too big / not tight to the corner** (low pri). In `MapScreen`
  load handler: `mk-coin` `circle-radius` ~8.5 (was 11), `mk-coin-text`
  `text-size` ~9 (was 11), and tighten `circle-translate`/`text-translate` from
  `[12,-34]` toward the icon's top-right (icon-size 0.3, anchor bottom).

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

## THEN — task #10 full trivia flow (the big next piece)
Current `GameCard` is a one-shot bottom-sheet. The real flow (see
`/Users/milman/Documents/Roadio/screenshots/` quiz shots): full-screen THEMED
card; white **signpost/arrow** answer buttons; **multiple attempts**
(`max_attempts`, `points_first_correct` vs `points_second_correct`); correct/
wrong **reaction animation** (use `public/reactions/` van frames + "on fire!"
banner); **post-answer story reveal** (story/story_images/story_voices) + a
**thumbs up/down vote** (the `vote` event); chained follow-ups
(`parent_id`/`parents`); bottom **Score / Place(bear badge) / Time** row + a
segmented progress bar. Labels are English even in he UI.

## Other missing screens (tasks #11, #12)
- Game Selection (`More games` button target) — zeplin "Games selction".
- Settings + Leaderboard (avatar tap target).
