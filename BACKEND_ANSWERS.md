# Client answers — profile / leaderboard / registration JSON

Answers to the backend's questions about exposing `personal_page_v2.py` +
`road_quest_registration_v2` as JSON. Field names are the client's preferred
wire format (snake_case). Auth/version: same convention as other `/v2/*`
routes (POST JSON with `version`), but GET is fine if you prefer.

## Q1 — Profile/leaderboard shape → **(a) one endpoint**

Give us a **single `POST /v2/profile`** that returns everything the profile +
leaderboard screens show. We render both zeplin screens (the board screen and
the press-your-name screen) from this one response — fewer round-trips, and the
profile screen needs the header stats + all three boards together anyway.

`/v2/leaderboard` then becomes redundant for us (keep it if other consumers use
it; the client will only call `/v2/profile`).

**Request:** `POST /v2/profile` `{ user_id, version, locale, game_id? }`

**Response:**
```jsonc
{
  "me": {
    "name": "גלעד מ'",
    "avatar": "https://…",      // header avatar ONLY (see Q3)
    "group": "הגושרים",         // optional subtitle (team/game), null ok
    "rank": 1507,
    "total_players": 5000,       // renders as "1507/5000"
    "score": 650,
    "missions": 9999,            // משימות
    "questions": 9999,           // שאלות
    "settlement": "שדה נחמיה",   // optional, null ok
    "settlement_rank": 1         // optional, null ok
  },
  "classic": [                   // מיקומים — player board
    { "rank": 1,   "name": "ניצן הרשקוביץ", "score": 6000 },
    { "rank": 157, "name": "אבי כהן",        "score": 800  },
    { "rank": 158, "name": "גלעד מ'",        "score": 650, "is_me": true },
    { "rank": 159, "name": "יעל נחמני",      "score": 64   }
  ],
  "daily": [ /* same row shape as classic; or null if N/A */ ],
  "towns": [                     // מיקום ישובים
    { "rank": 1, "name": "שדה נחמיה", "score": 6000 },
    { "rank": 2, "name": "קרית שמונה", "score": 600, "is_me": true }
  ]
}
```

**Row shape (all boards):** `{ rank, name, score, is_me? }`.
- For `classic`/`daily`: please include the **top N** (e.g. 3) **plus the
  window around me** (±1–2, like the 157/158/159 in the mock). Mark the user's
  own row with `"is_me": true` so we can highlight it.
- `me.rank` + `me.total_players` give the "1507/5000" header.
- `missions`/`questions` are the header counts (`משימות`/`שאלות`).

## Q2 — Registration → **form spec + submit + lookup endpoints (both)**

We build a native form; we need the field spec, the submit endpoint, **and** the
two lookup endpoints (don't want to hardcode towns/avatars).

**Submit:** `POST /v2/register`
```jsonc
{ "user_id", "version", "email", "nickname", "join_contest": true,
  "town_id": 42, "mood_id": 3, "game_code": "" }   // game_code optional
```
→ Response: the updated user state (ideally the same `configuration` object as
`/v2/user_config`, so we can refresh `username`/`profile_image`/
`has_game_selected` in one go). Tell us any validation rules (email format,
nickname uniqueness, game_code meaning).

**Field mapping (from the `בואו נכיר` mock):** `email`=מייל, `nickname`=כינוי,
`join_contest`=משתתף בתחרות? (כן/לא), `town`=ישוב, `mood`=Mood (avatar),
`game_code`=קוד משחק.

**Lookups:**
- `GET /v2/towns?locale=…` → `[{ "id": 42, "name": "שדה נחמיה" }]` (ישוב dropdown).
- `GET /v2/moods` → `[{ "id": 3, "name": "אם יש לך שמש", "image": "https://…" }]`
  (the 6 car-face avatars; images can be the `moscovig/roadio_static` URLs).

## Q3 — Names/avatars per leaderboard row → **name only**

Per-row: **`name` + `score` + `rank` only**. **No per-entry avatar** — the mocks
show avatars only in the header. So skip the per-row avatar lookup (the cost you
flagged); just return `me.avatar` for the header. If you ever want row avatars
later, add an optional `avatar` field and we'll use it when present.

## Notes
- Hebrew strings come pre-localized from you (as today). Pass `locale`.
- We'll wire the profile screen to the avatar-tap and the leaderboard to its own
  entry; registration to the HUD "register here" / a Settings entry.
- This unblocks the two zeplin screens to be rebuilt natively 1:1.
