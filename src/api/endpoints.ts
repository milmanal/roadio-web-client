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
  GeofenceResponse,
  MapMarkersRequest,
  MapMarkersResponse,
  PurchaseUpdateRequest,
  PushTokenRequest,
  ReportEvent,
  RoadPointsResponse,
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

export function subscribePush(req: PushTokenRequest): Promise<unknown> {
  return postJson<unknown>('/v2/push_notif_token', req)
}

export function updatePurchase(req: PurchaseUpdateRequest): Promise<Configuration> {
  return postJson<Configuration>('/v2/purchase_update', req)
}

/** Babylon premium game order. Form-encoded, per the backend handler. */
export function bavelOrder(fields: {
  game_id: string
  username: string
  phone_number?: string
}): Promise<BavelOrderResponse> {
  return postForm<BavelOrderResponse>('/v3/bavel_order', {
    game_id: fields.game_id,
    username: fields.username,
    phone_number: fields.phone_number ?? '',
  })
}
