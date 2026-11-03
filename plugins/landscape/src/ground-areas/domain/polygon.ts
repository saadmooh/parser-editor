import type { Point } from './schema'

const EPSILON = 1e-7

function cross(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function onSegment(a: Point, b: Point, p: Point) {
  return (
    Math.abs(cross(a, b, p)) < EPSILON &&
    p[0] >= Math.min(a[0], b[0]) - EPSILON &&
    p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    p[1] >= Math.min(a[1], b[1]) - EPSILON &&
    p[1] <= Math.max(a[1], b[1]) + EPSILON
  )
}

function intersects(a: Point, b: Point, c: Point, d: Point) {
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  if (abC * abD < -EPSILON && cdA * cdB < -EPSILON) return true
  return (
    (Math.abs(abC) < EPSILON && onSegment(a, b, c)) ||
    (Math.abs(abD) < EPSILON && onSegment(a, b, d)) ||
    (Math.abs(cdA) < EPSILON && onSegment(c, d, a)) ||
    (Math.abs(cdB) < EPSILON && onSegment(c, d, b))
  )
}

export function normalizeOutline(points: Point[]): Point[] {
  const clean: Point[] = []
  for (const point of points) {
    const previous = clean.at(-1)
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.03)
      clean.push(point)
  }
  if (clean.length > 1) {
    const first = clean[0]!
    const last = clean.at(-1)!
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 0.03)
      clean.pop()
  }
  return clean
}

export function validateOutline(points: Point[]): string | null {
  if (points.length < 3) return 'Draw at least three points to make an area.'
  let twiceArea = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    twiceArea += a[0] * b[1] - b[0] * a[1]
  }
  if (Math.abs(twiceArea) < 0.01) return 'This area is too small to save.'

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    for (let j = i + 1; j < points.length; j++) {
      if (j === i || j === (i + 1) % points.length || (j + 1) % points.length === i)
        continue
      if (intersects(a, b, points[j]!, points[(j + 1) % points.length]!))
        return 'The outline crosses itself. Redraw it without crossing the boundary.'
    }
  }
  return null
}

export function rectangleOutline(a: Point, b: Point): Point[] {
  return [
    [a[0], a[1]],
    [b[0], a[1]],
    [b[0], b[1]],
    [a[0], b[1]],
  ]
}

export function simplifyOutline(points: Point[], tolerance = 0.12): Point[] {
  if (points.length <= 3) return points
  const first = points[0]!
  const last = points.at(-1)!
  let maxDistance = 0
  let split = 0
  const dx = last[0] - first[0]
  const dz = last[1] - first[1]
  const lengthSquared = dx * dx + dz * dz
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((p[0] - first[0]) * dx + (p[1] - first[1]) * dz) / lengthSquared))
      : 0
    const distance = Math.hypot(p[0] - (first[0] + t * dx), p[1] - (first[1] + t * dz))
    if (distance > maxDistance) {
      maxDistance = distance
      split = i
    }
  }
  if (maxDistance <= tolerance) return [first, last]
  const left = simplifyOutline(points.slice(0, split + 1), tolerance)
  const right = simplifyOutline(points.slice(split), tolerance)
  return [...left.slice(0, -1), ...right]
}
