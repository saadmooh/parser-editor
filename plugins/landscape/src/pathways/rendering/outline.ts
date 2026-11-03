import type {
  MultiPolygon,
  Polygon,
} from 'polygon-clipping'
import { pavingPolygons } from './paving-polygons'
import { derivative, distance, edgeCurve, sample } from '../domain/curves'
import type { PathGraph, PathwayCorner, Point } from '../domain/schema'

const outlines = new WeakMap<PathGraph, MultiPolygon>()

const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]
const unit = (p: Point): Point => {
  const length = Math.hypot(...p)
  return length < 1e-8 ? [0, 0] : [p[0] / length, p[1] / length]
}
const hull = (points: Point[]): Point[] => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lower: Point[] = [], upper: Point[] = []
  for (const point of sorted) {
    while (lower.length > 1 && cross(
      [lower.at(-1)![0] - lower.at(-2)![0], lower.at(-1)![1] - lower.at(-2)![1]],
      [point[0] - lower.at(-1)![0], point[1] - lower.at(-1)![1]]) <= 0) lower.pop()
    lower.push(point)
  }
  for (const point of sorted.reverse()) {
    while (upper.length > 1 && cross(
      [upper.at(-1)![0] - upper.at(-2)![0], upper.at(-1)![1] - upper.at(-2)![1]],
      [point[0] - upper.at(-1)![0], point[1] - upper.at(-1)![1]]) <= 0) upper.pop()
    upper.push(point)
  }
  lower.pop(); upper.pop()
  return [...lower, ...upper]
}

export function buildOutline(graph: PathGraph & { cornerStyle?: PathwayCorner }): MultiPolygon {
  const cached = outlines.get(graph)
  if (cached) return cached
  const parts: Polygon[] = []
  for (const edge of graph.edges) {
    const curve = edgeCurve(graph, edge)
    const points = sample(curve).map((p) => p.point)
    const radius = edge.width / 2
    if (graph.cornerStyle === 'square') {
      // A continuous offset ribbon keeps curved routes flush at their ends.
      // Discs around internal samples used to bulge beyond the end caps and
      // leave a scalloped outline for the individual border stones.
      const offsets = points.map((point, i): Point => {
        let before = i === 0 ? unit(derivative(curve, 0)) : unit([
          point[0] - points[i - 1]![0], point[1] - points[i - 1]![1],
        ])
        let after = i === points.length - 1 ? unit(derivative(curve, 1)) : unit([
          points[i + 1]![0] - point[0], points[i + 1]![1] - point[1],
        ])
        if (Math.hypot(...before) < 1e-8) before = after
        if (Math.hypot(...after) < 1e-8) after = before
        if (i === 0) after = before
        if (i === points.length - 1) before = after
        const divisor = Math.max(0.25, 1 + before[0] * after[0] + before[1] * after[1])
        return [-(before[1] + after[1]) * radius / divisor,
          (before[0] + after[0]) * radius / divisor]
      })
      parts.push([[
        ...points.map((p, i): Point => [p[0] + offsets[i]![0], p[1] + offsets[i]![1]]),
        ...points.map((p, i): Point => [p[0] - offsets[i]![0], p[1] - offsets[i]![1]]).reverse(),
      ]])
      continue
    }
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!,
        length = distance(a, b)
      if (length < 1e-8) continue
      const nx = (-(b[1] - a[1]) / length) * radius,
        nz = ((b[0] - a[0]) / length) * radius
      parts.push([
        [
          [a[0] + nx, a[1] + nz],
          [b[0] + nx, b[1] + nz],
          [b[0] - nx, b[1] - nz],
          [a[0] - nx, a[1] - nz],
        ],
      ])
    }
    // Round joins/caps avoid unbounded spikes at acute branches and tight bends.
    const segments = Math.max(
      16,
      Math.ceil(Math.PI / Math.acos(1 - Math.min(0.005 / radius, 1))),
    )
    for (const p of points) {
      parts.push([
        Array.from({ length: segments }, (_, i): Point => [
          p[0] + Math.cos((i * Math.PI * 2) / segments) * radius,
          p[1] + Math.sin((i * Math.PI * 2) / segments) * radius,
        ]),
      ])
    }
  }
  if (graph.cornerStyle === 'square') for (const vertex of graph.vertices) {
    const legs = graph.edges.flatMap((edge) => {
      if (edge.from !== vertex.id && edge.to !== vertex.id) return []
      const curve = edgeCurve(graph, edge)
      const tangent = edge.from === vertex.id ? derivative(curve, 0) : derivative(curve, 1).map((n) => -n) as Point
      const direction = unit(tangent)
      if (direction[0] === 0 && direction[1] === 0) return []
      return [{ direction, radius: edge.width / 2 }]
    })
    if (legs.length < 2) continue
    const sides = legs.flatMap(({ direction, radius }) => {
      const normal: Point = [-direction[1] * radius, direction[0] * radius]
      return [[vertex.point[0] + normal[0], vertex.point[1] + normal[1]],
        [vertex.point[0] - normal[0], vertex.point[1] - normal[1]]] as Point[]
    })
    const bridge = hull(sides)
    if (bridge.length >= 3) parts.push([bridge])
    if (legs.length !== 2) continue
    const [first, second] = legs as [typeof legs[number], typeof legs[number]]
    const turn = cross(first.direction, second.direction)
    if (Math.abs(turn) < 0.05) continue
    const sign = turn < 0 ? 1 : -1
    const offset = ({ direction, radius }: typeof first, side: number): Point =>
      [-direction[1] * radius * side, direction[0] * radius * side]
    const a = offset(first, sign), b = offset(second, -sign)
    const between: Point = [b[0] - a[0], b[1] - a[1]]
    const t = cross(between, second.direction) / turn
    const tip: Point = [vertex.point[0] + a[0] + first.direction[0] * t,
      vertex.point[1] + a[1] + first.direction[1] * t]
    const limit = Math.max(first.radius, second.radius) * 4
    if (distance(tip, vertex.point) <= limit) parts.push([[
      [vertex.point[0] + a[0], vertex.point[1] + a[1]], tip,
      [vertex.point[0] + b[0], vertex.point[1] + b[1]],
    ]])
  }
  if (!parts.length) return []
  const outline = pavingPolygons.union(parts[0]!, ...parts.slice(1))
  outlines.set(graph, outline)
  return outline
}
