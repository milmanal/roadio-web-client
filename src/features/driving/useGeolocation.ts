// Wraps navigator.geolocation.watchPosition into a hook that pushes fixes into
// the driving store while active. Requires a secure context (https or
// localhost). Geolocation permission is requested on first start.

import { useEffect, useState } from 'react'
import { useDriving } from '../../store/driving'

export interface GeoError {
  code: number
  message: string
}

const UNSUPPORTED: GeoError = {
  code: -1,
  message: 'Geolocation unavailable in this browser',
}

export function useGeolocation(active: boolean) {
  const setPosition = useDriving((s) => s.setPosition)
  const [error, setError] = useState<GeoError | null>(() =>
    'geolocation' in navigator ? null : UNSUPPORTED,
  )

  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          ts: pos.timestamp,
        })
      },
      (err) => setError({ code: err.code, message: err.message }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [active, setPosition])

  return { error }
}
