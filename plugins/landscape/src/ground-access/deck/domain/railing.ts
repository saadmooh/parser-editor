import { pavingPolygons } from '../../../pathways/rendering/paving-polygons'
import { surfaceOutline } from '../../shared/outline'
import type { DeckNode } from './schema'

type Point = [number, number]
export const DECK_RAILING_INSET = 0.08

export function deckRailingOutline(node: DeckNode, inset = DECK_RAILING_INSET): Point[] {
  const outline = surfaceOutline(node)
  if (inset <= 0) return outline
  const polygons = pavingPolygons.inset([outline], inset)
  const area = (ring: Point[]) => Math.abs(ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length]!
    return sum + a[0] * b[1] - b[0] * a[1]
  }, 0))
  const ring = polygons.map((polygon) => polygon[0]!.slice(0, -1) as Point[])
    .sort((a, b) => area(b) - area(a))[0]
  return ring ?? []
}

// Offset clipping may reorder edges. Match selection to the original deck edge.
export function deckRailingEdgeIndex(node: DeckNode, a: Point, b: Point): number {
  const outline = surfaceOutline(node)
  const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2
  let nearest = 0, distance = Infinity
  outline.forEach((p, index) => {
    const q = outline[(index + 1) % outline.length]!
    const dx = q[0] - p[0], dz = q[1] - p[1]
    const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1)))
    const d = (x - p[0] - t * dx) ** 2 + (z - p[1] - t * dz) ** 2
    if (d < distance) { nearest = index; distance = d }
  })
  return nearest
}

export function deckRailingLevelOutline(node: DeckNode, inset = 0): Point[] {
  const cos = Math.cos(node.rotation[1]), sin = Math.sin(node.rotation[1])
  return deckRailingOutline(node, inset).map(([x, z]) => [
    node.position[0] + x * cos + z * sin,
    node.position[2] - x * sin + z * cos,
  ])
}
