import type { Point } from './schema'

export function isEllipseShape(shape: string | undefined): shape is 'circle' | 'oval' {
  return shape === 'circle' || shape === 'oval'
}

export function ellipseOutline(center: Point, radiusX: number, radiusZ: number): Point[] {
  // Keep the saved boundary smooth at typical editor zoom without making large
  // ground areas scale in vertex count with their perimeter.
  return Array.from({ length: 128 }, (_, index): Point => {
    const angle = index * Math.PI * 2 / 128
    return [center[0] + radiusX * Math.cos(angle), center[1] + radiusZ * Math.sin(angle)]
  })
}

export function ellipseFromPoints(first: Point, second: Point, shape: 'circle' | 'oval') {
  const width = shape === 'circle' ? 2 * Math.hypot(second[0] - first[0], second[1] - first[1])
    : Math.abs(second[0] - first[0])
  const depth = shape === 'circle' ? width : Math.abs(second[1] - first[1])
  const center: Point = shape === 'circle' ? first
    : [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
  return { center, width, depth,
    outline: width >= 0.2 && depth >= 0.2
      ? ellipseOutline(center, width / 2, depth / 2) : [] }
}

export function ellipseBounds(outline: readonly Point[]) {
  const xs = outline.map(([x]) => x), zs = outline.map(([, z]) => z)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return { center: [(minX + maxX) / 2, (minZ + maxZ) / 2] as Point,
    width: maxX - minX, depth: maxZ - minZ }
}
