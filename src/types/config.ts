// Ported from Configuration.kt. Server-driven runtime config returned by
// /v2/user_config and embedded in the items response. Keys match wire format.
// Only the fields the web client acts on are typed strictly; the rest are
// passed through. Unknown fields are tolerated.

/** One per-family marker style inside `markers_v2[type]`. */
export interface MarkerStyle {
  family: string
  icon: string
  infobox_color?: string | null
  points_color?: string | null
  display_points?: boolean | null
}

/** One stop on the quest "metro line" (the left-edge station strip). */
export interface QuestStation {
  icon_url?: string | null
  station_name?: string | null
  station_name_disp?: string | null
  station_order: number
  station_marker_id?: number | string
}

export interface QuestMetro {
  stations?: QuestStation[] | null
}

export interface Quest {
  next_km_label?: string | null
  next_station_name?: string | null
  user_next_station: number
  quest_name?: string | null
  map_music?: string | null
  avatar?: string | null
  task_opener?: string | null
  random_sounds?: string[] | null
  show_whatsapp_send?: boolean | null
  metro?: QuestMetro | null
}

export interface Billing {
  [k: string]: unknown
}

export interface Configuration {
  username: string
  user_label: string
  profile_image?: string | null
  game_id?: number | null
  game_name?: string | null

  // Driving loop tuning. NOTE: these arrive as STRINGS from the backend —
  // coerce with Number() before arithmetic.
  location_engine_refresh_ms: string | number
  location_update_ms: string | number
  location_update_meters: string | number
  is_driving: boolean | null
  fetch_in_bg: boolean
  fetch_markers: boolean
  screen_on: boolean | null

  // Map
  zoom_level: number
  map_rotate: boolean
  gs_version?: string
  contest_logo?: string | null
  avatar_uri?: string | null
  // premium_url (the dead app.roadio.io webview surface) is intentionally NOT
  // consumed — Babylon renders natively (BabylonPage). The backend may still
  // send it; it's tolerated via the index signature below.
  markers?: Record<string, unknown>
  /**
   * Server-driven marker art keyed by marker type
   * (`item`/`seen_item`/`mission`/`open_mission`/`completed_mission`). Each
   * type holds a list of per-family styles; the `default` family is the
   * fallback. `icon` is a raw PNG URL on raw.githubusercontent.com.
   */
  markers_v2?: Record<string, MarkerStyle[]>
  modify?: boolean
  modify_markers?: boolean
  record_game?: boolean

  // Feature toggles
  show_daily_quiz_view: boolean
  show_radio_view: boolean
  has_game_selected: boolean
  open_game_selection: boolean
  is_quest: boolean
  is_road_quest: boolean

  // Countdown
  run_clock?: boolean | null
  clock_seconds?: number | null

  distance_units_label?: string | null

  // Preloading
  urls_pre_cache?: string[] | null
  preload_sounds?: string[] | null
  download_timeout_seconds: number
  delay_after_quiz_fetch_seconds: number

  quest?: Quest | null
  billing?: Billing | null

  [k: string]: unknown
}
