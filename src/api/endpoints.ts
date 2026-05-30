// Typed endpoint functions. Routes/bodies verified against CONTRACTS.md and the
// live Heroku backend. The old Android `/v2/items` report path is now the
// dedicated `POST /v2/events` route.

import { getJson, postForm, postJson } from './client'
import { APP_VERSION } from '../config'
import type {
  BavelOrderResponse,
  Configuration,
  EventsRequest,
  EventsResponse,
  FetchItemsRequest,
  GameScheduleResponse,
  GeofenceResponse,
  MapMarkersRequest,
  MapMarkersResponse,
  Mood,
  ProfileResponse,
  PurchaseUpdateRequest,
  PushTokenRequest,
  ReportEvent,
  RoadPointsResponse,
  Town,
  UserQuizzesResponse,
} from '../types'

/** "next_event" — sent as an event's answer to advance/dismiss a card. */
export const NEXT_EVENT = 'next_event'

export function getUserConfig(params: {
  userId: string
  locale?: string
}): Promise<Configuration> {
  const q = params.locale ? `?locale=${encodeURIComponent(params.locale)}` : ''
  return postJson<Configuration>(`/v2/user_config${q}`, {
    user_id: params.userId,
    version: APP_VERSION,
  })
}

/** Fetch road points for the current position. */
export function fetchItems(req: Partial<FetchItemsRequest> & {
  user_id: string
}): Promise<RoadPointsResponse> {
  const body: FetchItemsRequest = { version: APP_VERSION, ...req }
  return postJson<RoadPointsResponse>('/v2/items', body)
}

/** Report answers/results. `events` is a map keyed by item id. */
export function reportEvents(req: {
  user_id: string
  events: Record<string, ReportEvent>
  lat?: string | number | null
  lng?: string | number | null
  game_time_left?: number | null
}): Promise<EventsResponse> {
  const body: EventsRequest = {
    version: APP_VERSION,
    user_id: req.user_id,
    events: req.events,
    lat: req.lat,
    lng: req.lng,
    game_time_left: req.game_time_left,
  }
  return postJson<EventsResponse>('/v2/events', body)
}

/** Convenience: report a single item's answer. */
export function reportAnswer(params: {
  user_id: string
  itemId: number | string
  answer: ReportEvent['answer']
  lat?: string | number | null
  lng?: string | number | null
}): Promise<EventsResponse> {
  return reportEvents({
    user_id: params.user_id,
    lat: params.lat,
    lng: params.lng,
    events: { [String(params.itemId)]: { answer: params.answer } },
  })
}

export function getMapMarkers(
  req: Omit<MapMarkersRequest, 'version'>,
): Promise<MapMarkersResponse> {
  return postJson<MapMarkersResponse>('/v3/map_markers', {
    version: APP_VERSION,
    ...req,
  })
}

export function getGeofences(pos?: {
  lat: string | number
  lng: string | number
}): Promise<GeofenceResponse[]> {
  const q = pos ? `?lat=${pos.lat}&lng=${pos.lng}` : ''
  return getJson<GeofenceResponse[]>(`/v2/geofence${q}`)
}

/** Quizzes available to the user (daily quiz list). Form-encoded. */
export function getUserQuizzes(params: {
  userId: string
  locale?: string | null
}): Promise<UserQuizzesResponse> {
  const fields: Record<string, string> = {
    user_id: params.userId,
    version: APP_VERSION,
  }
  if (params.locale) fields.locale = params.locale
  return postForm<UserQuizzesResponse>('/v2/user_quizzes', fields)
}

/** Profile header + leaderboard boards (profile / press-your-name screen). */
export function getProfile(params: {
  userId: string
  locale?: string | null
  game_id?: number | null
}): Promise<ProfileResponse> {
  return postJson<ProfileResponse>('/v2/profile', {
    user_id: params.userId,
    version: APP_VERSION,
    locale: params.locale ?? undefined,
    game_id: params.game_id ?? undefined,
  })
}

/** Settlement options for the registration dropdown. */
export function getTowns(): Promise<Town[]> {
  return getJson<{ towns: Town[] }>('/v2/towns').then((r) => r.towns ?? [])
}

/** Avatar/mood options for registration (the 6 vans). */
export function getMoods(): Promise<Mood[]> {
  return getJson<{ moods: Mood[] }>('/v2/moods').then((r) => r.moods ?? [])
}

/** Register/link a named user. Returns the refreshed configuration. */
export function registerUser(fields: {
  userId: string
  email: string
  nickname: string
  join_contest: boolean
  town_id?: number | string | null
  mood_id?: string | null
  game_code?: string | null
}): Promise<Configuration> {
  return postJson<Configuration>('/v2/register', {
    user_id: fields.userId,
    version: APP_VERSION,
    email: fields.email,
    nickname: fields.nickname,
    join_contest: fields.join_contest,
    town_id: fields.town_id ?? null,
    mood_id: fields.mood_id ?? null,
    game_code: fields.game_code ?? '',
  })
}

export function subscribePush(req: PushTokenRequest): Promise<unknown> {
  return postJson<unknown>('/v2/push_notif_token', req)
}

export function updatePurchase(req: PurchaseUpdateRequest): Promise<Configuration> {
  return postJson<Configuration>('/v2/purchase_update', req)
}

/** Babylon premium game ("מכונת בבל"). game_id 496. */
export const BABYLON_GAME_ID = '496'

/**
 * Babylon premium game order / lead-capture. Form-encoded, NO Basic auth
 * (proxy adds it harmlessly). game_id defaults to 496.
 * NOTE: response `status` is always "success" — gate UI on `message`, not status.
 */
export function bavelOrder(fields: {
  username: string
  phone_number?: string
  game_id?: string
}): Promise<BavelOrderResponse> {
  return postForm<BavelOrderResponse>('/v3/bavel_order', {
    game_id: fields.game_id ?? BABYLON_GAME_ID,
    username: fields.username,
    phone_number: fields.phone_number ?? '',
  })
}

/**
 * Schedule a Babylon game session for a date. Form-encoded; mirrors bavelOrder.
 * game_id defaults to 496. Same status/message gotcha as bavelOrder.
 */
export function gameWebSchedule(fields: {
  username: string
  phone_number?: string
  picked_date: string
  game_id?: string
}): Promise<GameScheduleResponse> {
  return postForm<GameScheduleResponse>('/v3/game_web_schedule', {
    game_id: fields.game_id ?? BABYLON_GAME_ID,
    username: fields.username,
    phone_number: fields.phone_number ?? '',
    picked_date: fields.picked_date,
  })
}
