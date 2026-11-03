import { normalizeOutline, validateOutline } from './polygon'
import type { Point } from './schema'

const EPSILON = 1e-8

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function crossing(a: Point, b: Point, c: Point, d: Point) {
  const abX = b[0] - a[0]
  const abZ = b[1] - a[1]
  const cdX = d[0] - c[0]
  const cdZ = d[1] - c[1]
  const denominator = abX * cdZ - abZ * cdX
  if (Math.abs(denominator) < EPSILON) return null
  const acX = c[0] - a[0]
  const acZ = c[1] - a[1]
  const alongEarlier = (acX * cdZ - acZ * cdX) / denominator
  const alongStroke = (acX * abZ - acZ * abX) / denominator
  if (alongEarlier < 0 || alongEarlier > 1 || alongStroke <= EPSILON || alongStroke > 1) return null
  return { point: [a[0] + abX * alongEarlier, a[1] + abZ * alongEarlier] as Point, alongStroke }
}

function closeStroke(points: readonly Point[], closeDistance: number): Point[] | null {
  if (points.length < 4) return null
  const first = points[0]!
  const last = points.at(-1)!
  if (distance(first, last) <= closeDistance) return points.slice(0, -1).map(([x, z]): Point => [x, z])

  const strokeStart = points.at(-2)!
  let closure: { index: number; point: Point; alongStroke: number } | null = null
  for (let index = 0; index < points.length - 3; index += 1) {
    const hit = crossing(points[index]!, points[index + 1]!, strokeStart, last)
    if (hit && (!closure || hit.alongStroke < closure.alongStroke)) closure = { index, ...hit }
  }
  if (!closure) return null
  return [closure.point, ...points.slice(closure.index + 1, -1).map(([x, z]): Point => [x, z])]
}

export function advanceFreehandStroke(
  points: readonly Point[],
  next: Point,
  sampleDistance = 0.08,
  closeDistance = 0.25,
) {
  const candidate = [...points, next]
  const closed = closeStroke(candidate, closeDistance)
  if (closed) return { points: candidate, closed }
  const previous = points.at(-1)
  if (previous && distance(previous, next) < sampleDistance) return { points: [...points], closed: null }
  return { points: candidate, closed: null }
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared < EPSILON) return distance(point, start)
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared))
  return Math.hypot(point[0] - start[0] - dx * t, point[1] - start[1] - dz * t)
}

export function simplifyOpen(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points.map(([x, z]): Point => [x, z])
  let furthest = -1
  let maximum = tolerance
  for (let index = 1; index < points.length - 1; index += 1) {
    const value = distanceToSegment(points[index]!, points[0]!, points.at(-1)!)
    if (value > maximum) {
      maximum = value
      furthest = index
    }
  }
  if (furthest < 0) return [points[0]!, points.at(-1)!]
  return [
    ...simplifyOpen(points.slice(0, furthest + 1), tolerance).slice(0, -1),
    ...simplifyOpen(points.slice(furthest), tolerance),
  ]
}

function ringSlice(points: readonly Point[], start: number, end: number): Point[] {
  const result: Point[] = []
  for (let index = start; ; index = (index + 1) % points.length) {
    result.push(points[index]!)
    if (index === end) return result
  }
}

export function simplifyClosed(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 4) return [...points]
  let first = 0
  let second = 1
  let maximum = -1
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      const value = distance(points[a]!, points[b]!)
      if (value > maximum) {
        maximum = value
        first = a
        second = b
      }
    }
  }
  return [
    ...simplifyOpen(ringSlice(points, first, second), tolerance).slice(0, -1),
    ...simplifyOpen(ringSlice(points, second, first), tolerance).slice(0, -1),
  ]
}

function smoothClosed(points: readonly Point[], strength: number, steps = 8): Point[] {
  const handles = points.map((anchor, index): Point => {
    const previous = points[(index - 1 + points.length) % points.length]!
    const next = points[(index + 1) % points.length]!
    const dx = next[0] - previous[0]
    const dz = next[1] - previous[1]
    const directionLength = Math.hypot(dx, dz)
    const handleLength = Math.min(distance(anchor, previous), distance(anchor, next)) / 3 * strength
    return directionLength < EPSILON ? [0, 0] : [dx / directionLength * handleLength, dz / directionLength * handleLength]
  })
  return points.flatMap((start, index) => {
    const end = points[(index + 1) % points.length]!
    const startHandle = handles[index]!
    const endHandle = handles[(index + 1) % points.length]!
    return Array.from({ length: steps }, (_, sample): Point => {
      const t = sample / steps
      const inverse = 1 - t
      const a = inverse ** 3
      const b = 3 * inverse ** 2 * t
      const c = 3 * inverse * t ** 2
      const d = t ** 3
      return [
        a * start[0] + b * (start[0] + startHandle[0]) + c * (end[0] - endHandle[0]) + d * end[0],
        a * start[1] + b * (start[1] + startHandle[1]) + c * (end[1] - endHandle[1]) + d * end[1],
      ]
    })
  })
}

export function buildFreehandOutline(raw: readonly Point[], closeDistance = 0.25): Point[] | null {
  const closed = closeStroke(raw, closeDistance)
  if (!closed) return null
  const clean = normalizeOutline(closed)
  if (validateOutline(clean)) return null
  const anchors = simplifyClosed(clean, 0.12)
  if (validateOutline(anchors)) return null
  for (const strength of [0.35, 0.25, 0.15, 0]) {
    const outline = smoothClosed(anchors, strength)
    if (!validateOutline(outline)) return outline
  }
  return null
}
