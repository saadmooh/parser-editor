import type { PathEdge, PathGraph, Point } from './schema'
import { CatmullRomCurve3, Vector3 } from 'three'

export type Curve = [Point, Point, Point, Point]
export const EPSILON = 1e-5
export const distance = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1])
export const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
]

export function edgeCurve(graph: PathGraph, edge: PathEdge): Curve {
  const a = graph.vertices.find((v) => v.id === edge.from)?.point
  const b = graph.vertices.find((v) => v.id === edge.to)?.point
  if (!a || !b) throw new Error('Pathway edge has a missing junction')
  return [
    a,
    edge.controls?.[0] ?? lerp(a, b, 1 / 3),
    edge.controls?.[1] ?? lerp(a, b, 2 / 3),
    b,
  ]
}

export function evaluate(c: Curve, t: number): Point {
  const a = lerp(c[0], c[1], t),
    b = lerp(c[1], c[2], t),
    d = lerp(c[2], c[3], t)
  return lerp(lerp(a, b, t), lerp(b, d, t), t)
}

export function derivative(c: Curve, t: number): Point {
  return [0, 1].map(
    (axis) =>
      3 *
      ((1 - t) ** 2 * (c[1][axis]! - c[0][axis]!) +
        2 * (1 - t) * t * (c[2][axis]! - c[1][axis]!) +
        t ** 2 * (c[3][axis]! - c[2][axis]!)),
  ) as Point
}

export function split(c: Curve, t: number): [Curve, Curve] {
  const a = lerp(c[0], c[1], t),
    b = lerp(c[1], c[2], t),
    d = lerp(c[2], c[3], t)
  const e = lerp(a, b, t),
    f = lerp(b, d, t),
    p = lerp(e, f, t)
  return [
    [c[0], a, e, p],
    [p, f, d, c[3]],
  ]
}

export function slice(c: Curve, start: number, end: number): Curve {
  const left = end === 1 ? c : split(c, end)[0]
  return start === 0 ? left : split(left, start / end)[1]
}

export function projectSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1]
  const length2 = dx * dx + dz * dz
  const t =
    length2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2),
        )
  return { point: lerp(a, b, t), t }
}

// Error is measured in metres, independently of viewport zoom.
export function sample(c: Curve, tolerance = 0.005) {
  const result: { point: Point; t: number }[] = [{ point: c[0], t: 0 }]
  const visit = (part: Curve, start: number, end: number, depth: number) => {
    const error = Math.max(
      distance(part[1], projectSegment(part[1], part[0], part[3]).point),
      distance(part[2], projectSegment(part[2], part[0], part[3]).point),
    )
    if (error <= tolerance || depth >= 12) {
      result.push({ point: part[3], t: end })
      return
    }
    const halves = split(part, 0.5),
      mid = (start + end) / 2
    visit(halves[0], start, mid, depth + 1)
    visit(halves[1], mid, end, depth + 1)
  }
  visit(c, 0, 1, 0)
  return result
}

export function nearest(c: Curve, p: Point) {
  if (
    distance(c[1], lerp(c[0], c[3], 1 / 3)) < 1e-10 &&
    distance(c[2], lerp(c[0], c[3], 2 / 3)) < 1e-10
  ) {
    const hit = projectSegment(p, c[0], c[3])
    return { ...hit, distance: distance(hit.point, p) }
  }
  const points = sample(c)
  let best = { point: c[0], t: 0, distance: distance(c[0], p) }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!
    // Minimize on each sampled interval; this also handles curved endpoints.
    let lo = a.t,
      hi = b.t
    for (let j = 0; j < 40; j++) {
      const u = lo + (hi - lo) / 3,
        v = hi - (hi - lo) / 3
      if (distance(evaluate(c, u), p) < distance(evaluate(c, v), p)) hi = v
      else lo = u
    }
    for (const t of [a.t, (lo + hi) / 2, b.t]) {
      const point = evaluate(c, t),
        d = distance(point, p)
      if (d < best.distance) best = { point, t, distance: d }
    }
  }
  return best
}

// Three clicks: start, point the curve passes through, end.
export function throughPoint(a: Point, middle: Point, b: Point): Curve {
  const control: Point = [
    2 * middle[0] - (a[0] + b[0]) / 2,
    2 * middle[1] - (a[1] + b[1]) / 2,
  ]
  return [a, lerp(a, control, 2 / 3), lerp(b, control, 2 / 3), b]
}

// Streetscape samples a centripetal Catmull-Rom through every clicked spline
// point. Recover each cubic span exactly so our graph can split it at junctions.
export function splineCurves(points: readonly Point[]): Curve[] {
  const authored = points.filter((point, index) =>
    index === 0 || distance(point, points[index - 1]!) >= 0.05)
  if (authored.length < 2) return []
  if (authored.length === 2) {
    const [a, b] = authored as [Point, Point]
    return [[a, lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b]]
  }
  const curve = new CatmullRomCurve3(
    authored.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal')
  const spans = authored.length - 1
  const at = (position: number): Point => {
    const p = curve.getPoint(position / spans)
    return [p.x, p.z]
  }
  return Array.from({ length: spans }, (_, index): Curve => {
    const p0 = authored[index]!, p3 = authored[index + 1]!
    const q1 = at(index + 1 / 3), q2 = at(index + 2 / 3)
    const u: Point = [27 * q1[0] - 8 * p0[0] - p3[0], 27 * q1[1] - 8 * p0[1] - p3[1]]
    const v: Point = [27 * q2[0] - p0[0] - 8 * p3[0], 27 * q2[1] - p0[1] - 8 * p3[1]]
    const p1: Point = [(2 * u[0] - v[0]) / 18, (2 * u[1] - v[1]) / 18]
    const p2: Point = [(2 * v[0] - u[0]) / 18, (2 * v[1] - u[1]) / 18]
    return [p0, p1, p2, p3]
  })
}
