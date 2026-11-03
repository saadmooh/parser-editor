import { z } from 'zod'
import { simplifyClosed, simplifyOpen } from './freehand'
import { validateOutline } from './polygon'
import type { Point } from './schema'

const point = z.tuple([z.number().finite(), z.number().finite()])
export const curvePointsSchema = z.array(z.object({ anchor: point, incoming: point, outgoing: point })).min(2).optional()
export type CurvePoint = { anchor: Point; incoming: Point; outgoing: Point }
export type CurveAction = 'anchor' | 'incoming' | 'outgoing' | 'insert'
const mix = (a: Point, b: Point, t = 0.5): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function curveAt(points: CurvePoint[], index: number, t: number): Point {
  const a = points[index]!, b = points[(index + 1) % points.length]!
  const ab = mix(a.anchor, a.outgoing, t), bc = mix(a.outgoing, b.incoming, t), cd = mix(b.incoming, b.anchor, t)
  return mix(mix(ab, bc, t), mix(bc, cd, t), t)
}

export function sampleCurve(points: CurvePoint[], closed = true): Point[] {
  const samples = points.slice(0, closed ? points.length : -1).flatMap((point, index) => {
    const next = points[(index + 1) % points.length]!
    const length = distance(point.anchor, point.outgoing) + distance(point.outgoing, next.incoming) + distance(next.incoming, next.anchor)
    const steps = Math.max(12, Math.min(96, Math.ceil(length / 0.08)))
    return Array.from({ length: steps }, (_, step) => curveAt(points, index, step / steps))
  })
  if (!closed && points.length) samples.push([...points.at(-1)!.anchor])
  return samples
}

export function mapCurve(points: CurvePoint[], map: (point: Point) => Point): CurvePoint[] {
  return points.map((point) => ({ anchor: map(point.anchor), incoming: map(point.incoming), outgoing: map(point.outgoing) }))
}

function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)))
  return distance(p, mix(a, b, t))
}

/** Fit a sparse editable curve without changing the stored outline on selection. */
export function fitFreehandCurve(outline: Point[], closed = true): CurvePoint[] {
  for (const tolerance of [0.4, 0.24, 0.12, 0.06, 0.03, 0.015]) {
    const anchors = closed ? simplifyClosed(outline, tolerance) : simplifyOpen(outline, tolerance)
    if (anchors.length < (closed ? 3 : 2)) continue
    for (const strength of [1, 0.65, 0.35, 0]) {
      const curve = anchors.map((anchor, index): CurvePoint => {
        const prev = anchors[!closed && index === 0 ? 0 : (index - 1 + anchors.length) % anchors.length]!
        const next = anchors[!closed && index === anchors.length - 1 ? index : (index + 1) % anchors.length]!
        const length = Math.min(distance(anchor, prev) || distance(anchor, next), distance(anchor, next) || distance(anchor, prev)) * strength / 3
        const size = distance(prev, next) || 1
        const offset: Point = [(next[0] - prev[0]) * length / size, (next[1] - prev[1]) * length / size]
        return { anchor, incoming: [anchor[0] - offset[0], anchor[1] - offset[1]], outgoing: [anchor[0] + offset[0], anchor[1] + offset[1]] }
      })
      const sampled = sampleCurve(curve, closed)
      const close = (a: Point[], b: Point[]) => a.every((p) => b.some((v, i) => (closed || i < b.length - 1) && segmentDistance(p, v, b[(i + 1) % b.length]!) <= 0.12))
      if ((!closed || !validateOutline(sampled)) && close(sampled, outline) && close(outline, sampled)) return curve
    }
  }
  return outline.map((anchor) => ({ anchor: [...anchor], incoming: [...anchor], outgoing: [...anchor] }))
}

export function splitCurve(points: CurvePoint[], index: number): CurvePoint[] {
  const next = mapCurve(points, (p) => [...p])
  const a = next[index]!, b = next[(index + 1) % next.length]!
  const ab = mix(a.anchor, a.outgoing), bc = mix(a.outgoing, b.incoming), cd = mix(b.incoming, b.anchor)
  const left = mix(ab, bc), right = mix(bc, cd)
  a.outgoing = ab
  b.incoming = cd
  next.splice(index + 1, 0, { anchor: mix(left, right), incoming: left, outgoing: right })
  return next
}

export function editCurve(points: CurvePoint[], index: number, action: CurveAction, target: Point): CurvePoint[] {
  const next = action === 'insert' ? splitCurve(points, index) : mapCurve(points, (p) => [...p])
  const point = next[action === 'insert' ? index + 1 : index]!
  if (action === 'anchor' || action === 'insert') {
    const dx = target[0] - point.anchor[0], dz = target[1] - point.anchor[1]
    point.incoming = [point.incoming[0] + dx, point.incoming[1] + dz]
    point.outgoing = [point.outgoing[0] + dx, point.outgoing[1] + dz]
    point.anchor = target
  } else {
    const opposite = action === 'incoming' ? 'outgoing' : 'incoming'
    const length = distance(point.anchor, point[opposite])
    const size = distance(point.anchor, target)
    point[action] = target
    if (size > 1e-6) point[opposite] = [point.anchor[0] - (target[0] - point.anchor[0]) * length / size,
      point.anchor[1] - (target[1] - point.anchor[1]) * length / size]
  }
  return next
}
