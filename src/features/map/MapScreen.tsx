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
import { useProximity, TRIGGER_RADIUS_M } from './useProximity'
import { useQuestMusic } from './useQuestMusic'
import { useSimDrive, SIM_ROUTES } from './useSimDrive'
import { useQuestTestDrive, startFreshBabelUser, skipCurrentClip } from '../dev/questTest'
import GameCard from '../games/GameCard'
import QuestMapOverlay from './QuestMapOverlay'
import { t } from '../../lib/i18n'
import { distanceMeters } from '../../lib/geo'
import { getDeviceId, setDeviceId, DEMO_USER_ID } from '../../lib/deviceId'
import type { Configuration, MapMarker, MapMarkersResponse } from '../../types'
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

// store group → [local fallback icon id, markers_v2 type key]
const GROUP_ICON: [keyof MapMarkersResponse, string, string][] = [
  ['items', 'mk-item', 'item'],
  ['seenItems', 'mk-seen', 'seen_item'],
  ['missions', 'mk-mission', 'mission'],
  ['openMissions', 'mk-open', 'open_mission'],
  ['completedMissions', 'mk-done', 'completed_mission'],
]

type MarkerFC = GeoJSON.FeatureCollection<GeoJSON.Point>

// ---- camera ----
const DEFAULT_ZOOM = 15
const MIN_ZOOM = 12
const MAX_ZOOM = 15.5
/** Tilt while driving, so more of the road ahead fits at the same zoom. */
const DRIVE_PITCH = 35
/** While driving the puck sits below centre: this share of the screen height
 *  is given to the road ahead. */
const DRIVE_TOP_SHARE = 0.28
/** Pins farther than this don't pull the zoom out. */
const ZOOM_REACH_M = 5000

/**
 * Zoom at which a point `meters` away sits `pixels` from the puck. Mapbox GL
 * uses 512px tiles: 78271.5 m/px at zoom 0 on the equator.
 */
function zoomToFit(meters: number, pixels: number, lat: number): number {
  const metersPerPixel = Math.max(meters, 1) / pixels
  return Math.log2((78271.5 * Math.cos((lat * Math.PI) / 180)) / metersPerPixel)
}

/** Ground circle (true meters) around a position, as a polygon ring. */
function radiusRing(lng: number, lat: number, meters: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = meters / 111320
  const dLng = dLat / Math.cos((lat * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

// Navigation puck: a small dot with a heading arrow that shows while moving.
const PUCK_HTML =
  '<span class="mk-user-pulse"></span>' +
  '<span class="mk-user-dot">' +
  '<svg class="mk-user-arrow" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M12 3.5 19 19.5 12 15.8 5 19.5Z" fill="#fff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
  '</svg></span>'

function isQuestConfig(c: Configuration | null | undefined): boolean {
  return !!(c?.is_quest || c?.is_road_quest)
}

/**
 * Resolve a marker's server-driven icon URL from `markers_v2[typeKey]` by
 * family, falling back to the `default` family. Returns null when config has
 * no entry (caller then uses the local default icon id).
 */
function serverIconUrl(
  markersV2: Configuration['markers_v2'],
  typeKey: string,
  family: string | null | undefined,
): string | null {
  const styles = markersV2?.[typeKey]
  if (!styles?.length) return null
  const fam = family ?? 'default'
  const hit = styles.find((s) => s.family === fam) ?? styles.find((s) => s.family === 'default')
  return hit?.icon ?? null
}

/**
 * Build a GeoJSON FeatureCollection from the grouped marker store. Each feature
 * gets the server family icon (URL used as the image id) when config provides
 * one AND the map has already loaded it (`isLoaded`); otherwise the local
 * default icon id, so markers always draw and upgrade to server art on load.
 */
function buildMarkerFC(
  store: {
    items: MapMarker[]
    seenItems: MapMarker[]
    missions: MapMarker[]
    openMissions: MapMarker[]
    completedMissions: MapMarker[]
  },
  markersV2?: Configuration['markers_v2'],
  isLoaded?: (id: string) => boolean,
  /** Quest mode: draw station (mission) markers only with their real station
   *  icon. The local default mission art is a blue "1000 points" task scroll,
   *  which must never stand in for a quest station. */
  questStationsOnly = false,
): MarkerFC {
  const features: MarkerFC['features'] = []
  for (const [group, localIcon, typeKey] of GROUP_ICON) {
    const list = store[group as keyof typeof store] as MapMarker[]
    const isMissionGroup = typeKey.includes('mission')
    for (const m of list ?? []) {
      const lng = Number(m.lng)
      const lat = Number(m.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      const label = m.content ?? m.map_label_info
      const srvUrl = serverIconUrl(markersV2, typeKey, m.family)
      const srvReady = !!srvUrl && !!isLoaded?.(srvUrl)
      if (questStationsOnly && isMissionGroup && !srvReady) continue
      const icon = srvReady ? (srvUrl as string) : localIcon
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
          content: typeof m.content === 'string' ? m.content : '',
          item_type: m.type ?? '',
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
  const markersV2 = useDriving((s) => s.config?.markers_v2)
  // Quest (Babylon) chrome replaces the default trivia HUD when active.
  const quest = useDriving((s) => s.config?.quest)
  const isQuest = useDriving((s) => isQuestConfig(s.config))
  const markersStore = useMarkers()

  // Dev: simulated driving takes over the position feed (real geolocation +
  // marker polling switched off), fetches the real markers for the picked
  // route's area, and walks the car along it so questions pop as you pass pins.
  const [simRoute, setSimRoute] = useState<string | null>(null)
  const sim = simRoute != null
  // Dev: Babel quest test drive (see features/dev/questTest.ts). Keeps the
  // real /v2/items loop running, unlike the route simulator above.
  // Survives reloads (sessionStorage) so a test run can continue after one.
  const [questDrive, setQuestDriveState] = useState(
    () => import.meta.env.DEV && sessionStorage.getItem('roadio.questDrive') === '1',
  )
  const setQuestDrive = (update: (v: boolean) => boolean) =>
    setQuestDriveState((v) => {
      const next = update(v)
      sessionStorage.setItem('roadio.questDrive', next ? '1' : '0')
      return next
    })

  // Destination prompt — stored in sessionStorage, reset each session.
  const [destination, setDestination] = useState(() =>
    sessionStorage.getItem('roadio.destination') ?? '',
  )
  const [destEditing, setDestEditing] = useState(false)
  const [destDraft, setDestDraft] = useState('')
  const [destSuggestions, setDestSuggestions] = useState<string[]>([])
  const destDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function fetchDestSuggestions(query: string) {
    if (destDebounce.current) clearTimeout(destDebounce.current)
    if (query.length < 2) { setDestSuggestions([]); return }
    destDebounce.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=he&country=IL&types=place,locality,neighborhood,address&limit=3`
        const res = await fetch(url)
        const data = await res.json()
        setDestSuggestions((data.features ?? []).map((f: { place_name: string }) => f.place_name))
      } catch { setDestSuggestions([]) }
    }, 300)
  }

  function saveDestination(v: string) {
    const val = v.trim()
    setDestination(val)
    sessionStorage.setItem('roadio.destination', val)
    setDestEditing(false)
    setDestSuggestions([])
  }

  // Map screen drives the whole live loop.
  useGeolocation(!sim && !questDrive)
  useDrivingLoop(!sim)
  useGeofence(true)
  useMapMarkers(!sim)
  useProximity(true)
  useSimDrive(simRoute)
  useQuestTestDrive(questDrive)
  // Babylon quest map ambience (looping; pauses while a card is open).
  useQuestMusic(quest?.map_music, isQuest)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const userCarRef = useRef<mapboxgl.Marker | null>(null)
  const didCenter = useRef(false)
  const recenterTimer = useRef<number | null>(null)
  const resizeObs = useRef<ResizeObserver | null>(null)
  // Server marker icons loaded into the GL style, keyed by their URL (also the
  // mapbox image id). `loading` guards against duplicate in-flight loads.
  const loadedIcons = useRef<Set<string>>(new Set())
  const loadingIcons = useRef<Set<string>>(new Set())
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
      const link = String(props.link ?? '')
      const itemId = props.item_id
      const typeLabel = String(props.title ?? props.item_type ?? '')

      // content arrives as HTML from the server — strip tags to get plain text.
      function stripHtml(s: string) {
        return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      }
      function trim(s: string) { return s.length > 72 ? s.slice(0, 70) + '…' : s }

      function makeHtml(teaser: string) {
        return `<div class="ib">
          ${typeLabel ? `<div class="ib-type">${typeLabel}</div>` : ''}
          ${teaser ? `<div class="ib-teaser">${teaser}</div>` : ''}
          ${link ? `<a class="ib-link" href="${link}" target="_blank" rel="noreferrer">Waze ›</a>` : ''}
        </div>`
      }

      // Road point in driving store → question text; else strip HTML from marker content.
      const cached = itemId
        ? useDriving.getState().items.find((it) => String(it.id) === String(itemId))
        : null
      const rawContent = stripHtml(String(props.content ?? ''))
      const initialTeaser = trim(cached?.question ?? rawContent)
      const html = makeHtml(initialTeaser)
      popupRef.current?.remove()
      const popup = new mapboxgl.Popup({ offset: 24, closeButton: true })
        .setLngLat(ll)
        .setHTML(html)
        .addTo(map)
      popupRef.current = popup

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
      zoom: DEFAULT_ZOOM,
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
        if (p) map.easeTo({ center: [p.lng, p.lat], duration: 600 })
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
      // The game pins are the content here: drop the stock shop / hotel /
      // transit labels that compete with them.
      for (const id of ['poi-label', 'transit-label']) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
      }
      // Trigger radius on the ground in real meters (so it scales with zoom
      // and tilts with the map), drawn under the pins.
      if (!map.getSource('user-radius')) {
        const p = useDriving.getState().position
        map.addSource('user-radius', {
          type: 'geojson',
          data: p ? radiusRing(p.lng, p.lat, TRIGGER_RADIUS_M) : EMPTY_FC,
        })
        map.addLayer({
          id: 'user-radius-fill',
          type: 'fill',
          source: 'user-radius',
          paint: { 'fill-color': '#36c0f6', 'fill-opacity': 0.14 },
        })
        map.addLayer({
          id: 'user-radius-line',
          type: 'line',
          source: 'user-radius',
          paint: { 'line-color': '#36c0f6', 'line-opacity': 0.6, 'line-width': 1.5 },
        })
      }
      if (!map.getSource('markers')) {
        map.addSource('markers', {
          type: 'geojson',
          data: buildMarkerFC(
            useMarkers.getState(),
            undefined,
            undefined,
            isQuestConfig(useDriving.getState().config),
          ),
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
            'circle-radius': 8.5,
            'circle-color': '#f5a623',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
            'circle-translate': [9, -27],
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
            'text-size': 9,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#fff',
            'text-translate': [9, -27],
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
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__map = map
    return () => {
      if (recenterTimer.current) window.clearTimeout(recenterTimer.current)
      resizeObs.current?.disconnect()
      resizeObs.current = null
      // Remove the car marker before the map is destroyed so the ref is
      // nulled out — otherwise the stale Marker object (detached from the old
      // map) prevents the position effect from re-adding it to the new map.
      userCarRef.current?.remove()
      userCarRef.current = null
      didCenter.current = false
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the user: centre, heading, tilt and zoom go out in ONE easeTo call.
  // Separate easeTo calls on the same tick cancel each other (the later one
  // wins), which used to drop the follow whenever the zoom changed.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !position) return
    const ll: [number, number] = [position.lng, position.lat]

    const { heading, speed } = position
    const moving = (speed ?? 0) > 1
    const stopped = (speed ?? 0) < 0.5

    // Create the puck on first fix. The MAP rotates to the heading, so the
    // puck's arrow always points up the screen and never rotates itself.
    if (!userCarRef.current) {
      const el = document.createElement('div')
      el.className = 'mk-user'
      el.innerHTML = PUCK_HTML
      userCarRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(ll)
        .addTo(map)
    } else {
      userCarRef.current.setLngLat(ll)
    }
    userCarRef.current.getElement().classList.toggle('is-moving', moving && heading != null)
    const radiusSrc = map.getSource('user-radius') as mapboxgl.GeoJSONSource | undefined
    radiusSrc?.setData(radiusRing(position.lng, position.lat, TRIGGER_RADIUS_M))

    if (!didCenter.current) {
      map.jumpTo({ center: ll, zoom: DEFAULT_ZOOM, bearing: 0 })
      didCenter.current = true
      return
    }

    const opts: Parameters<mapboxgl.Map['easeTo']>[0] = { duration: 500 }
    if (heading != null && moving) opts.bearing = heading
    else if (stopped) opts.bearing = 0

    if (following) {
      opts.center = ll
      // Driving: tilt the map and drop the puck toward the bottom, so the
      // screen is spent on the road ahead. Parked: flat, north-up, centred.
      const canvas = map.getCanvas()
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      opts.pitch = moving ? DRIVE_PITCH : 0
      opts.padding = { top: moving ? h * DRIVE_TOP_SHARE : 0, bottom: 0, left: 0, right: 0 }

      // Zoom so the nearest unplayed pin is on screen, and back in as it gets
      // close: no closer than street level, no farther out than a few km.
      const { items, missions, openMissions } = useMarkers.getState()
      let nearest = Infinity
      for (const m of [...items, ...missions, ...openMissions]) {
        const d = distanceMeters(position.lat, position.lng, Number(m.lat), Number(m.lng))
        if (d < nearest) nearest = d
      }
      const target =
        nearest <= ZOOM_REACH_M
          ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomToFit(nearest, Math.min(w, h) * 0.36, position.lat)))
          : DEFAULT_ZOOM
      // Ignore small differences so the zoom doesn't breathe on every tick.
      if (Math.abs(target - map.getZoom()) > 0.2) opts.zoom = target
    }

    if (opts.center || opts.bearing != null) map.easeTo(opts)
  }, [position, following, layersReady, markersStore.items, markersStore.missions, markersStore.openMissions])

  // Push marker data into the GL source whenever markers OR the server icon
  // config change (GPU-rendered symbol/circle layers — no DOM markers, so
  // nothing "swims" on zoom). Markers draw immediately with local default art,
  // then lazily upgrade to per-family server icons as each PNG finishes
  // loading (a load triggers a re-setData so the upgraded id takes effect).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersReady) return
    const isLoaded = (id: string) => loadedIcons.current.has(id)
    const setData = () => {
      const src = map.getSource('markers') as mapboxgl.GeoJSONSource | undefined
      src?.setData(buildMarkerFC(useMarkers.getState(), markersV2, isLoaded, isQuest))
    }
    setData()

    // Kick off loads for any referenced server icons not yet in the style.
    if (!markersV2) return
    const wanted = new Set<string>()
    // Quest: preload every station icon up front so each new station appears
    // with its real icon at once (it is hidden until loaded — see above).
    if (isQuest) {
      for (const [, , typeKey] of GROUP_ICON) {
        if (!typeKey.includes('mission')) continue
        for (const s of markersV2[typeKey] ?? []) if (s.icon) wanted.add(s.icon)
      }
    }
    for (const [group, , typeKey] of GROUP_ICON) {
      const list = markersStore[group as keyof typeof markersStore] as MapMarker[]
      for (const m of list ?? []) {
        const url = serverIconUrl(markersV2, typeKey, m.family)
        if (url) wanted.add(url)
      }
    }
    for (const url of wanted) {
      if (loadedIcons.current.has(url) || loadingIcons.current.has(url)) continue
      loadingIcons.current.add(url)
      map.loadImage(url, (err, image) => {
        loadingIcons.current.delete(url)
        if (err || !image) return
        if (!map.hasImage(url)) map.addImage(url, image)
        loadedIcons.current.add(url)
        setData() // re-render so features pick up the now-loaded icon
      })
    }
  }, [markersStore, markersV2, layersReady, isQuest])

  return (
    <div className="map-screen">
      {!MAPBOX_TOKEN && (
        <div className="map-noToken">Set VITE_MAPBOX_TOKEN (pk.) in .env.local</div>
      )}
      <div ref={containerRef} className="map-canvas" />

      {/* Quest (Babylon) chrome replaces the default trivia HUD. */}
      {isQuest && quest && <QuestMapOverlay quest={quest} />}

      {/* Top HUD: Points + Place stats and the user avatar/name. */}
      {!isQuest && (
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
        <button className="map-user" onClick={() => navigate('/profile')}>
          <div className="map-user-txt">
            <span className="map-user-name">{username || 'guest'}</span>
            <span className="map-user-sub">
              {userLabel || (!username ? t('registerHere', locale) : '')}
            </span>
          </div>
          <span className="map-user-avatar">
            {avatar ? <img src={avatar} alt="" /> : '🚐'}
          </span>
        </button>
      </div>
      )}

      {/* Floating next-item distance pill (trivia only — quest shows its own).
          Shown only for a real distance: not before the server sent one ("-"),
          and not the server's 60 km "nothing nearby" default. */}
      {!isQuest && isRealNextKm(nextItemKm) && (
      <div className="map-nearby">
        <span className="map-nearby-lbl">{t('nearbyItem', locale)}</span>
        <span className="map-nearby-val">
          {nextItemKm} <span className="map-nearby-unit">km</span>
        </span>
      </div>
      )}

      {!following && (
        <button
          className="map-recenter-btn"
          aria-label="recenter"
          onClick={() => {
            setFollowing(true)
            const p = useDriving.getState().position
            if (p && mapRef.current)
              mapRef.current.easeTo({ center: [p.lng, p.lat] })
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        </button>
      )}

      {/* Bottom bar: [game ›] on left · [destination] on right — single row.
          Hidden in quest mode: Babylon drives its own chrome (no game switcher
          / destination prompt — the quest sets its station via the task opener). */}
      {!isQuest && destEditing && (
        <div className="map-dest-edit">
          {destSuggestions.length > 0 && (
            <div className="map-dest-suggestions">
              {destSuggestions.map((s, i) => (
                <button key={i} className="map-dest-sug-item" onMouseDown={() => saveDestination(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="map-dest-row">
            <input
              className="map-dest-input"
              autoFocus
              placeholder={t('destinationLabel', locale)}
              defaultValue={destination}
              onChange={(e) => {
                setDestDraft(e.target.value)
                fetchDestSuggestions(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDestination(destDraft || (e.target as HTMLInputElement).value)
                if (e.key === 'Escape') { setDestEditing(false); setDestSuggestions([]) }
              }}
            />
            <button className="map-dest-ok" onClick={() => saveDestination(destDraft)}>✓</button>
          </div>
        </div>
      )}
      {!isQuest && (
      <div className="map-bottom-bar">
        <button
          className="map-bottom-dest"
          onClick={() => { setDestDraft(destination); setDestEditing(true) }}
        >
          {destination || t('destinationLabel', locale)}
        </button>
        <button className="map-bottom-game" onClick={() => navigate('/games')}>
          {gameName || 'Trivia'} ›
        </button>
      </div>
      )}

      {import.meta.env.DEV && (
        <div className="map-dev-row">
          {sim ? (
            <button className="map-dev-btn map-dev-on" onClick={() => setSimRoute(null)}>
              ⏹ {SIM_ROUTES.find((r) => r.id === simRoute)?.name ?? 'sim'}
            </button>
          ) : (
            SIM_ROUTES.map((r) => (
              <button
                key={r.id}
                className="map-dev-btn"
                onClick={() => setSimRoute(r.id)}
                title={`Sim drive: ${r.name}`}
              >
                🚗 {r.name}
              </button>
            ))
          )}
          <button
            className="map-dev-btn"
            onClick={async () => {
              const { SAMPLE_ITEMS } = await import('../games/sampleItems')
              triggerItems(SAMPLE_ITEMS)
            }}
          >
            🃏
          </button>
          {/* Switch to a demo user that has a selected game → real markers.
              A fresh guest has none, so sim would only get seeded pins. */}
          <button
            className={`map-dev-btn ${getDeviceId() === DEMO_USER_ID ? 'map-dev-on' : ''}`}
            onClick={() =>
              setDeviceId(getDeviceId() === DEMO_USER_ID ? null : DEMO_USER_ID)
            }
            title={
              getDeviceId() === DEMO_USER_ID
                ? 'Demo user (real markers). Tap → back to guest'
                : 'Switch to demo user with real markers'
            }
          >
            👤
          </button>
          {/* Babel quest test mode: fresh user from station 1, a car that
              drives to the current station, and a clip skipper. */}
          <button
            className="map-dev-btn"
            onClick={() => void startFreshBabelUser()}
            title="New test user signed up for Babel (restart from station 1)"
          >
            🆕 Babel
          </button>
          <button
            className={`map-dev-btn ${questDrive ? 'map-dev-on' : ''}`}
            onClick={() => setQuestDrive((v) => !v)}
            disabled={sim}
            title="Quest drive: drive to the current station and keep moving"
          >
            🧪 Quest drive
          </button>
          <button
            className="map-dev-btn"
            onClick={() => skipCurrentClip()}
            title="Skip the playing clip to its end"
          >
            ⏭
          </button>
        </div>
      )}

      <GameCard />
    </div>
  )
}

// The server reports 60 km (DEFAULT_MAX_DIST) when it has no nearby item, and
// the HUD holds "-" until the first response. Neither is a real distance.
const NO_ITEM_KM = 60
function isRealNextKm(value: string): boolean {
  const km = Number(value)
  return Number.isFinite(km) && km > 0 && km < NO_ITEM_KM
}
