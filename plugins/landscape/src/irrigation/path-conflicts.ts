import { distance, unit, type Point } from './ports'
const dot = (a: Point, b: Point) => a.reduce((n, v, i) => n + v * b[i]!, 0)
const sub = (a: Point, b: Point): Point => a.map((v, i) => v - b[i]!) as Point
/** Positive shared length, not a shared endpoint or pipes at different depths. */
export function segmentsOverlap(a: Point, b: Point, c: Point, d: Point) {
 const length = distance(a, b), other = distance(c, d)
 if (length < 1e-6 || other < 1e-6) return false
 const axis = unit(b, a)
 if (Math.abs(dot(axis, unit(d, c))) < .999999) return false
 const offset = sub(c, a), projection = dot(offset, axis)
 if (Math.hypot(...offset.map((v, i) => v - axis[i]! * projection)) > .001) return false
 const end = dot(sub(d, a), axis)
 return Math.min(length, Math.max(projection, end)) - Math.max(0, Math.min(projection, end)) > .001
}
export function pathOverlaps(a: readonly Point[], b: readonly Point[]) {
 return a.slice(1).some((p, i) => b.slice(1).some((q, j) => segmentsOverlap(a[i]!, p, b[j]!, q)))
}
export function pathBacktracks(path: readonly Point[]) {
 for (let i = 1; i < path.length; i++) for (let j = i + 1; j < path.length; j++) if (segmentsOverlap(path[i - 1]!, path[i]!, path[j - 1]!, path[j]!)) return true
 return false
}
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export function pathsCross(a: readonly Point[], b: readonly Point[]) {
 return a.slice(1).some((p, i) => b.slice(1).some((q, j) => {
  const start = a[i]!, other = b[j]!, u = sub(p, start), v = sub(q, other), normal = cross(u, v), denominator = dot(normal, normal)
  if (denominator < 1e-12) return false
  const offset = sub(other, start), t = dot(cross(offset, v), normal) / denominator, s = dot(cross(offset, u), normal) / denominator
  if (t < -1e-6 || t > 1 + 1e-6 || s < -1e-6 || s > 1 + 1e-6) return false
  if ((t < 1e-6 || t > 1 - 1e-6) && (s < 1e-6 || s > 1 - 1e-6)) return false
  return distance(start.map((n, k) => n + u[k]! * t), other.map((n, k) => n + v[k]! * s)) < .001
 }))
}
