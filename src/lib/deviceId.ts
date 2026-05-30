// Anonymous, persistent identity. Mirrors the Android client's device id
// (Application.getDeviceId()). The backend keys all user state off `user_id`;
// there is no login. We generate a UUID once and keep it in localStorage.

const KEY = 'roadio.device_id'

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

/**
 * Dev only: switch the persisted device id and reload. A fresh guest has no
 * selected game, so the backend returns 0 map markers — pass a populated demo
 * id (e.g. `web-probe-1`, which has a game selected + ~178 markers) to drive
 * real items in the simulator. Pass `null` to fall back to a fresh guest.
 */
export function setDeviceId(id: string | null): void {
  if (id) localStorage.setItem(KEY, id)
  else localStorage.removeItem(KEY)
  location.reload()
}

/** Dev demo user with a game selected (real markers across Tel Aviv). */
export const DEMO_USER_ID = 'web-probe-1'
