import { derivative, edgeCurve, evaluate, sample } from '../domain/curves'
import { currentPathway, isNaturalStoneFinish, type NaturalStoneFinish, type PathwayNode, type Point } from '../domain/schema'
import { buildOutline } from './outline'
import { pavingBorder } from './paving-border'
import { pavingPolygons } from './paving-polygons'
import { miteredPavingRegion } from './paving-miters'

export type NaturalStone = { ring: Point[]; holes?: Point[][]; shade: number }
const cache = new WeakMap<PathwayNode, NaturalStone[]>()

export const naturalStoneDefaults: Record<NaturalStoneFinish, { size: number; gap: number }> = {
  grassFlagstones: { size: 0.64, gap: 0.18 },
  riverStones: { size: 0.24, gap: 0.025 },
  steppingStones: { size: 0.8, gap: 0.45 },
}

function hash(...values: (string | number)[]): number {
  let h = 2166136261
  for (const value of values) for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

function area(ring: Point[]): number {
  return Math.abs(ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length]!
    return sum + p[0] * q[1] - q[0] * p[1]
  }, 0)) / 2
}

/** Each candidate lives in a local cell; clipping resolves curves and junctions. */
export function naturalStones(node: PathwayNode): NaturalStone[] {
  node = currentPathway(node)
  if (!isNaturalStoneFinish(node.finish)) return []
  const cached = cache.get(node)
  if (cached) return cached
  const style = node.finish
  const defaults = naturalStoneDefaults[style]
  const size = node.naturalStoneSize ?? defaults.size
  const gap = node.naturalStoneGap ?? defaults.gap
  const irregularity = node.naturalStoneIrregularity ?? 0.45
  const seed = node.naturalStoneSeed ?? 1
  const outline = buildOutline(node)
  const footprint = node.borderStyle === 'none' ? outline
    : pavingBorder(outline, Math.min(0.13, ...node.edges.map((edge) => edge.width * 0.18))).interior
  const result: NaturalStone[] = []
  const accepted: { ring: Point[]; bounds: [number, number, number, number] }[] = []
  const bounds = (ring: Point[]): [number, number, number, number] => [
    Math.min(...ring.map((p) => p[0])), Math.min(...ring.map((p) => p[1])),
    Math.max(...ring.map((p) => p[0])), Math.max(...ring.map((p) => p[1])),
  ]
  const overlaps = (a: number[], b: number[]) => a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!
  const add = (ring: Point[], region: ReturnType<typeof buildOutline>, shade: number) => {
    for (const polygon of pavingPolygons.intersection(region, [ring])) {
      const nearby = accepted.filter((used) => overlaps(bounds(polygon[0] as Point[]), used.bounds))
      const pieces = nearby.length
        ? pavingPolygons.difference(polygon, ...nearby.map((used) => [used.ring]))
        : [polygon]
      for (const piece of pieces) {
        const outer = piece[0] as Point[]
        if (area(outer) < 0.002) continue
        accepted.push({ ring: outer, bounds: bounds(outer) })
        result.push({ ring: outer, holes: piece.slice(1) as Point[][], shade })
      }
    }
  }
  for (const edge of node.edges) {
    const spanSize = style === 'steppingStones'
      ? Math.min(edge.width * 0.88, size * Math.sqrt(edge.width / 1.8)) : size
    const curve = edgeCurve(node, edge)
    const sampled = sample(curve, 0.01)
    const lengths = [0]
    for (let i = 1; i < sampled.length; i++) {
      const a = sampled[i - 1]!.point, b = sampled[i]!.point
      lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    const total = lengths.at(-1) ?? 0
    if (total < 0.08) continue
    const region = miteredPavingRegion(node, edge, footprint, Math.min(0.03, gap))
    const columns = style === 'steppingStones' ? 1
      : Math.max(1, Math.round(edge.width / (spanSize * (style === 'grassFlagstones' ? 1.25 : 1.45))))
    const rows = Math.max(1, Math.round(total / (spanSize + gap)))
    const cellLength = total / rows
    const cellWidth = edge.width / columns
    const frameAt = (target: number) => {
      let index = 1
      while (index < lengths.length - 1 && lengths[index]! < target) index++
      const span = lengths[index]! - lengths[index - 1]!
      const fraction = span > 0 ? (target - lengths[index - 1]!) / span : 0
      const t = sampled[index - 1]!.t + (sampled[index]!.t - sampled[index - 1]!.t) * fraction
      const center = evaluate(curve, t), tangent = derivative(curve, t)
      const magnitude = Math.hypot(...tangent) || 1
      const forward: Point = [tangent[0] / magnitude, tangent[1] / magnitude]
      const across: Point = [-forward[1], forward[0]]
      return { center, forward, across }
    }
    for (let row = 0; row < rows; row++) {
      const { center, forward, across } = frameAt((row + 0.5) * cellLength)
      for (let column = 0; column < columns; column++) {
        const key = [node.id, edge.id, seed, row, column]
        const offset = (column + 0.5 - columns / 2) * cellWidth
        const stagger = style === 'steppingStones' ? 0
          : (row % 2 ? 0.12 : -0.12) * cellWidth
        const shift = irregularity * (hash(...key, 'position') - 0.5)
        const longitudinal = shift * Math.min(gap, cellLength * 0.15)
        const lateral = Math.max(-cellWidth * 0.45, Math.min(cellWidth * 0.45,
          stagger + shift * Math.min(gap, cellWidth * 0.2)))
        const cx = center[0] + forward[0] * longitudinal + across[0] * (offset + lateral)
        const cz = center[1] + forward[1] * longitudinal + across[1] * (offset + lateral)
        const dense = style === 'riverStones'
        const widthScale = dense ? 0.93 + 0.07 * hash(...key, 'width') : 0.82 + 0.18 * hash(...key, 'width')
        const lengthScale = dense ? 0.93 + 0.07 * hash(...key, 'length') : 0.82 + 0.18 * hash(...key, 'length')
        const rx = Math.min(cellLength * (dense ? 0.49 : 0.45), spanSize * (dense ? 0.62 : 0.53)) * lengthScale
        const rz = Math.min(cellWidth * (dense ? 0.49 : 0.44), spanSize * (style === 'steppingStones' ? 0.55 : dense ? 0.76 : 0.68)) * widthScale
        const sides = style === 'grassFlagstones' ? 9 : style === 'steppingStones' ? 18 : 13
        const phase = hash(...key, 'rotation') * Math.PI * 2
        const ring: Point[] = Array.from({ length: sides }, (_, i) => {
          const angle = phase + i * Math.PI * 2 / sides
          const jag = 1 + irregularity * (hash(...key, i) - 0.5) * (style === 'grassFlagstones' ? 0.7 : 0.18)
          const u = Math.cos(angle) * rx * jag, v = Math.sin(angle) * rz * jag
          return [cx + forward[0] * u + across[0] * v,
            cz + forward[1] * u + across[1] * v]
        })
        add(ring, region, Math.min(3, Math.floor(hash(...key, 'shade') * 4)))
      }
    }
    if (style === 'riverStones') for (let row = 0; row < rows - 1; row++) {
      const { center, forward, across } = frameAt((row + 1) * cellLength)
      for (let column = 0; column < columns - 1; column++) {
        const key = [node.id, edge.id, seed, 'filler', row, column]
        const side = (column + 1 - columns / 2) * cellWidth
        const cx = center[0] + across[0] * side
        const cz = center[1] + across[1] * side
        const rx = Math.min(cellLength, size) * 0.18
        const rz = Math.min(cellWidth, size) * 0.18
        const ring: Point[] = Array.from({ length: 11 }, (_, i) => {
          const angle = i * Math.PI * 2 / 11
          const scale = 1 + irregularity * (hash(...key, i) - 0.5) * 0.16
          return [cx + forward[0] * Math.cos(angle) * rx * scale + across[0] * Math.sin(angle) * rz * scale,
            cz + forward[1] * Math.cos(angle) * rx * scale + across[1] * Math.sin(angle) * rz * scale]
        })
        add(ring, region, Math.min(3, Math.floor(hash(...key, 'shade') * 4)))
      }
    }
  }
  cache.set(node, result)
  return result
}
