// Thin fetch wrapper. Every request goes to `${API_PREFIX}${path}`, which the
// Vite dev proxy forwards to the Flask backend with Basic auth injected.
// Endpoints (Phase 2) build on top of this.

import { API_PREFIX } from '../config'

export class ApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`API ${status}: ${body.slice(0, 200)}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new ApiError(res.status, text)
  // Most endpoints return JSON; some return empty bodies.
  return (text ? JSON.parse(text) : undefined) as T
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parse<T>(res)
}

/** Some backend routes (e.g. /v3/bavel_order) expect form-encoded bodies. */
export async function postForm<T>(
  path: string,
  fields: Record<string, string>,
): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })
  return parse<T>(res)
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`)
  return parse<T>(res)
}
