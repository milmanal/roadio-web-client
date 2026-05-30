// Builds DOM elements for map markers, styled to the original Roadio design:
// items are red teardrop pins showing their score; the user/cars are red car
// glyphs; missions are blue pins; completed/seen are faded.

import type { MapMarker } from '../../types'

export type MarkerKind =
  | 'car'
  | 'item'
  | 'mission'
  | 'openMission'
  | 'completedMission'
  | 'seenItem'

export function makeMarkerEl(kind: MarkerKind, m: MapMarker): HTMLElement {
  const el = document.createElement('div')
  el.className = `mk mk-${kind}`

  if (kind === 'car') {
    el.classList.add('mk-car')
    el.textContent = '🚗'
    return el
  }

  // Pin with an inner label (score for items, ✓ for completed, etc.)
  const pin = document.createElement('div')
  pin.className = 'mk-pin'
  const label = document.createElement('span')
  label.className = 'mk-label'

  if (kind === 'completedMission' || kind === 'seenItem') {
    label.textContent = '✓'
  } else if (typeof m.score === 'number' && m.score > 0) {
    label.textContent = String(m.score)
  } else {
    label.textContent = '?'
  }

  pin.appendChild(label)
  el.appendChild(pin)
  return el
}
