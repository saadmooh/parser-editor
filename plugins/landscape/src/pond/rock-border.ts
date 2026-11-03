import { pavingPolygons } from '../pathways/rendering/paving-polygons'
import type { PondNode } from './schema'
import { pondOutline } from './terrain'
import { pondStoneBorder } from './stone-border'

export type BorderRock = { x: number; z: number; size: number; angle: number;
  height: number; aspect: number; tiltX: number; tiltZ: number; shapeSeed: number; colorIndex: number; stoneFootprint?: [number,number][] }
export const MAX_BORDER_ROCKS = 384

/** Offset contours follow concave shores without scaling them about the origin. */
export function pondRockBorder(node: PondNode): BorderRock[] {
  if (node.rockBorder === 'stone') return pondStoneBorder(node)
  if (node.rockBorder !== 'continuous') return []
  const outline = pondOutline(node)
  const offsets = node.rockBorderPlacement === 'both' ? [0, -node.bankWidth]
    : [node.rockBorderPlacement === 'outer' ? -node.bankWidth : 0]
  const rings = offsets.flatMap(offset => offset === 0 ? [outline]
    : pavingPolygons.inset([[outline]], offset).map(polygon => polygon[0]!))
    .map(ring => {
      const points = ring.map(([x, z]): [number, number] => [x!, z!])
      if (points.length > 1 && points[0]![0] === points.at(-1)![0] && points[0]![1] === points.at(-1)![1]) points.pop()
      const lengths = points.map((a, i) => { const b = points[(i + 1) % points.length]!; return Math.hypot(b[0] - a[0], b[1] - a[1]) })
      return { points, lengths, length: lengths.reduce((sum, length) => sum + length, 0) }
    }).filter(ring => ring.length > 1e-6)
  const total = rings.reduce((sum, ring) => sum + ring.length, 0)
  // Cap scene complexity even for a maximum-size pond with two fine stone rows.
  const step = Math.max(node.rockBorderSize + node.rockBorderGap, total / (MAX_BORDER_ROCKS - rings.length))
  let seed = node.rockBorderSeed
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  return rings.flatMap(ring => {
    const count = Math.max(1, Math.floor(ring.length / step))
    return Array.from({ length: count }, (_, index) => {
      const positionRandom = random(), sidewaysRandom = random(), sizeRandom = random(), angleRandom = random()
      const heightRandom = random(), aspectRandom = random(), tiltXRandom = random(), tiltZRandom = random()
      const shapeSeed = Math.floor(random() * 0xffffffff), colorIndex = Math.floor(random() * 8)
      let station = (index + .5 + (positionRandom - .5) * .5 * node.rockBorderPositionVariation) * ring.length / count
      let edge = 0
      while (edge < ring.lengths.length - 1 && station > ring.lengths[edge]!) station -= ring.lengths[edge++]!
      const a = ring.points[edge]!, b = ring.points[(edge + 1) % ring.points.length]!
      const t = station / (ring.lengths[edge] || 1)
      const dx = (b[0] - a[0]) / (ring.lengths[edge] || 1), dz = (b[1] - a[1]) / (ring.lengths[edge] || 1)
      const sideways = (sidewaysRandom - .5) * node.rockBorderSize * .5 * node.rockBorderPositionVariation
      return { x: a[0] + (b[0] - a[0]) * t - dz * sideways, z: a[1] + (b[1] - a[1]) * t + dx * sideways,
        size: node.rockBorderSize * (1 + (sizeRandom - .5) * node.rockBorderVariation),
        angle: Math.atan2(-dz, dx) + (angleRandom - .5) * Math.PI * 2 * node.rockBorderRotationVariation,
        height: .75 * (1 + (heightRandom - .5) * 1.2 * node.rockBorderHeightVariation),
        aspect: 1 + (aspectRandom - .5) * .8 * node.rockBorderShapeVariation,
        tiltX: (tiltXRandom - .5) * .5 * node.rockBorderRotationVariation,
        tiltZ: (tiltZRandom - .5) * .5 * node.rockBorderRotationVariation, shapeSeed, colorIndex }
    })
  })
}
