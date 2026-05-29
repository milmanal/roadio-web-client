import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { CardProps } from '../cardProps'
import { MediaBlock } from '../MediaBlock'
import { MAPBOX_TOKEN } from '../../../config'
import { useDriving } from '../../../store/driving'

// geoguess: drop a pin on the map; the backend scores it against the hidden
// answer polygon. The answer is sent as [lat, lng] (server reads answer[0]=lat,
// answer[1]=lng — see roadio_item.py).
export default function GeoGuessCard({
  point,
  result,
  busy,
  onSubmit,
  onContinue,
}: CardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const [guess, setGuess] = useState<[number, number] | null>(null)
  const startPos = useDriving.getState().position
  const answered = result != null

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: startPos ? [startPos.lng, startPos.lat] : [0, 20],
      zoom: startPos ? 9 : 1.4,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-left')
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat
      setGuess([lat, lng])
      if (markerRef.current) markerRef.current.setLngLat([lng, lat])
      else markerRef.current = new mapboxgl.Marker({ color: '#4cc2ff' })
        .setLngLat([lng, lat])
        .addTo(map)
    })
    map.on('load', () => map.resize())
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [startPos])

  return (
    <div className="card-inner">
      {point.question && <h2 className="card-q">{point.question}</h2>}
      <MediaBlock images={point.question_images} voice={point.question_voice} />
      {point.story && <p className="card-story">{point.story}</p>}
      <MediaBlock images={point.story_images} />

      {MAPBOX_TOKEN ? (
        <div ref={containerRef} className="geo-map" />
      ) : (
        <p className="conn conn-error">
          Map needs VITE_MAPBOX_TOKEN (public pk. token) in .env.local.
        </p>
      )}

      {!answered ? (
        <button
          disabled={busy || !guess}
          onClick={() => guess && onSubmit(guess)}
        >
          {guess ? 'שלח ניחוש' : 'בחרו נקודה על המפה'}
        </button>
      ) : (
        <div className="feedback">
          <div className="fb-good">✓ הניחוש נשלח</div>
          <button disabled={busy} onClick={onContinue}>
            המשך
          </button>
        </div>
      )}
    </div>
  )
}
