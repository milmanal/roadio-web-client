// Builds DOM elements for map markers, styled to the original Roadio design:
// items are yellow "?" boxes with a single orange points circle at the right;
// answered items show a ✓; missions are blue; cars are vans.

import type { MapMarker } from '../../types'

export type MarkerKind =
  | 'car'
  | 'item'
  | 'mission'
  | 'openMission'
  | 'completedMission'
  | 'seenItem'

const DONE = new Set<MarkerKind>(['completedMission', 'seenItem'])

export function makeMarkerEl(kind: MarkerKind, m: MapMarker): HTMLElement {
  const el = document.createElement('div')
  el.className = `mk mk-${kind}`

  if (kind === 'car') {
    const img = document.createElement('img')
    img.className = 'mk-othercar'
    img.src = '/car.png'
    img.alt = ''
    el.appendChild(img)
    return el
  }

  // Yellow (or blue for missions) "?" box.
  const box = document.createElement('div')
  box.className = 'mk-box'
  box.textContent = DONE.has(kind) ? '' : '?'
  el.appendChild(box)

  // Exactly one value circle, at the right: points for open items, ✓ when done.
  const done = DONE.has(kind)
  if (done) {
    const check = document.createElement('span')
    check.className = 'mk-badge mk-badge-done'
    check.textContent = '✓'
    el.appendChild(check)
  } else if (typeof m.score === 'number' && m.score > 0) {
    const badge = document.createElement('span')
    badge.className = 'mk-badge mk-badge-points'
    badge.textContent = String(m.score)
    el.appendChild(badge)
  }

  return el
}
