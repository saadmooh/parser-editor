import type { MultiPolygon } from 'polygon-clipping'

export type GrassEdge = { x: number; z: number; amount: number }
export type GrassEdgeSampler = (x: number, z: number) => GrassEdge

/** Bend away from the nearest cut edge; root exclusion stays in grassContainsPoint. */
export function grassEdgeSampler(footprint: MultiPolygon): GrassEdgeSampler {
  const segments = footprint.flatMap((polygon) => polygon.flatMap((ring) =>
    ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! }))))
  return (x, z) => {
    let nearest = 0.45 ** 2, dx = 0, dz = 0
    for (const { a, b } of segments) {
      const sx = b[0]! - a[0]!, sz = b[1]! - a[1]!
      const length = sx * sx + sz * sz
      const t = length ? Math.max(0, Math.min(1, ((x - a[0]!) * sx + (z - a[1]!) * sz) / length)) : 0
      const rx = x - a[0]! - t * sx, rz = z - a[1]! - t * sz
      const distance = rx * rx + rz * rz
      if (distance < nearest) { nearest = distance; dx = rx; dz = rz }
    }
    const distance = Math.sqrt(nearest)
    const amount = (1 - distance / 0.45) ** 2
    return { x: dx / Math.max(distance, 0.001), z: dz / Math.max(distance, 0.001), amount }
  }
}
