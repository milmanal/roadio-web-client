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
import { makeMarkerEl } from './markerElements'
import type { MarkerKind } from './markerElements'
import GameCard from '../games/GameCard'
import { t } from '../../lib/i18n'
import type { MapMarker } from '../../types'
import './MapScreen.css'

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12'

function lngLat(m: MapMarker): [number, number] | null {
  const lng = Number(m.lng)
  const lat = Number(m.lat)
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
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

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const markerObjs = useRef<Record<string, mapboxgl.Marker>>({})
  const userCarRef = useRef<mapboxgl.Marker | null>(null)
  const didCenter = useRef(false)
  const recenterTimer = useRef<number | null>(null)
  const resizeObs = useRef<ResizeObserver | null>(null)
  const [following, setFollowing] = useState(true)

  // Mark the session active while the map is mounted.
  useEffect(() => {
    setActive(true)
  }, [setActive])

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
    map.on('load', () => map.resize())
    // Keep the GL canvas matched to its container. Without this the projection
    // is computed against a stale size, so the user car renders off-centre and
    // every marker drifts on zoom.
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
      markerObjs.current = {}
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

  const openInfobox = useCallback(
    (m: MapMarker, ll: [number, number]) => {
      const map = mapRef.current
      if (!map) return
      const title = m.title ?? ''
      const label = m.content ?? m.map_label_info
      const link = label && typeof label === 'object' ? label.link : undefined
      const body = label && typeof label === 'object' ? label.title : undefined
      const html = `
      <div class="ib">
        ${title ? `<div class="ib-title">${title}</div>` : ''}
        ${body ? `<div class="ib-body">${body}</div>` : ''}
        ${link ? `<a class="ib-link" href="${link}" target="_blank" rel="noreferrer">Waze ›</a>` : ''}
        ${m.item_id ? `<button class="ib-play" data-item="${m.item_id}">${t('start', locale)}</button>` : ''}
      </div>`
      popupRef.current?.remove()
      const popup = new mapboxgl.Popup({ offset: 28, closeButton: true })
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
          .items.find((it) => String(it.id) === String(m.item_id))
        if (item) triggerItems([item])
        popup.remove()
      })
    },
    [locale, triggerItems],
  )

  // Sync markers to the map (diff add/remove).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const groups: [MarkerKind, MapMarker[]][] = [
      ['item', markersStore.items],
      ['mission', markersStore.missions],
      ['openMission', markersStore.openMissions],
      ['completedMission', markersStore.completedMissions],
      ['seenItem', markersStore.seenItems],
      ['car', markersStore.cars],
    ]
    const desired: Record<string, { kind: MarkerKind; m: MapMarker }> = {}
    for (const [kind, list] of groups) {
      for (const m of list) desired[`${kind}:${m.marker_id}`] = { kind, m }
    }

    // Remove stale.
    for (const key of Object.keys(markerObjs.current)) {
      if (!desired[key]) {
        markerObjs.current[key].remove()
        delete markerObjs.current[key]
      }
    }
    // Add new.
    for (const [key, { kind, m }] of Object.entries(desired)) {
      if (markerObjs.current[key]) continue
      const ll = lngLat(m)
      if (!ll) continue
      const el = makeMarkerEl(kind, m)
      el.addEventListener('click', () => openInfobox(m, ll))
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(ll)
        .addTo(map)
      markerObjs.current[key] = marker
    }
  }, [markersStore, openInfobox])

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
