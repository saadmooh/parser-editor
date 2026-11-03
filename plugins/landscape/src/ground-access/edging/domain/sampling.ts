import { sampleCurve } from '../../../ground-areas/domain/freehand-curve'
import { getFenceControlHandle, getTwoPointFenceCurveTangents, sampleFenceSpline } from '@pascal-app/core'
import type { EdgingNode } from './schema'

type Point = EdgingNode['points'][number]

/** Drop pointer jitter while retaining the stroke's endpoints and visible bends. */
export function simplifyEdgingStroke(points: Point[], tolerance = 0.035): Point[] {
  if (points.length < 3) return points
  const first = points[0]!, last = points.at(-1)!
  const dx = last[0] - first[0], dz = last[1] - first[1]
  const span = dx * dx + dz * dz
  let farthest = -1, deviation = tolerance
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!
    const t = span > 1e-8 ? Math.max(0, Math.min(1,
      ((point[0] - first[0]) * dx + (point[1] - first[1]) * dz) / span)) : 0
    const distance = Math.hypot(point[0] - first[0] - dx * t, point[1] - first[1] - dz * t)
    if (distance > deviation) { deviation = distance; farthest = index }
  }
  if (farthest < 0) return [first, last]
  return [...simplifyEdgingStroke(points.slice(0, farthest + 1), tolerance).slice(0, -1),
    ...simplifyEdgingStroke(points.slice(farthest), tolerance)]
}

export function edgingCurveTangents(node: EdgingNode): Array<Point | null> | undefined {
  if (!node.closed) return node.tangents ?? getTwoPointFenceCurveTangents(node.points)
  const points = node.points
  if (points.length < 2) return node.tangents
  const wrapped = [points.at(-1)!, ...points, points[0]!]
  return points.map((_, index) => {
    const stored = node.tangents?.[index]
    if (stored) return stored
    const handle = getFenceControlHandle(wrapped, undefined, index + 1)
    return [handle.x, handle.y]
  })
}

export function edgingControlHandle(node: EdgingNode, index: number): Point {
  const handle = getFenceControlHandle(node.points, edgingCurveTangents(node), index)
  return [handle.x, handle.y]
}

export function edgingRenderPoints(node: EdgingNode): Point[] {
  const points = node.points
  if ((node.drawMode === 'freehand' || node.drawMode === 'curve') && node.curvePoints)
    return sampleCurve(node.curvePoints, node.closed)
  if (node.drawMode === 'freehand' && !node.closed) return simplifyEdgingStroke(points)
  if (node.drawMode !== 'curve' || points.length < 2) return points
  const tangents = edgingCurveTangents(node)
  const path = node.closed ? [...points, points[0]!] : points
  const handles = node.closed && tangents ? [...tangents, tangents[0]!] : tangents
  const sampled = sampleFenceSpline(path, handles, 40).map(({ x, y }): Point => [x, y])
  return node.closed ? sampled.slice(0, -1) : sampled
}

/** Space modular pieces by distance along a sampled curve or freehand stroke. */
export function edgingLayoutPoints(points: Point[], pitch: number, closed: boolean): Point[] {
  if (points.length < 2) return points
  const route = closed ? [...points, points[0]!] : points
  const lengths = [0]
  for (let index = 1; index < route.length; index += 1)
    lengths.push(lengths.at(-1)! + Math.hypot(route[index]![0] - route[index - 1]![0],
      route[index]![1] - route[index - 1]![1]))
  const total = lengths.at(-1)!
  if (total < 1e-4) return points
  const count = Math.max(closed ? 3 : 1, Math.ceil(total / pitch))
  return Array.from({ length: closed ? count : count + 1 }, (_, index): Point => {
    const distance = total * index / count
    let segment = 1
    while (segment < lengths.length - 1 && lengths[segment]! < distance) segment += 1
    const span = lengths[segment]! - lengths[segment - 1]!
    const t = span > 1e-5 ? (distance - lengths[segment - 1]!) / span : 0
    const a = route[segment - 1]!, b = route[segment]!
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  })
}
