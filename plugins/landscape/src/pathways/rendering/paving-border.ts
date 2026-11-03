import type { MultiPolygon, Polygon } from 'polygon-clipping'
import { pavingPolygons } from './paving-polygons'
import { distance, lerp } from '../domain/curves'
import type { Point } from '../domain/schema'

const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
const unit = (a: Point): Point => {
  const length = Math.hypot(...a) || 1
  return [a[0] / length, a[1] / length]
}

/** Offset the joined footprint, so no border cuts across a T or L junction. */
export function pavingBorder(outline: MultiPolygon, width: number) {
  // Shared boundary points must be numerically identical for polygon clipping.
  const snap = (p: Point): Point => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]
  outline = outline.map((polygon) => polygon.map((ring) => ring.map((p) => snap(p as Point))))
  const band: Polygon[] = []
  const stones: Polygon[] = []
  for (const polygon of outline) for (const [ringIndex, raw] of polygon.entries()) {
    const ring = raw.slice(0, distance(raw[0] as Point, raw.at(-1) as Point) < 1e-7 ? -1 : undefined) as Point[]
    if (ring.length < 3) continue
    const signedArea = ring.reduce((sum, p, i) => sum + cross(p, ring[(i + 1) % ring.length]!), 0)
    const side = Math.sign(signedArea) * (ringIndex === 0 ? 1 : -1)
    const inner = ring.map((p, i): Point => {
      const a = unit(subtract(p, ring[(i + ring.length - 1) % ring.length]!))
      const b = unit(subtract(ring[(i + 1) % ring.length]!, p))
      const na: Point = [-a[1] * width * side, a[0] * width * side]
      const nb: Point = [-b[1] * width * side, b[0] * width * side]
      const det = cross(a, b)
      if (Math.abs(det) < 1e-6) return [p[0] + nb[0], p[1] + nb[1]]
      const t = cross(subtract(nb, na), b) / det
      if (Math.abs(t) > width * 4) return [p[0] + nb[0], p[1] + nb[1]]
      return [p[0] + na[0] + a[0] * t, p[1] + na[1] + a[1] * t]
    })
    const lengths = [0]
    for (let i = 0; i < ring.length; i++) {
      const next = (i + 1) % ring.length
      lengths.push(lengths[i]! + distance(ring[i]!, ring[next]!))
      band.push([[ring[i]!, ring[next]!, inner[next]!, inner[i]!].map(snap)])
    }
    const total = lengths.at(-1)!
    const pointAt = (s: number, points: Point[]): Point => {
      let i = 0
      while (i < ring.length - 1 && lengths[i + 1]! < s) i++
      const span = lengths[i + 1]! - lengths[i]!
      return lerp(points[i]!, points[(i + 1) % ring.length]!, span ? (s - lengths[i]!) / span : 0)
    }
    // Terminate both border runs at a sharp corner's offset bisector.
    // A single stone wrapping around that corner creates an L-shaped overlap.
    const breaks = [0]
    for (let i = 1; i < ring.length; i++) {
      const a = unit(subtract(ring[i]!, ring[i - 1]!))
      const b = unit(subtract(ring[(i + 1) % ring.length]!, ring[i]!))
      if (a[0] * b[0] + a[1] * b[1] < Math.cos(Math.PI / 12)) breaks.push(lengths[i]!)
    }
    breaks.push(total)
    for (let section = 1; section < breaks.length; section++) {
      const from = breaks[section - 1]!, span = breaks[section]! - from
      const rowCount = Math.max(1, Math.round(span / 0.29))
      for (let row = 0; row < rowCount; row++) {
        const start = from + span * row / rowCount + 0.014
        const end = from + span * (row + 1) / rowCount - 0.014
        if (end <= start) continue
        const cuts = [start, ...lengths.filter((s) => s > start && s < end), end]
        const outside = cuts.map((s) => pointAt(s, ring))
        const inside = cuts.map((s) => pointAt(s, inner)).reverse()
        stones.push([outside.concat(inside).map(snap)])
      }
    }
  }
  const border = band.length ? pavingPolygons.intersection(outline, pavingPolygons.union(band[0]!, ...band.slice(1))) : []
  // These stones are constructed from the boundary and its inward offset.
  // Re-clipping their coincident outer edges introduces numerical slivers.
  return { interior: border.length ? pavingPolygons.difference(outline, border) : outline, band: border, stones }
}
