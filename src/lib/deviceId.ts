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
