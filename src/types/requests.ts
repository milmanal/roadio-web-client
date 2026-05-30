// Request bodies. Verified against CONTRACTS.md + the live handlers
// (main.py + users_logic.handle_events_update).

export interface FetchItemsRequest {
  user_id: string
  version: string
  lat?: string | number | null
  lng?: string | number | null
  locale?: string | null
  isDriving?: boolean
  radio?: string | null
  /** Fetch a specific quiz's items (daily quiz / geofence quiz). */
  quiz?: string | null
  quiz_name?: string | null
  /** Fetch a single item's full content by id (proximity trigger). */
  item_id?: number | null
}

/**
 * One reported event for a road point. The server reads `answer` (the picked
 * answer text, or the "next_event" sentinel to advance/dismiss), and
 * optionally `event` ("seen") / `vote`.
 */
export interface ReportEvent {
  answer?: string | number | number[]
  event?: string
  vote?: string
}

/**
 * POST /v2/events body. `events` is a MAP keyed by stringified item id — the
 * handler iterates `for item_id in events`. (CONTRACTS.md's `events:[...]` is
 * approximate; the handler treats it as a dict.)
 */
export interface EventsRequest {
  user_id: string
  version: string
  lat?: string | number | null
  lng?: string | number | null
  events: Record<string, ReportEvent>
  game_time_left?: number | null
}

export interface MapMarkersRequest {
  user_id: string
  version: string
  lat: string
  lng: string
  force?: boolean
  background?: boolean
}

export interface PushTokenRequest {
  user_id: string
  token: string
  platform: string
}

export interface PurchaseUpdateRequest {
  user_id: string
  [k: string]: unknown
}
