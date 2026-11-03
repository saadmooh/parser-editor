import type { Polygon } from 'polygon-clipping'
import { pavingPolygons } from './paving-polygons'
import { derivative, distance, edgeCurve, evaluate, lerp, sample } from '../domain/curves'
import { STONE_LAYOUT_DEFAULTS, type PathwayNode, type Point } from '../domain/schema'
import { buildOutline } from './outline'
import { pavingBorder } from './paving-border'
import { miteredPavingRegion, pavingMiterExtension } from './paving-miters'

export type PavingTile = { ring: Point[]; holes?: Point[][]; shade: number; border: boolean }
const cache = new WeakMap<PathwayNode, PavingTile[]>()

function randomCell(edgeId: string, row: number, column: number): number {
  let hash = 2166136261
  for (const char of edgeId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  hash = Math.imul(hash ^ row, 16777619)
  hash = Math.imul(hash ^ column, 16777619)
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  return (hash >>> 0) / 4294967296
}

/** Rigid stone rows follow arc length and the tangent of the centerline. */
export function laidPavingTiles(node: PathwayNode): PavingTile[] {
  if (node.finish !== 'laidStone' && node.finish !== 'concreteSlabs') return []
  const cached = cache.get(node)
  if (cached) return cached
  const stones = node.finish === 'laidStone'
  const stoneLength = node.stoneLength ?? STONE_LAYOUT_DEFAULTS.length
  const stoneJoint = node.stoneJoint ?? STONE_LAYOUT_DEFAULTS.joint
  const stoneVariation = node.stoneVariation ?? STONE_LAYOUT_DEFAULTS.variation
  const result: PavingTile[] = []
  const border = node.borderStyle === 'stone'
    ? pavingBorder(buildOutline(node), Math.min(0.13, ...node.edges.map((edge) => edge.width * 0.18))) : null
  const footprint = border?.interior ?? buildOutline(node)
  for (const [i, polygon] of (stones ? border?.stones ?? [] : []).entries()) result.push({
    ring: polygon[0] as Point[], holes: polygon.slice(1) as Point[][], shade: i % 4, border: true,
  })
  const accepted: { polygon: Polygon; bounds: [number, number, number, number] }[] = []
  const repairPoints: { point: Point; width: number }[] = []
  const bounds = (ring: Point[]): [number, number, number, number] => [
    Math.min(...ring.map((p) => p[0])), Math.min(...ring.map((p) => p[1])),
    Math.max(...ring.map((p) => p[0])), Math.max(...ring.map((p) => p[1])),
  ]
  const overlaps = (a: number[], b: number[]) => a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!
  const addTile = (ring: Point[], cell: Point[], shade: number, region: typeof footprint) => {
    const clipped = pavingPolygons.intersection(region, [cell])
    for (const polygon of clipped) {
      const nearby = accepted.filter((tile) => overlaps(bounds(polygon[0]! as Point[]), tile.bounds))
      const pieces = nearby.length
        ? pavingPolygons.difference(polygon, ...nearby.map((tile) => tile.polygon))
        : [polygon]
      for (const piece of pieces) {
        // Reserve the entire cell, including its joints, before the next leg.
        // Otherwise a second leg fills the first leg's joints with thin shards.
        accepted.push({ polygon: piece, bounds: bounds(piece[0] as Point[]) })
        for (const stone of pavingPolygons.intersection(piece, [ring])) {
          const outer = stone[0] as Point[]
          const area = Math.abs(outer.reduce((sum, p, i) => {
            const q = outer[(i + 1) % outer.length]!
            return sum + p[0] * q[1] - q[0] * p[1]
          }, 0)) / 2
          if (area < 0.001) continue
          result.push({ ring: outer, holes: stone.slice(1) as Point[][], shade, border: false })
        }
      }
    }
  }
  for (const edge of node.edges) {
    const region = miteredPavingRegion(node, edge, footprint, stones ? 0.03 : 0.022)
    const curve = edgeCurve(node, edge)
    const sampled = sample(curve, 0.003)
    const lengths = [0]
    for (let i = 1; i < sampled.length; i++) {
      const a = sampled[i - 1]!.point, b = sampled[i]!.point
      lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    const total = lengths.at(-1)!
    if (total < 0.1) continue
    const curved = edge.controls !== undefined && (
      distance(curve[1], lerp(curve[0], curve[3], 1 / 3)) +
      distance(curve[2], lerp(curve[0], curve[3], 2 / 3)) > 0.02
    )
    const start = -pavingMiterExtension(node, edge, edge.from)
    const end = total + pavingMiterExtension(node, edge, edge.to)
    const usable = end - start
    if (usable < 0.12) continue
    const rows = Math.max(1, Math.round(usable / (stones ? stoneLength : 1.5)))
    const columns = stones ? Math.max(1, Math.round((edge.width - 0.26) / 0.5)) : 1
    const gap = stones ? stoneJoint : 0.022
    // Outer portions are clipped against the separately generated border band.
    const halfWidth = edge.width / 2 - (stones ? Math.min(0.13, edge.width * 0.18) : 0.02)
    const at = (length: number, side: number): Point => {
      if (length < 0 || length > total) {
        const atStart = length < 0, t = atStart ? 0 : 1
        const p = evaluate(curve, t), d = derivative(curve, t)
        const norm = Math.hypot(d[0], d[1]) || 1
        const travel = atStart ? length : length - total
        return [p[0] + d[0] / norm * travel - d[1] / norm * side,
          p[1] + d[1] / norm * travel + d[0] / norm * side]
      }
      let i = 1
      while (i < lengths.length - 1 && lengths[i]! < length) i++
      const span = lengths[i]! - lengths[i - 1]!
      const f = span > 0 ? (length - lengths[i - 1]!) / span : 0
      const t = sampled[i - 1]!.t + (sampled[i]!.t - sampled[i - 1]!.t) * f
      const p = evaluate(curve, t), d = derivative(curve, t)
      const norm = Math.hypot(d[0], d[1]) || 1
      return [p[0] - d[1] / norm * side, p[1] + d[0] / norm * side]
    }
    const ringAt = (a: number, b: number, left: number, right: number): Point[] => {
      if (!stones) return [at(a, left), at(a, right), at((a + b) / 2, right),
        at(b, right), at(b, left), at((a + b) / 2, left)]
      // Like the reference, lay rigid rectangular stones in tangent-facing rows.
      // The joints fan out around a bend instead of warping each stone.
      const mid = (a + b) / 2
      const p = at(mid - 0.001, 0), q = at(mid + 0.001, 0)
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
      const dx = (q[0] - p[0]) / length * (b - a) / 2
      const dz = (q[1] - p[1]) / length * (b - a) / 2
      const l = at(mid, left), r = at(mid, right)
      return [[l[0] - dx, l[1] - dz], [r[0] - dx, r[1] - dz],
        [r[0] + dx, r[1] + dz], [l[0] + dx, l[1] + dz]]
    }
    const rowWeights = Array.from({ length: rows }, (_, row) =>
      1 + (stones ? stoneVariation * 0.38 * (randomCell(edge.id, row, -1) * 2 - 1) : 0))
    const rowTotal = rowWeights.reduce((sum, weight) => sum + weight, 0)
    let rowOffset = 0
    for (let row = 0; row < rows; row++) {
      const cellStart = start + usable * rowOffset / rowTotal
      rowOffset += rowWeights[row]!
      const cellEnd = start + usable * rowOffset / rowTotal
      if (curved && !stones) repairPoints.push({ point: at((cellStart + cellEnd) / 2, 0), width: edge.width })
      const a = cellStart + gap / 2
      const b = cellEnd - gap / 2
      if (b - a < 0.06) continue
      const columnWeights = Array.from({ length: columns }, (_, column) =>
        1 + (stones ? stoneVariation * 0.3 * (randomCell(edge.id, row, column) * 2 - 1) : 0))
      const columnTotal = columnWeights.reduce((sum, weight) => sum + weight, 0)
      let columnOffset = 0
      for (let column = 0; column < columns; column++) {
        const cellLeft = -halfWidth + 2 * halfWidth * columnOffset / columnTotal
        columnOffset += columnWeights[column]!
        const cellRight = -halfWidth + 2 * halfWidth * columnOffset / columnTotal
        const left = cellLeft + gap / 2
        const right = cellRight - gap / 2
        if (right - left < 0.06) continue
        addTile(ringAt(a, b, left, right), ringAt(cellStart, cellEnd, cellLeft, cellRight),
          stones ? Math.min(3, Math.floor(randomCell(edge.id, row, column + 1000) * 4)) : row % 3, region)
      }
    }
  }
  // Mitered junctions and rigid slabs on bends can leave sizeable uncovered
  // wedges. Patch only broad residuals, keeping narrow expansion joints open.
  if (!stones) {
    const junctions = node.vertices.filter((vertex) =>
      node.edges.filter((edge) => edge.from === vertex.id || edge.to === vertex.id).length > 1)
      .map((vertex) => ({ point: vertex.point, width: Math.max(...node.edges
        .filter((edge) => edge.from === vertex.id || edge.to === vertex.id).map((edge) => edge.width)) }))
    const zones = [...junctions, ...repairPoints]
    const fills: Polygon[] = []
    for (const { point, width } of zones) {
      const radius = width * 0.55
      const zone: Point[] = Array.from({ length: 20 }, (_, i) => {
        const angle = i * Math.PI * 2 / 20
        return [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius]
      })
      zone.push(zone[0]!)
      const local = pavingPolygons.intersection(footprint, [zone])
      if (!local.length) continue
      const localBounds = bounds(local.flatMap((polygon) => polygon[0] as Point[]))
      const nearby = result.filter((tile) => !tile.border && overlaps(bounds(tile.ring), localBounds))
      const covered: Polygon[] = [
        ...nearby.map((tile) => [tile.ring, ...(tile.holes ?? [])]),
        ...fills,
      ]
      for (const region of local) {
        const uncovered = covered.length
          ? pavingPolygons.difference(region, ...covered)
          : [region]
        for (const piece of uncovered) {
          const area = piece.reduce((sum, ring, index) => {
            const signed = ring.reduce((value, point, i) => {
              const next = ring[(i + 1) % ring.length]!
              return value + point[0] * next[1] - next[0] * point[1]
            }, 0) / 2
            return sum + Math.abs(signed) * (index === 0 ? 1 : -1)
          }, 0)
          const extent = bounds(piece[0] as Point[])
          const longest = Math.max(extent[2] - extent[0], extent[3] - extent[1])
          // Keep expansion joints; patch only gaps with meaningful width.
          if (area < 0.03 || (longest > 0 && 2 * area / longest < 0.06)) continue
          fills.push(piece)
          result.push({ ring: piece[0] as Point[], holes: piece.slice(1) as Point[][],
            shade: Math.abs(Math.round((point[0] + point[1]) * 10)) % 3, border: false })
        }
      }
    }
  }
  cache.set(node, result)
  return result
}
