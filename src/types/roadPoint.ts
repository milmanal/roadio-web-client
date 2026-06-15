// ITEM shape — authoritative, from the server serializer
// (dal_pg/utils.py:item_to_dict + fill_missing_fields) and verified against
// api_samples/item_samples_by_type.json. Keys are the JSON wire format.
//
// The DB has 28 real `type` values (not the 11 in the old Kotlin enum). We keep
// a union of the known ones for autocomplete but accept any string; the card
// dispatcher maps the common subset and falls back for the rest.

export type KnownRoadPointType =
  | 'question'
  | 'quantitative'
  | 'geoguess'
  | 'story'
  | 'insta_story'
  | 'narrator'
  | 'crossword'
  | 'sound_trivia'
  | 'image_trivia'
  | 'html_trivia'
  | 'logic'
  | 'ispy'
  | 'as_many'
  | 'decision_tree'
  | 'mission_code'
  | 'mission_code_whatsapp'
  | 'pattern_lock'
  | 'radar'
  | 'html'
  | 'audio'
  | 'volume_meter'
  | 'game_registration'
  | 'image_selection'
  // legacy/admin enum names
  | 'SingleClick'
  | 'SingleChoice'
  | 'OpenQuestion'
  | 'MultipleChoice'

export type RoadPointType = KnownRoadPointType | (string & {})

/** Per-type variant payload (jsonb). Shape depends on `type`; treat as open. */
export type ExtraDetails = Record<string, unknown>

export interface RoadPoint {
  id: number
  type: RoadPointType

  question: string | null
  story: string | null
  right_answer: string | null // may be null or have trailing tabs — trim on use
  answers: string[] | null
  labels: string[]
  difficulty: number | null

  question_images: string[]
  question_voice: string | null
  story_images: string[] | null // sometimes a YouTube URL
  story_voices: string[] | null

  /** Array of correct answers for `as_many`; boolean flag elsewhere. */
  multiple_right_answers: string[] | boolean | null

  points_first_correct: number | null
  points_second_correct: number | null
  countdown: number | null

  /**
   * Anonymous score distribution for this quiz item: how many players scored
   * each value. The client derives the player's "Place" from it:
   * place = 1 + Σ count where score > yourScore (mirrors the Android app).
   */
  rank_stats?: { count: number; score: number }[] | null

  marker_family: string | null
  top_marker: boolean | null
  html_template_name: string | null // e.g. "babel/pattern_lock.html"
  // Backend-rendered self-contained HTML for the item (quest/Babylon items
  // carry their whole UI here). NB: as embedded in /v2/items it targets the
  // real roadio.io host for events; we re-fetch via /item/<id>?client=web to
  // get the hash-bridge variant. See QuestItemFrame.
  html_payload?: string | null
  crossword_pre_fill: boolean | null
  coder_mode: boolean | null
  org_game_item_type: string | null // e.g. "road_point", "task"
  // True for premium road-quest (Babylon) items — drives the iframe renderer.
  is_quest?: boolean

  extra_details: ExtraDetails | null

  // Present depending on context; optional.
  parent_id?: number | null
  original_id?: string
  datastore_id?: string
  enabled?: boolean
  sticky?: boolean
  responses?: unknown[]
  quiz_id?: number | null
  org_game_id?: number | null

  // Quiz variant
  is_quiz?: boolean
  quiz_name?: string | null
  quiz_type?: string | null
  daily_date?: string | null
  last_quiz_item?: boolean

  // Place / quest-station variant
  place_name?: string
  is_station?: boolean
  place_lat?: number
  place_lng?: number

  // Occasionally present (markers carry these reliably; items not always).
  lat?: number
  lng?: number
  distance?: number
}
