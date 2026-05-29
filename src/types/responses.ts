// Response shapes. Verified against api_samples/*.json + CONTRACTS.md.

import type { Configuration } from './config'
import type { RoadPoint } from './roadPoint'

export interface NowPlaying {
  radio: string
  song: string
}

export interface BroadcastInfo {
  is_new: boolean
  message: string | null
}

/** Numeric in /v2/items; kept loose since older paths used strings. */
type Num = number | string

/** Response of POST /v2/items (fetch mode). */
export interface RoadPointsResponse {
  items: RoadPoint[]
  next_item_km: Num
  rank: Num
  score: Num
  points?: number
  username: string
  user_label: string
  user_id?: string
  lat?: number
  lng?: number
  quiz?: string
  configuration: Configuration
  now_playing?: NowPlaying[] | null
  broadcast?: string | null
  broadcast_info?: BroadcastInfo
  feed?: { new_notifications?: number } | null
}

/** Response of POST /v2/events (report mode). */
export interface EventsResponse {
  updaet_status?: string | null // sic — backend key is misspelled
  user_id?: string
  score: number
  points: number
  rank: number
  correct_answers?: number
  username?: string
  [k: string]: unknown
}

/** waze/maps deep-link or label payload attached to markers. */
export interface MarkerLabel {
  title: string
  link: string
}

/**
 * A pin on the live map (POST /v3/map_markers). Discriminated by marker_type
 * ("car", "item", "mission", ...). Verified against the serializer + live JSON.
 */
export interface MapMarker {
  marker_id: string
  marker_type: string
  family?: string | null
  lat: string
  lng: string
  title?: string | null // localized label, e.g. "שאלה"
  content?: MarkerLabel | null
  map_label_info?: MarkerLabel | null
  external_link?: MarkerLabel | Record<string, unknown> | null
  item_id?: number
  score?: number | null
  distance?: number
  on_path?: boolean
  org_game_item_type?: string | null
  type?: string | null
}

/** Live-map payload: layered marker collections plus client-state echoes. */
export interface MapMarkersResponse {
  cars: MapMarker[]
  items: MapMarker[]
  missions: MapMarker[]
  open_missions: MapMarker[]
  completed_missions: MapMarker[]
  seen_items: MapMarker[]
  is_modified: boolean
  [k: string]: unknown
}

/** GET /v2/geofence — lat/lng are STRINGS here. */
export interface GeofenceResponse {
  lat: string
  lng: string
  title: string
  body: string
  radius: number
  quiz?: string | null
}

export interface BavelOrderResponse {
  message: string
  status: string
}

/** One quiz entry in POST /v2/user_quizzes (keyed by quiz name). */
export interface UserQuiz {
  quiz_id: number | string
  quiz_name: string
  padding?: number | string | null
  font_size?: number | string | null
}

/** POST /v2/user_quizzes → quizzes available to the user, keyed by quiz name. */
export interface UserQuizzesResponse {
  user_quizzes: Record<string, UserQuiz>
}
