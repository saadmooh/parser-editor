import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping'
import type { PathwayFinish } from '../domain/schema'

export function polygonsToPath(polygons: MultiPolygon): string {
  return polygons.map((polygon) => polygon.map((ring) =>
    `M ${ring.map(([x, z]) => `${x} ${z}`).join(' L ')} Z`).join(' ')).join(' ')
}

// Cut joint marks to the actual paving footprint, including junctions and holes.
export function pavingJoints(outline: MultiPolygon, finish: PathwayFinish): string {
  if (finish !== 'brick' && finish !== 'stone' || !outline.length) return ''
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const polygon of outline) for (const ring of polygon) for (const [x, z] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  const dx = finish === 'brick' ? 0.25 : 0.5
  const dz = finish === 'brick' ? 0.125 : 0.5
  const firstRow = Math.floor(minZ / dz), lastRow = Math.ceil(maxZ / dz)
  if (lastRow - firstRow > 800) return ''
  const clipped: MultiPolygon = []
  const half = 0.008
  for (let row = firstRow; row <= lastRow; row++) {
    const z = row * dz
    const seam: Polygon = [[[minX - 1, z - half], [maxX + 1, z - half],
      [maxX + 1, z + half], [minX - 1, z + half]]]
    clipped.push(...polygonClipping.intersection(outline, seam))
  }
  for (let row = firstRow; row < lastRow; row++) {
    const shift = finish === 'brick' && row % 2 ? dx / 2 : 0
    const z = row * dz
    const slab: Polygon = [[[minX - 1, z], [maxX + 1, z],
      [maxX + 1, z + dz], [minX - 1, z + dz]]]
    for (const section of polygonClipping.intersection(outline, slab)) {
      let left = Infinity, right = -Infinity
      for (const ring of section) for (const [x] of ring) {
        left = Math.min(left, x); right = Math.max(right, x)
      }
      for (let column = Math.floor((left - shift) / dx); column <= Math.ceil((right - shift) / dx); column++) {
        const x = column * dx + shift
        const seam: Polygon = [[[x - half, z], [x + half, z],
          [x + half, z + dz], [x - half, z + dz]]]
        clipped.push(...polygonClipping.intersection([section], seam))
      }
    }
  }
  return polygonsToPath(clipped)
}
