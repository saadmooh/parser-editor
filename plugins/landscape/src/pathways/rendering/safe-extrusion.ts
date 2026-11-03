import { ExtrudeGeometry, Path, Shape, Vector2, type ExtrudeGeometryOptions } from 'three'
import type { Polygon } from 'polygon-clipping'

/** Collapsed holes and sub-grid slivers must not reach Three's triangulator. */
export function extrudePaving(polygon: Polygon, options: ExtrudeGeometryOptions): ExtrudeGeometry | null {
  const rings = polygon.map((ring) => {
    if (ring.some((p) => !p.every(Number.isFinite))) return []
    const points = ring.map(([x, z]) => new Vector2(x, -z))
      .filter((p, i, all) => i === 0 || p.distanceToSquared(all[i - 1]!) > 1e-12)
    if (points.length > 1 && points[0]!.distanceToSquared(points.at(-1)!) <= 1e-12) points.pop()
    const area = points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length]!
      return sum + p.x * q.y - q.x * p.y
    }, 0)
    return points.length >= 3 && Math.abs(area) > 1e-10 ? points : []
  })
  if (!rings[0]?.length) return null
  const shape = new Shape(rings[0])
  shape.holes = rings.slice(1).filter((ring) => ring.length).map((ring) => new Path(ring))
  // A pathological piece should not take down the entire editor during a drag.
  let geometry: ExtrudeGeometry | undefined
  try {
    geometry = new ExtrudeGeometry(shape, options)
    const positions = geometry.getAttribute('position')
    if (!positions?.count || !Array.from(positions.array).every(Number.isFinite)) {
      geometry.dispose()
      return null
    }
    return geometry
  } catch {
    geometry?.dispose()
    return null
  }
}
