import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAPBOX_TOKEN } from '../../config'
import { useSession } from '../../store/session'
import { useDriving } from '../../store/driving'
import { useMarkers } from '../../store/markers'
import { useGeolocation } from '../driving/useGeolocation'
import { useDrivingLoop } from '../driving/useDrivingLoop'
import { useGeofence } from '../geofence/useGeofence'
import { useMapMarkers } from './useMapMarkers'
import { useProximity } from './useProximity'
import GameCard from '../games/GameCard'
import { t } from '../../lib/i18n'
import type { MapMarker, MapMarkersResponse } from '../../types'
import './MapScreen.css'

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

// Marker icons (downloaded from the backend's static set) keyed by image id.
const ICON_FILES: Record<string, string> = {
  'mk-item': '/markers/item.png',
  'mk-seen': '/markers/seen.png',
  'mk-mission': '/markers/mission.png',
  'mk-open': '/markers/open_mission.png',
  'mk-done': '/markers/completed_mission.png',
}

const GROUP_ICON: [keyof MapMarkersResponse, string][] = [
  ['items', 'mk-item'],
  ['seenItems', 'mk-seen'],
  ['missions', 'mk-mission'],
  ['openMissions', 'mk-open'],
  ['completedMissions', 'mk-done'],
]

type MarkerFC = GeoJSON.FeatureCollection<GeoJSON.Point>

/** Build a GeoJSON FeatureCollection from the grouped marker store. */
function buildMarkerFC(store: {
  items: MapMarker[]
  seenItems: MapMarker[]
  missions: MapMarker[]
  openMissions: MapMarker[]
  completedMissions: MapMarker[]
}): MarkerFC {
  const features: MarkerFC['features'] = []
  for (const [group, icon] of GROUP_ICON) {
    const list = store[group as keyof typeof store] as MapMarker[]
    for (const m of list ?? []) {
      const lng = Number(m.lng)
      const lat = Number(m.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      const label = m.content ?? m.map_label_info
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          icon,
          points: typeof m.score === 'number' ? m.score : 0,
          item_id: m.item_id ?? null,
          title: m.title ?? '',
          body: label && typeof label === 'object' ? (label.title ?? '') : '',
          link: label && typeof label === 'object' ? (label.link ?? '') : '',
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}

export default function MapScreen() {
  const navigate = useNavigate()
  const {
    locale,
    score,
    rank,
    nextItemKm,
    username,
    userLabel,
    avatar,
    gameName,
  } = useSession()
  const position = useDriving((s) => s.position)
  const setActive = useDriving((s) => s.setActive)
  const triggerItems = useDriving((s) => s.triggerItems)
  const markersStore = useMarkers()

  // Map screen drives the whole live loop.
  useGeolocation(true)
  useDrivingLoop(true)
  useGeofence(true)
  useMapMarkers(true)
  useProximity(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const userCarRef = useRef<mapboxgl.Marker | null>(null)
  const didCenter = useRef(false)
  const recenterTimer = useRef<number | null>(null)
  const resizeObs = useRef<ResizeObserver | null>(null)
  const [following, setFollowing] = useState(true)
  const [layersReady, setLayersReady] = useState(false)

  // Mark the session active while the map is mounted.
  useEffect(() => {
    setActive(true)
  }, [setActive])

  // Marker tap → infobox. Stable (reads from stores) so the GL layer click
  // handler registered at load time never goes stale.
  const openInfobox = useCallback(
    (props: Record<string, unknown>, ll: [number, number]) => {
      const map = mapRef.current
      if (!map) return
      const locale = useSession.getState().locale
      const title = String(props.title ?? '')
      const body = String(props.body ?? '')
      const link = String(props.link ?? '')
      const itemId = props.item_id
      const html = `
      <div class="ib">
        ${title ? `<div class="ib-title">${title}</div>` : ''}
        ${body ? `<div class="ib-body">${body}</div>` : ''}
        ${link ? `<a class="ib-link" href="${link}" target="_blank" rel="noreferrer">Waze ›</a>` : ''}
        ${itemId ? `<button class="ib-play">${t('start', locale)}</button>` : ''}
      </div>`
      popupRef.current?.remove()
      const popup = new mapboxgl.Popup({ offset: 24, closeButton: true })
        .setLngLat(ll)
        .setHTML(html)
        .addTo(map)
      popupRef.current = popup
      const btn = popup
        .getElement()
        ?.querySelector('.ib-play') as HTMLButtonElement | null
      btn?.addEventListener('click', () => {
        const item = useDriving
          .getState()
          .items.find((it) => String(it.id) === String(itemId))
        if (item) useDriving.getState().triggerItems([item])
        popup.remove()
      })
    },
    [],
  )

  // Init map once.
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: position ? [position.lng, position.lat] : [34.78, 32.08],
      zoom: 15,
      attributionControl: false,
    })
    // User pans → stop following. After 5s idle → auto-recenter & resume.
    map.on('dragstart', () => {
      setFollowing(false)
      if (recenterTimer.current) window.clearTimeout(recenterTimer.current)
    })
    map.on('dragend', () => {
      if (recenterTimer.current) window.clearTimeout(recenterTimer.current)
      recenterTimer.current = window.setTimeout(() => {
        const p = useDriving.getState().position
        if (p) map.easeTo({ center: [p.lng, p.lat], zoom: 15, duration: 600 })
        setFollowing(true)
      }, 5000)
    })
    map.on('load', async () => {
      map.resize()
      // Load marker icon images.
      await Promise.all(
        Object.entries(ICON_FILES).map(
          (entry) =>
            new Promise<void>((resolve) => {
              const [id, url] = entry
              if (map.hasImage(id)) return resolve()
              map.loadImage(url, (err, image) => {
                if (!err && image && !map.hasImage(id)) map.addImage(id, image)
                resolve()
              })
            }),
        ),
      )
      if (!map.getSource('markers')) {
        map.addSource('markers', {
          type: 'geojson',
          data: buildMarkerFC(useMarkers.getState()),
        })
        map.addLayer({
          id: 'mk-icons',
          type: 'symbol',
          source: 'markers',
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': 0.3,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
          },
        })
        // Orange points coin, fixed top-right of the icon (viewport-anchored).
        map.addLayer({
          id: 'mk-coin',
          type: 'circle',
          source: 'markers',
          filter: ['>', ['get', 'points'], 0],
          paint: {
            'circle-radius': 11,
            'circle-color': '#f5a623',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
            'circle-translate': [12, -34],
            'circle-translate-anchor': 'viewport',
          },
        })
        map.addLayer({
          id: 'mk-coin-text',
          type: 'symbol',
          source: 'markers',
          filter: ['>', ['get', 'points'], 0],
          layout: {
            'text-field': ['to-string', ['get', 'points']],
            'text-size': 11,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#fff',
            'text-translate': [12, -34],
            'text-translate-anchor': 'viewport',
          },
        })
        map.on('click', 'mk-icons', (e) => {
          const f = e.features?.[0]
          if (f && f.geometry.type === 'Point') {
            openInfobox(
              f.properties ?? {},
              f.geometry.coordinates as [number, number],
            )
          }
        })
        map.on('mouseenter', 'mk-icons', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'mk-icons', () => {
          map.getCanvas().style.cursor = ''
        })
      }
      setLayersReady(true)
    })
    // Keep the GL canvas matched to its container. Without this the projection
    // is computed against a stale size, so the user car renders off-centre.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    resizeObs.current = ro
    mapRef.current = map
    return () => {
      if (recenterTimer.current) window.clearTimeout(recenterTimer.current)
      resizeObs.current?.disconnect()
      resizeObs.current = null
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the user + keep the user's car marker on their position.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    const ll: [number, number] = [position.lng, position.lat]
    if (!userCarRef.current) {
      const el = document.createElement('div')
      el.className = 'mk-user'
      el.innerHTML =
        '<span class="mk-user-radius"></span><img class="mk-user-van" src="/car.png" alt="" />'
      userCarRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(ll)
        .addTo(map)
    } else {
      userCarRef.current.setLngLat(ll)
    }
    if (!didCenter.current) {
      map.jumpTo({ center: ll, zoom: 15 })
      didCenter.current = true
    } else if (following) {
      map.easeTo({ center: ll, duration: 800 })
    }
  }, [position, following])

  // Push marker data into the GL source whenever it changes (GPU-rendered
  // symbol/circle layers — no DOM markers, so nothing "swims" on zoom).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReady) return
    const src = map.getSource('markers') as mapboxgl.GeoJSONSource | undefined
    src?.setData(buildMarkerFC(markersStore))
  }, [markersStore, layersReady])

  return (
    <div className="map-screen">
      {!MAPBOX_TOKEN && (
        <div className="map-noToken">Set VITE_MAPBOX_TOKEN (pk.) in .env.local</div>
      )}
      <div ref={containerRef} className="map-canvas" />

      {/* Top HUD: Points + Place stats and the user avatar/name. */}
      <div className="map-top">
        <div className="map-top-stats">
          <div className="map-stat">
            <span className="map-stat-lbl">{t('points', locale)}</span>
            <span className="map-stat-row">
              <span className="map-stat-val">{score}</span>
              <span className="map-stat-ic">⭐</span>
            </span>
          </div>
          <div className="map-stat">
            <span className="map-stat-lbl">{t('place', locale)}</span>
            <span className="map-stat-row">
              <span className="map-stat-val">{rank}</span>
              <span className="map-stat-ic">⚡</span>
            </span>
          </div>
        </div>
        <button className="map-user" onClick={() => navigate('/babylon')}>
          <div className="map-user-txt">
            <span className="map-user-name">{username || 'guest'}</span>
            <span className="map-user-sub">
              {userLabel || t('registerHere', locale)}
            </span>
          </div>
          <span className="map-user-avatar">
            {avatar ? <img src={avatar} alt="" /> : '🚐'}
          </span>
        </button>
      </div>

      {/* Top-left ROADIO logo badge. */}
      <img className="map-logo" src="/roadio-logo.png" alt="Roadio" />

      {/* Floating next-item distance pill. */}
      <div className="map-nearby">
        <span className="map-nearby-lbl">{t('nearbyItem', locale)}</span>
        <span className="map-nearby-val">
          {nextItemKm} <span className="map-nearby-unit">km</span>
        </span>
      </div>

      {!following && (
        <button
          className="map-recenter-btn"
          aria-label="recenter"
          onClick={() => {
            setFollowing(true)
            const p = useDriving.getState().position
            if (p && mapRef.current)
              mapRef.current.easeTo({ center: [p.lng, p.lat], zoom: 15 })
          }}
        >
          ◎
        </button>
      )}

      {/* Bottom-center current-game card → game selection. */}
      <div className="map-gamecard">
        <span className="map-gamecard-lbl">{t('currentGame', locale)}</span>
        <span className="map-gamecard-name">{gameName || 'Trivia on your way'}</span>
        <button className="map-gamecard-btn" onClick={() => navigate('/daily')}>
          {t('moreGames', locale)} ›
        </button>
      </div>

      {import.meta.env.DEV && (
        <button
          className="map-dev-btn"
          onClick={async () => {
            const { SAMPLE_ITEMS } = await import('../games/sampleItems')
            triggerItems(SAMPLE_ITEMS)
          }}
        >
          🃏 dev
        </button>
      )}

      <GameCard />
    </div>
  )
}
